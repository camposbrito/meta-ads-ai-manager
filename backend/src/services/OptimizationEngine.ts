import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import {
  OptimizationRule,
  OptimizationSuggestion,
  AdAccount,
  Campaign,
  AdSet,
  Ad,
  Insight,
  Organization,
} from '../models';
import sequelize from '../config/database';

export interface RuleCondition {
  field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between';
  value: number | number[];
}

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
      include: [
        { model: Organization, as: 'organization' },
        { model: Campaign, as: 'campaigns' },
      ],
    });

    if (!adAccount || !adAccount.organization) {
      return { suggestions: [], rulesEvaluated: 0, suggestionsGenerated: 0 };
    }

    const rules = await OptimizationRule.findAll({
      where: { organization_id: adAccount.organization_id, is_active: true },
      order: [['priority', 'DESC']],
    });

    const suggestions: OptimizationSuggestion[] = [];
    let rulesEvaluated = rules.length;

    for (const rule of rules) {
      const ruleSuggestions = await this.evaluateRule(rule, adAccount);
      suggestions.push(...ruleSuggestions);
    }

    return {
      suggestions,
      rulesEvaluated,
      suggestionsGenerated: suggestions.length,
    };
  }

  private async evaluateRule(
    rule: OptimizationRule,
    adAccount: AdAccount
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const conditions = JSON.parse(rule.conditions) as RuleCondition[];
    const actions = JSON.parse(rule.actions) as RuleAction[];

    // Get insights for the evaluation period
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
        { model: AdSet, as: 'ad_set' },
        { model: Ad, as: 'ad' },
      ],
    });

    // Group insights by entity
    const entityInsights = this.groupInsightsByEntity(insights);

    for (const [entityKey, entityData] of Object.entries(entityInsights)) {
      const [entityType, entityId] = entityKey.split(':');
      const metrics = this.calculateMetrics(entityData.insights);

      // Check if minimum thresholds are met
      if (
        metrics.spend < rule.min_spend_threshold ||
        metrics.impressions < rule.min_impressions_threshold
      ) {
        continue;
      }

      // Evaluate conditions
      if (this.evaluateConditions(conditions, metrics)) {
        for (const action of actions) {
          const suggestion = await this.createSuggestion(
            rule,
            adAccount,
            entityType as 'campaign' | 'ad_set' | 'ad',
            entityId,
            entityData.metaEntityId,
            action,
            metrics
          );
          if (suggestion) {
            suggestions.push(suggestion);
          }
        }
      }
    }

    return suggestions;
  }

  private evaluateConditions(conditions: RuleCondition[], metrics: PerformanceMetrics): boolean {
    return conditions.every((condition) => {
      const value = this.getMetricValue(metrics, condition.field);
      
      switch (condition.operator) {
        case 'gt':
          return value > (condition.value as number);
        case 'lt':
          return value < (condition.value as number);
        case 'gte':
          return value >= (condition.value as number);
        case 'lte':
          return value <= (condition.value as number);
        case 'eq':
          return value === (condition.value as number);
        case 'neq':
          return value !== (condition.value as number);
        case 'between':
          const [min, max] = condition.value as number[];
          return value >= min && value <= max;
        default:
          return false;
      }
    });
  }

  private getMetricValue(metrics: PerformanceMetrics, field: string): number {
    const fieldMap: Record<string, keyof PerformanceMetrics> = {
      cpa: 'cpa',
      ctr: 'ctr',
      cpc: 'cpc',
      cpm: 'cpm',
      roas: 'roas',
      spend: 'spend',
      conversions: 'conversions',
      impressions: 'impressions',
      clicks: 'clicks',
      frequency: 'frequency',
    };

    const metricKey = fieldMap[field];
    return metricKey ? metrics[metricKey] : 0;
  }

  private async createSuggestion(
    rule: OptimizationRule,
    adAccount: AdAccount,
    entityType: 'campaign' | 'ad_set' | 'ad',
    entityId: string,
    metaEntityId: string,
    action: RuleAction,
    metrics: PerformanceMetrics
  ): Promise<OptimizationSuggestion | null> {
    // Check if there's already a pending suggestion for this entity
    const existingSuggestion = await OptimizationSuggestion.findOne({
      where: {
        ad_account_id: adAccount.id,
        entity_type: entityType,
        entity_id: entityId,
        status: 'pending',
      },
    });

    if (existingSuggestion) {
      return null;
    }

    const suggestionType = this.mapActionToSuggestionType(action.type);
    const { title, description, reason, expectedImpact, proposedChanges } =
      this.generateSuggestionContent(action, entityType, metrics, rule);

    return OptimizationSuggestion.create({
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
      confidence_score: this.calculateConfidence(metrics, rule),
      current_metrics: JSON.stringify(metrics),
      proposed_changes: JSON.stringify(proposedChanges),
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  }

  private generateSuggestionContent(
    action: RuleAction,
    entityType: string,
    metrics: PerformanceMetrics,
    rule: OptimizationRule
  ): {
    title: string;
    description: string;
    reason: string;
    expectedImpact: string;
    proposedChanges: Record<string, any>;
  } {
    const content: Record<string, any> = {
      title: '',
      description: '',
      reason: '',
      expectedImpact: '',
      proposedChanges: {},
    };

    switch (action.type) {
      case 'pause':
        content.title = `Pause underperforming ${entityType}`;
        content.description = `This ${entityType} has a CPA of $${metrics.cpa.toFixed(2)} which exceeds your threshold.`;
        content.reason = `High CPA ($${metrics.cpa.toFixed(2)}) with ${metrics.impressions} impressions and $${metrics.spend.toFixed(2)} spend over the evaluation period.`;
        content.expectedImpact = 'Reduce wasted ad spend and improve overall account efficiency';
        content.proposedChanges = { status: 'PAUSED' };
        break;

      case 'duplicate':
        content.title = `Duplicate high-performing ${entityType}`;
        content.description = `This ${entityType} has a CTR of ${(metrics.ctr * 100).toFixed(2)}% and CPA of $${metrics.cpa.toFixed(2)}.`;
        content.reason = `Strong performance with ${(metrics.ctr * 100).toFixed(2)}% CTR and efficient $${metrics.cpa.toFixed(2)} CPA.`;
        content.expectedImpact = 'Scale successful creative/audience to reach more potential customers';
        content.proposedChanges = { action: 'duplicate' };
        break;

      case 'increase_budget':
        const increasePercent = action.params?.percentage || 20;
        content.title = `Increase budget for ${entityType}`;
        content.description = `This ${entityType} is performing well with ROAS of ${metrics.roas.toFixed(2)}.`;
        content.reason = `Strong ROAS (${metrics.roas.toFixed(2)}) indicates room for budget expansion.`;
        content.expectedImpact = `Potential ${increasePercent}% increase in conversions with maintained efficiency`;
        content.proposedChanges = { budget_increase_percentage: increasePercent };
        break;

      case 'decrease_budget':
        const decreasePercent = action.params?.percentage || 20;
        content.title = `Decrease budget for ${entityType}`;
        content.description = `This ${entityType} has declining performance metrics.`;
        content.reason = `Performance indicators suggest reducing investment to minimize losses.`;
        content.expectedImpact = `Reduce spend by ${decreasePercent}% while maintaining learnings`;
        content.proposedChanges = { budget_decrease_percentage: decreasePercent };
        break;
    }

    return content as any;
  }

  private mapActionToSuggestionType(
    actionType: string
  ): 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative' {
    switch (actionType) {
      case 'pause':
        return 'pause';
      case 'duplicate':
        return 'duplicate';
      case 'increase_budget':
        return 'increase_budget';
      case 'decrease_budget':
        return 'decrease_budget';
      default:
        return 'pause';
    }
  }

  private calculateConfidence(metrics: PerformanceMetrics, rule: OptimizationRule): number {
    // Base confidence on data volume and metric strength
    let confidence = 0.5;

    // More impressions = higher confidence
    if (metrics.impressions > 10000) confidence += 0.2;
    else if (metrics.impressions > 5000) confidence += 0.1;

    // More spend = higher confidence
    if (metrics.spend > 500) confidence += 0.2;
    else if (metrics.spend > 100) confidence += 0.1;

    // More conversions = higher confidence
    if (metrics.conversions > 10) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private groupInsightsByEntity(insights: Insight[]): Record<string, { metaEntityId: string; insights: Insight[] }> {
    const grouped: Record<string, { metaEntityId: string; insights: Insight[] }> = {};

    for (const insight of insights) {
      let key = '';
      let metaEntityId = '';

      if (insight.ad_id && insight.ad) {
        key = `ad:${insight.ad_id}`;
        metaEntityId = insight.ad.meta_ad_id;
      } else if (insight.ad_set_id && insight.ad_set) {
        key = `ad_set:${insight.ad_set_id}`;
        metaEntityId = insight.ad_set.meta_adset_id;
      } else if (insight.campaign_id && insight.campaign) {
        key = `campaign:${insight.campaign_id}`;
        metaEntityId = insight.campaign.meta_campaign_id;
      }

      if (key) {
        if (!grouped[key]) {
          grouped[key] = { metaEntityId, insights: [] };
        }
        grouped[key].insights.push(insight);
      }
    }

    return grouped;
  }

  private calculateMetrics(insights: Insight[]): PerformanceMetrics {
    return insights.reduce(
      (acc, insight) => ({
        impressions: acc.impressions + insight.impressions,
        reach: acc.reach + insight.reach,
        clicks: acc.clicks + insight.clicks,
        spend: acc.spend + insight.spend,
        conversions: acc.conversions + insight.conversions,
        conversion_value: acc.conversion_value + insight.conversion_value,
        ctr: acc.clicks / (acc.impressions || 1),
        cpc: acc.spend / (acc.clicks || 1),
        cpm: (acc.spend / (acc.impressions || 1)) * 1000,
        cpa: acc.spend / (acc.conversions || 1),
        roas: acc.conversion_value / (acc.spend || 1),
        frequency: acc.impressions / (acc.reach || 1),
      }),
      {
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversion_value: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cpa: 0,
        roas: 0,
        frequency: 0,
      }
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

interface PerformanceMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
}

export default new OptimizationEngine();
