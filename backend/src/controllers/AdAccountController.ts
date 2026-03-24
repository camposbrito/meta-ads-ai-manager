import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { AdAccount, Organization, SyncJob } from '../models';
import { encrypt } from '../services/EncryptionService';
import MetaApiService from '../services/MetaApiService';
import SyncService from '../services/SyncService';
import sequelize from '../config/database';

export class AdAccountController {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const accounts = await AdAccount.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
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
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async connect(req: AuthRequest, res: Response): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accessToken, accountId } = req.body;

      if (!accessToken || !accountId) {
        res.status(400).json({ error: 'Access token and account ID required' });
        return;
      }

      // Check organization limits
      const organization = await Organization.findByPk(req.user.organizationId, { transaction });
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const currentAccountCount = await AdAccount.count({
        where: { organization_id: req.user.organizationId, is_active: true },
        transaction,
      });

      if (currentAccountCount >= organization.max_ad_accounts) {
        res.status(403).json({
          error: 'Maximum number of ad accounts reached for your plan',
          max: organization.max_ad_accounts,
        });
        return;
      }

      // Get account info from Meta
      const metaAccounts = await MetaApiService.getAdAccounts(accessToken);
      const metaAccount = metaAccounts.find((acc) => acc.id === accountId || acc.id === `act_${accountId}`);

      if (!metaAccount) {
        res.status(404).json({ error: 'Ad account not found' });
        return;
      }

      // Create ad account
      const adAccount = await AdAccount.create(
        {
          id: uuidv4(),
          organization_id: req.user.organizationId,
          meta_account_id: metaAccount.id.replace('act_', ''),
          meta_business_id: metaAccount.business?.id || null,
          name: metaAccount.name,
          currency: metaAccount.currency,
          access_token_encrypted: encrypt(accessToken),
          is_active: true,
        },
        { transaction }
      );

      // Queue initial sync
      await SyncJob.create(
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
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async disconnect(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const adAccount = await AdAccount.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!adAccount) {
        res.status(404).json({ error: 'Ad account not found' });
        return;
      }

      await adAccount.update({ is_active: false });

      res.json({ message: 'Ad account disconnected' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async sync(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const adAccount = await AdAccount.findOne({
        where: { id, organization_id: req.user.organizationId },
        include: [{ model: Organization, as: 'organization' }],
      });

      if (!adAccount) {
        res.status(404).json({ error: 'Ad account not found' });
        return;
      }

      const canSync = await SyncService.canSyncToday(adAccount.id);
      if (!canSync) {
        res.status(429).json({
          error: 'Daily sync limit reached',
          max_daily_syncs: adAccount.organization?.max_daily_syncs,
        });
        return;
      }

      // Queue sync job
      const syncJob = await SyncJob.create({
        id: uuidv4(),
        ad_account_id: adAccount.id,
        job_type: 'incremental_sync',
        status: 'pending',
        records_synced: 0,
      });

      // Start sync in background
      SyncService.syncAdAccount(adAccount.id, 'incremental_sync').catch(console.error);

      res.json({
        message: 'Sync started',
        job: {
          id: syncJob.id,
          status: syncJob.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSyncStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const adAccount = await AdAccount.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!adAccount) {
        res.status(404).json({ error: 'Ad account not found' });
        return;
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
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new AdAccountController();
