import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  Insight,
  OptimizationRule,
  OptimizationSuggestion,
  Organization,
} from '../models';
import {
  aggregateInsightMetrics,
  calculatePerformanceMetrics,
  type PerformanceMetrics,
} from '../utils/metrics';
import {
  evaluateConditions,
  type RuleCondition,
} from '../utils/optimizationRules';

export interface RuleAction {
  type: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget';
  params?: Record<string, any>;
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[];
  rulesEvaluated: number;
  suggestionsGenerated: number;
}

export class OptimizationEngine {
  async evaluateAdAccount(adAccountId: string): Promise<OptimizationResult> {
    const adAccount = await AdAccount.findByPk(adAccountId, {
      include: [{ model: Organization, as: 'organization' }],
    });

    if (!adAccount || !adAccount.organization) {
      return { suggestions: [], rulesEvaluated: 0, suggestionsGenerated: 0 };
    }

    const rules = await OptimizationRule.findAll({
      where: { organization_id: adAccount.organization_id, is_active: true },
      order: [['priority', 'DESC']],
    });

    const existingSuggestions = await OptimizationSuggestion.findAll({
      where: {
        ad_account_id: adAccount.id,
        status: 'pending',
      },
      attributes: ['entity_type', 'entity_id'],
    });

    const pendingSuggestionKeys = new Set(
      existingSuggestions.map((suggestion) => `${suggestion.entity_type}:${suggestion.entity_id}`)
    );

    const suggestions: OptimizationSuggestion[] = [];

    for (const rule of rules) {
      const ruleSuggestions = await this.evaluateRule(rule, adAccount, pendingSuggestionKeys);
      suggestions.push(...ruleSuggestions);
    }

    return {
      suggestions,
      rulesEvaluated: rules.length,
      suggestionsGenerated: suggestions.length,
    };
  }

  private async evaluateRule(
    rule: OptimizationRule,
    adAccount: AdAccount,
    pendingSuggestionKeys: Set<string>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const conditions = JSON.parse(rule.conditions) as RuleCondition[];
    const actions = JSON.parse(rule.actions) as RuleAction[];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rule.evaluation_period_days);

    const insights = await Insight.findAll({
      where: {
        ad_account_id: adAccount.id,
        date: {
          [Op.gte]: this.formatDate(startDate),
        },
      },
      include: [
        { model: Campaign, as: 'campaign' },
        { model: AdSet, as: 'adSet' },
        { model: Ad, as: 'ad' },
      ],
    });

    const entityInsights = this.groupInsightsByEntity(insights);

    for (const [entityKey, entityData] of Object.entries(entityInsights)) {
      const [entityType, entityId] = entityKey.split(':');
      const metrics = this.calculateMetrics(entityData.insights);

      if (
        metrics.spend < Number(rule.min_spend_threshold) ||
        metrics.impressions < Number(rule.min_impressions_threshold)
      ) {
        continue;
      }

      if (evaluateConditions(conditions, metrics)) {
        for (const action of actions) {
          const suggestion = await this.createSuggestion(
            rule,
            adAccount,
            entityType as 'campaign' | 'ad_set' | 'ad',
            entityId,
            entityData.metaEntityId,
            action,
            metrics,
            pendingSuggestionKeys
          );

          if (suggestion) {
            suggestions.push(suggestion);
          }
        }
      }
    }

    return suggestions;
  }

  private async createSuggestion(
    rule: OptimizationRule,
    adAccount: AdAccount,
    entityType: 'campaign' | 'ad_set' | 'ad',
    entityId: string,
    metaEntityId: string,
    action: RuleAction,
    metrics: PerformanceMetrics,
    pendingSuggestionKeys: Set<string>
  ): Promise<OptimizationSuggestion | null> {
    if (action.type === 'duplicate' && entityType !== 'ad') {
      return null;
    }

    const suggestionKey = `${entityType}:${entityId}`;
    if (pendingSuggestionKeys.has(suggestionKey)) {
      return null;
    }

    const suggestionType = this.mapActionToSuggestionType(action.type);
    const { title, description, reason, expectedImpact, proposedChanges } =
      this.generateSuggestionContent(action, entityType, metrics);

    const suggestion = await OptimizationSuggestion.create({
      id: uuidv4(),
      organization_id: adAccount.organization_id,
      ad_account_id: adAccount.id,
      rule_id: rule.id,
      entity_type: entityType,
      entity_id: entityId,
      meta_entity_id: metaEntityId,
      suggestion_type: suggestionType,
      title,
      description,
      reason,
      expected_impact: expectedImpact,
      confidence_score: this.calculateConfidence(metrics),
      current_metrics: JSON.stringify(metrics),
      proposed_changes: JSON.stringify(proposedChanges),
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    pendingSuggestionKeys.add(suggestionKey);
    return suggestion;
  }

  private generateSuggestionContent(
    action: RuleAction,
    entityType: string,
    metrics: PerformanceMetrics
  ): {
    title: string;
    description: string;
    reason: string;
    expectedImpact: string;
    proposedChanges: Record<string, any>;
  } {
    switch (action.type) {
      case 'pause':
        return {
          title: `Pause underperforming ${entityType}`,
          description: `This ${entityType} has a CPA of $${metrics.cpa.toFixed(2)} which exceeds your threshold.`,
          reason: `High CPA ($${metrics.cpa.toFixed(2)}) with ${metrics.impressions} impressions and $${metrics.spend.toFixed(2)} spend over the evaluation period.`,
          expectedImpact: 'Reduce wasted ad spend and improve overall account efficiency',
          proposedChanges: { status: 'PAUSED' },
        };
      case 'duplicate':
        return {
          title: `Duplicate high-performing ${entityType}`,
          description: `This ${entityType} has a CTR of ${(metrics.ctr * 100).toFixed(2)}% and CPA of $${metrics.cpa.toFixed(2)}.`,
          reason: `Strong performance with ${(metrics.ctr * 100).toFixed(2)}% CTR and efficient $${metrics.cpa.toFixed(2)} CPA.`,
          expectedImpact: 'Scale successful creative/audience to reach more potential customers',
          proposedChanges: { action: 'duplicate' },
        };
      case 'increase_budget': {
        const increasePercent = action.params?.percentage || 20;
        return {
          title: `Increase budget for ${entityType}`,
          description: `This ${entityType} is performing well with ROAS of ${metrics.roas.toFixed(2)}.`,
          reason: `Strong ROAS (${metrics.roas.toFixed(2)}) indicates room for budget expansion.`,
          expectedImpact: `Potential ${increasePercent}% increase in conversions with maintained efficiency`,
          proposedChanges: { budget_increase_percentage: increasePercent },
        };
      }
      case 'decrease_budget': {
        const decreasePercent = action.params?.percentage || 20;
        return {
          title: `Decrease budget for ${entityType}`,
          description: `This ${entityType} has declining performance metrics.`,
          reason: 'Performance indicators suggest reducing investment to minimize losses.',
          expectedImpact: `Reduce spend by ${decreasePercent}% while maintaining learnings`,
          proposedChanges: { budget_decrease_percentage: decreasePercent },
        };
      }
    }
  }

  private mapActionToSuggestionType(
    actionType: string
  ): 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative' {
    if (actionType === 'duplicate') {
      return 'duplicate';
    }
    if (actionType === 'increase_budget') {
      return 'increase_budget';
    }
    if (actionType === 'decrease_budget') {
      return 'decrease_budget';
    }
    return 'pause';
  }

  private calculateConfidence(metrics: PerformanceMetrics): number {
    let confidence = 0.5;

    if (metrics.impressions > 10000) {
      confidence += 0.2;
    } else if (metrics.impressions > 5000) {
      confidence += 0.1;
    }

    if (metrics.spend > 500) {
      confidence += 0.2;
    } else if (metrics.spend > 100) {
      confidence += 0.1;
    }

    if (metrics.conversions > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  private groupInsightsByEntity(
    insights: Insight[]
  ): Record<string, { metaEntityId: string; insights: Insight[] }> {
    const grouped: Record<string, { metaEntityId: string; insights: Insight[] }> = {};

    for (const insight of insights) {
      let key = '';
      let metaEntityId = '';

      if (insight.ad_id && insight.ad) {
        key = `ad:${insight.ad_id}`;
        metaEntityId = insight.ad.meta_ad_id;
      } else if (insight.ad_set_id && insight.adSet) {
        key = `ad_set:${insight.ad_set_id}`;
        metaEntityId = insight.adSet.meta_adset_id;
      } else if (insight.campaign_id && insight.campaign) {
        key = `campaign:${insight.campaign_id}`;
        metaEntityId = insight.campaign.meta_campaign_id;
      }

      if (!key) {
        continue;
      }

      if (!grouped[key]) {
        grouped[key] = { metaEntityId, insights: [] };
      }

      grouped[key].insights.push(insight);
    }

    return grouped;
  }

  private calculateMetrics(insights: Insight[]): PerformanceMetrics {
    return calculatePerformanceMetrics(aggregateInsightMetrics(insights));
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export default new OptimizationEngine();
