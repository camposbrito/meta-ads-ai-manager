import { v4 as uuidv4 } from 'uuid';
import MetaApiService from './MetaApiService';
import {
  ExecutedAction,
  OptimizationSuggestion,
  AdAccount,
  Ad,
  AdSet,
  Campaign,
} from '../models';
import sequelize from '../config/database';

export interface ExecuteActionInput {
  organizationId: string;
  adAccountId: string;
  suggestionId?: string;
  actionType: ExecutedAction['action_type'];
  entityType: ExecutedAction['entity_type'];
  entityId: string;
  executionMethod: 'manual' | 'automatic';
  executedBy?: string;
}

export class ActionExecutionService {
  async executeAction(input: ExecuteActionInput): Promise<ExecutedAction> {
    const transaction = await sequelize.transaction();

    try {
      const adAccount = await AdAccount.findByPk(input.adAccountId, { transaction });
      if (!adAccount) {
        throw new Error('Ad account not found');
      }

      const action = await ExecutedAction.create(
        {
          id: uuidv4(),
          organization_id: input.organizationId,
          ad_account_id: input.adAccountId,
          suggestion_id: input.suggestionId || null,
          action_type: input.actionType,
          entity_type: input.entityType,
          entity_id: input.entityId,
          meta_entity_id: '', // Will be set below
          executed_by: input.executedBy || null,
          execution_method: input.executionMethod,
          status: 'pending',
        },
        { transaction }
      );

      // Get the entity and store previous state
      let previousState: any = {};
      let metaEntityId = '';

      switch (input.entityType) {
        case 'ad':
          const ad = await Ad.findByPk(input.entityId, { transaction });
          if (ad) {
            previousState = { status: ad.status, name: ad.name };
            metaEntityId = ad.meta_ad_id;
          }
          break;
        case 'ad_set':
          const adSet = await AdSet.findByPk(input.entityId, { transaction });
          if (adSet) {
            previousState = { status: adSet.status, name: adSet.name, daily_budget: adSet.daily_budget };
            metaEntityId = adSet.meta_adset_id;
          }
          break;
        case 'campaign':
          const campaign = await Campaign.findByPk(input.entityId, { transaction });
          if (campaign) {
            previousState = { status: campaign.status, name: campaign.name, daily_budget: campaign.daily_budget };
            metaEntityId = campaign.meta_campaign_id;
          }
          break;
      }

      await action.update({ meta_entity_id: metaEntityId, previous_state: JSON.stringify(previousState) }, { transaction });

      // Execute the action via Meta API
      let result: any;
      let newState: any = {};

      switch (input.actionType) {
        case 'pause_ad':
          result = await MetaApiService.updateAdStatus(adAccount, metaEntityId, 'PAUSED');
          newState = { status: 'PAUSED' };
          break;

        case 'pause_adset':
          result = await MetaApiService.pauseAdSet(adAccount, metaEntityId);
          newState = { status: 'PAUSED' };
          break;

        case 'pause_campaign':
          result = await MetaApiService.pauseCampaign(adAccount, metaEntityId);
          newState = { status: 'PAUSED' };
          break;

        case 'increase_budget':
        case 'decrease_budget':
          const percentage = input.actionType === 'increase_budget' ? 20 : -20;
          if (input.entityType === 'ad_set') {
            const adSet = await AdSet.findByPk(input.entityId, { transaction });
            if (adSet && adSet.daily_budget) {
              const newBudget = Math.round(adSet.daily_budget * (1 + percentage / 100) * 100);
              result = await MetaApiService.updateAdSetBudget(adAccount, metaEntityId, newBudget);
              newState = { daily_budget: newBudget / 100 };
            }
          } else if (input.entityType === 'campaign') {
            const campaign = await Campaign.findByPk(input.entityId, { transaction });
            if (campaign && campaign.daily_budget) {
              const newBudget = Math.round(campaign.daily_budget * (1 + percentage / 100) * 100);
              result = await MetaApiService.updateCampaignBudget(adAccount, metaEntityId, newBudget);
              newState = { daily_budget: newBudget / 100 };
            }
          }
          break;

        case 'duplicate_ad':
          const ad = await Ad.findByPk(input.entityId, { transaction });
          if (ad) {
            result = await MetaApiService.duplicateAd(adAccount, metaEntityId, `${ad.name} (Copy)`);
            newState = { duplicated_from: metaEntityId };
          }
          break;

        default:
          throw new Error(`Unknown action type: ${input.actionType}`);
      }

      // Update action with result
      await action.update(
        {
          status: 'success',
          new_state: JSON.stringify(newState),
          meta_response: JSON.stringify(result),
        },
        { transaction }
      );

      // Update suggestion if provided
      if (input.suggestionId) {
        await OptimizationSuggestion.update(
          {
            status: 'executed',
            executed_at: new Date(),
          },
          {
            where: { id: input.suggestionId },
            transaction,
          }
        );
      }

      await transaction.commit();
      return action;
    } catch (error) {
      await transaction.rollback();

      // Update action with error
      await ExecutedAction.update(
        {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        },
        {
          where: { entity_id: input.entityId, action_type: input.actionType },
        }
      );

      throw error;
    }
  }

  async getActionHistory(adAccountId: string, limit = 50): Promise<ExecutedAction[]> {
    return ExecutedAction.findAll({
      where: { ad_account_id: adAccountId },
      order: [['created_at', 'DESC']],
      limit,
      include: [
        { model: OptimizationSuggestion, as: 'suggestion' },
      ],
    });
  }
}

export default new ActionExecutionService();
