import { OptimizationRule, OptimizationSuggestion, AdAccount, Organization } from '../models';
import billingService, { PlanType } from './BillingService';
import ActionExecutionService from './ActionExecutionService';
import { AppError } from '../middleware/errorHandler';

interface AutoOptimizationResult {
  processed: number;
  executed: number;
  skipped: number;
}

class AutoOptimizationService {
  async processPendingSuggestions(adAccountId: string): Promise<AutoOptimizationResult> {
    const adAccount = await AdAccount.findByPk(adAccountId, {
      include: [{ model: Organization, as: 'organization', attributes: ['id', 'plan'] }],
    });

    if (!adAccount || !adAccount.organization) {
      return { processed: 0, executed: 0, skipped: 0 };
    }

    const planLimits = billingService.getPlanLimits(adAccount.organization.plan as PlanType);
    if (!planLimits.auto_optimization_enabled) {
      return { processed: 0, executed: 0, skipped: 0 };
    }

    const minConfidence = this.getMinConfidenceThreshold();
    const maxActionsPerRun = this.getMaxActionsPerRun();

    const suggestions = await OptimizationSuggestion.findAll({
      where: {
        ad_account_id: adAccountId,
        status: 'pending',
      },
      include: [{ model: OptimizationRule, as: 'rule', attributes: ['id', 'priority'] }],
      order: [['created_at', 'ASC']],
    });

    const candidates = suggestions
      .filter((suggestion) => this.normalizeConfidence(suggestion.confidence_score) >= minConfidence)
      .sort((a, b) => {
        const priorityA = a.rule?.priority || 0;
        const priorityB = b.rule?.priority || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        return this.normalizeConfidence(b.confidence_score) - this.normalizeConfidence(a.confidence_score);
      })
      .slice(0, maxActionsPerRun);

    let executed = 0;
    let skipped = 0;

    for (const suggestion of candidates) {
      const actionType = this.mapSuggestionToActionType(suggestion.suggestion_type, suggestion.entity_type);
      if (!actionType) {
        skipped++;
        continue;
      }

      try {
        await ActionExecutionService.executeAction({
          organizationId: adAccount.organization_id,
          adAccountId,
          suggestionId: suggestion.id,
          actionType,
          entityType: suggestion.entity_type,
          entityId: suggestion.entity_id,
          executionMethod: 'automatic',
        });
        executed++;
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 429) {
          // Auto action daily limit reached for this account.
          break;
        }
        skipped++;
      }
    }

    return {
      processed: candidates.length,
      executed,
      skipped,
    };
  }

  private mapSuggestionToActionType(
    suggestionType: OptimizationSuggestion['suggestion_type'],
    entityType: OptimizationSuggestion['entity_type']
  ):
    | 'pause_ad'
    | 'pause_adset'
    | 'pause_campaign'
    | 'duplicate_ad'
    | 'increase_budget'
    | 'decrease_budget'
    | null {
    if (suggestionType === 'pause') {
      if (entityType === 'campaign') {
        return 'pause_campaign';
      }

      if (entityType === 'ad_set') {
        return 'pause_adset';
      }

      return 'pause_ad';
    }

    if (suggestionType === 'duplicate') {
      return entityType === 'ad' ? 'duplicate_ad' : null;
    }

    if (suggestionType === 'increase_budget') {
      return entityType === 'campaign' || entityType === 'ad_set' ? 'increase_budget' : null;
    }

    if (suggestionType === 'decrease_budget') {
      return entityType === 'campaign' || entityType === 'ad_set' ? 'decrease_budget' : null;
    }

    return null;
  }

  private normalizeConfidence(value: number | string | null): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private getMinConfidenceThreshold(): number {
    const parsed = Number.parseFloat(process.env.OPTIMIZATION_AUTO_EXECUTE_MIN_CONFIDENCE || '0.85');
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return 0.85;
    }
    return parsed;
  }

  private getMaxActionsPerRun(): number {
    const parsed = Number.parseInt(process.env.OPTIMIZATION_AUTO_ACTIONS_PER_RUN || '5', 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 5;
    }
    return parsed;
  }
}

export default new AutoOptimizationService();
