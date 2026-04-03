import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  ExecutedAction,
  Insight,
  OptimizationSuggestion,
  Organization,
  SyncJob,
} from '../models';
import { encrypt } from '../services/EncryptionService';
import MetaApiService from '../services/MetaApiService';
import SyncService from '../services/SyncService';
import billingService, { PlanType } from '../services/BillingService';
import sequelize from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { requireAuth, requireString } from '../utils/request';

function parseDeleteHistoryFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

export class AdAccountController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);

    const accounts = await AdAccount.findAll({
      where: { organization_id: user.organizationId, is_active: true },
      order: [['created_at', 'DESC']],
    });

    res.json({
      accounts: accounts.map((acc) => ({
        id: acc.id,
        meta_account_id: acc.meta_account_id,
        name: acc.name,
        currency: acc.currency,
        is_active: acc.is_active,
        last_synced_at: acc.last_synced_at,
        created_at: acc.created_at,
      })),
    });
  }

  async listMetaAccounts(req: AuthRequest, res: Response): Promise<void> {
    requireAuth(req);
    const accessToken = requireString(req.body.accessToken, 'accessToken');

    const metaAccounts = await MetaApiService.getAdAccounts(accessToken);

    res.json({
      accounts: metaAccounts.map((account) => ({
        id: account.id.replace('act_', ''),
        meta_account_id: account.id,
        name: account.name,
        currency: account.currency,
        business_id: account.business?.id || null,
      })),
    });
  }

  async connect(req: AuthRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const user = requireAuth(req);
      const accessToken = requireString(req.body.accessToken, 'accessToken');
      const accountId = requireString(req.body.accountId, 'accountId');

      const organization = await Organization.findByPk(user.organizationId, { transaction });
      if (!organization) {
        throw new AppError('Organization not found', 404);
      }

      const planLimits = billingService.getPlanLimits(organization.plan as PlanType);
      if (
        organization.max_ad_accounts !== planLimits.max_ad_accounts ||
        organization.max_daily_syncs !== planLimits.max_daily_syncs
      ) {
        await organization.update(
          {
            max_ad_accounts: planLimits.max_ad_accounts,
            max_daily_syncs: planLimits.max_daily_syncs,
          },
          { transaction }
        );
      }

      const currentAccountCount = await AdAccount.count({
        where: { organization_id: user.organizationId, is_active: true },
        transaction,
      });

      if (currentAccountCount >= planLimits.max_ad_accounts) {
        throw new AppError('Maximum number of ad accounts reached for your plan', 403, {
          max: planLimits.max_ad_accounts,
        });
      }

      const metaAccounts = await MetaApiService.getAdAccounts(accessToken);
      const metaAccount = metaAccounts.find(
        (account) => account.id === accountId || account.id === `act_${accountId}`
      );

      if (!metaAccount) {
        throw new AppError('Ad account not found on Meta', 404);
      }

      const normalizedMetaAccountId = metaAccount.id.replace('act_', '');
      const existingAccount = await AdAccount.findOne({
        where: {
          organization_id: user.organizationId,
          meta_account_id: normalizedMetaAccountId,
        },
        transaction,
      });

      let adAccount: AdAccount;
      if (existingAccount && existingAccount.is_active) {
        throw new AppError('Ad account is already connected', 409);
      }

      if (existingAccount) {
        await existingAccount.update(
          {
            meta_business_id: metaAccount.business?.id || null,
            name: metaAccount.name,
            currency: metaAccount.currency,
            access_token_encrypted: encrypt(accessToken),
            is_active: true,
          },
          { transaction }
        );
        adAccount = existingAccount;
      } else {
        adAccount = await AdAccount.create(
          {
            id: uuidv4(),
            organization_id: user.organizationId,
            meta_account_id: normalizedMetaAccountId,
            meta_business_id: metaAccount.business?.id || null,
            name: metaAccount.name,
            currency: metaAccount.currency,
            access_token_encrypted: encrypt(accessToken),
            is_active: true,
            daily_sync_count: 0,
          },
          { transaction }
        );
      }

      const syncJob = await SyncJob.create(
        {
          id: uuidv4(),
          ad_account_id: adAccount.id,
          job_type: 'full_sync',
          status: 'pending',
          records_synced: 0,
        },
        { transaction }
      );

      await transaction.commit();

      SyncService.syncAdAccount(adAccount.id, 'full_sync', { existingJobId: syncJob.id }).catch(
        (error) => {
          console.error(`Initial sync failed for ad account ${adAccount.id}:`, error);
        }
      );

      res.status(201).json({
        account: {
          id: adAccount.id,
          meta_account_id: adAccount.meta_account_id,
          name: adAccount.name,
          currency: adAccount.currency,
        },
        message: 'Ad account connected. Initial sync started.',
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async disconnect(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;
    const deleteHistory = parseDeleteHistoryFlag(
      typeof req.query.delete_history !== 'undefined' ? req.query.delete_history : req.body?.delete_history
    );
    const transaction = await sequelize.transaction();

    try {
      const adAccount = await AdAccount.findOne({
        where: { id, organization_id: user.organizationId },
        transaction,
      });

      if (!adAccount) {
        throw new AppError('Ad account not found', 404);
      }

      if (!deleteHistory) {
        await adAccount.update({ is_active: false }, { transaction });
        await transaction.commit();
        res.json({ message: 'Ad account disconnected. History preserved.' });
        return;
      }

      const campaigns = await Campaign.findAll({
        where: { ad_account_id: adAccount.id },
        attributes: ['id'],
        transaction,
      });
      const campaignIds = campaigns.map((campaign) => campaign.id);

      const adSets = campaignIds.length
        ? await AdSet.findAll({
            where: { campaign_id: campaignIds },
            attributes: ['id'],
            transaction,
          })
        : [];
      const adSetIds = adSets.map((adSet) => adSet.id);

      if (adSetIds.length) {
        await Ad.destroy({
          where: { ad_set_id: adSetIds },
          transaction,
        });
      }

      if (campaignIds.length) {
        await AdSet.destroy({
          where: { campaign_id: campaignIds },
          transaction,
        });
      }

      await Promise.all([
        Campaign.destroy({
          where: { ad_account_id: adAccount.id },
          transaction,
        }),
        Insight.destroy({
          where: { ad_account_id: adAccount.id },
          transaction,
        }),
        OptimizationSuggestion.destroy({
          where: { ad_account_id: adAccount.id },
          transaction,
        }),
        ExecutedAction.destroy({
          where: { ad_account_id: adAccount.id },
          transaction,
        }),
        SyncJob.destroy({
          where: { ad_account_id: adAccount.id },
          transaction,
        }),
      ]);

      await adAccount.destroy({ transaction });
      await transaction.commit();

      res.json({ message: 'Ad account removed. History deleted.' });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async sync(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const adAccount = await AdAccount.findOne({
      where: { id, organization_id: user.organizationId },
      include: [{ model: Organization, as: 'organization' }],
    });

    if (!adAccount) {
      throw new AppError('Ad account not found', 404);
    }

    const canSync = await SyncService.canSyncToday(adAccount.id);
    if (!canSync) {
      throw new AppError('Daily sync limit reached', 429, {
        max_daily_syncs: adAccount.organization?.max_daily_syncs,
      });
    }

    const syncJob = await SyncJob.create({
      id: uuidv4(),
      ad_account_id: adAccount.id,
      job_type: 'incremental_sync',
      status: 'pending',
      records_synced: 0,
    });

    SyncService.syncAdAccount(adAccount.id, 'incremental_sync', {
      existingJobId: syncJob.id,
    }).catch((error) => {
      console.error(`Background sync failed for ad account ${adAccount.id}:`, error);
    });

    res.json({
      message: 'Sync started',
      job: {
        id: syncJob.id,
        status: syncJob.status,
      },
    });
  }

  async getSyncStatus(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const adAccount = await AdAccount.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!adAccount) {
      throw new AppError('Ad account not found', 404);
    }

    const recentJobs = await SyncJob.findAll({
      where: { ad_account_id: id },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    res.json({
      ad_account_id: id,
      last_synced_at: adAccount.last_synced_at,
      daily_sync_count: adAccount.daily_sync_count,
      last_sync_date: adAccount.last_sync_date,
      recent_jobs: recentJobs,
    });
  }
}

export default new AdAccountController();
