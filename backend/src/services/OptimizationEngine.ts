import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  ExecutedAction,
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

interface SuggestionCandidate {
  rule: OptimizationRule;
  adAccount: AdAccount;
  entityType: 'campaign' | 'ad_set' | 'ad';
  entityId: string;
  metaEntityId: string;
  action: RuleAction;
  suggestionType: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget';
  confidence: number;
  metrics: PerformanceMetrics;
  title: string;
  description: string;
  reason: string;
  expectedImpact: string;
  proposedChanges: Record<string, any>;
}

interface ExistingPendingSuggestionMeta {
  id: string;
  entityType: 'campaign' | 'ad_set' | 'ad';
  entityId: string;
  suggestionType: OptimizationSuggestion['suggestion_type'];
  priority: number;
  confidence: number;
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

    const rulePriorityMap = new Map<string, number>();
    for (const rule of rules) {
      rulePriorityMap.set(rule.id, rule.priority);
    }

    const existingSuggestions = await OptimizationSuggestion.findAll({
      where: {
        ad_account_id: adAccount.id,
        status: 'pending',
      },
      attributes: ['id', 'entity_type', 'entity_id', 'suggestion_type', 'rule_id', 'confidence_score'],
    });

    const existingByEntity = new Map<string, ExistingPendingSuggestionMeta[]>();
    for (const suggestion of existingSuggestions) {
      const key = `${suggestion.entity_type}:${suggestion.entity_id}`;
      const current = existingByEntity.get(key) || [];
      current.push({
        id: suggestion.id,
        entityType: suggestion.entity_type,
        entityId: suggestion.entity_id,
        suggestionType: suggestion.suggestion_type,
        priority: suggestion.rule_id ? rulePriorityMap.get(suggestion.rule_id) || 0 : 0,
        confidence: this.normalizeConfidence(suggestion.confidence_score),
      });
      existingByEntity.set(key, current);
    }

    const cooldownHours = this.getSuggestionCooldownHours();
    const cooldownStart = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
    const recentExecutedActions = await ExecutedAction.findAll({
      where: {
        ad_account_id: adAccount.id,
        status: 'success',
        created_at: { [Op.gte]: cooldownStart },
      },
      attributes: ['entity_type', 'entity_id', 'action_type'],
    });

    const recentExecutedActionKeys = new Set(
      recentExecutedActions.map(
        (action) => `${action.entity_type}:${action.entity_id}:${action.action_type}`
      )
    );

    const candidates: SuggestionCandidate[] = [];
    for (const rule of rules) {
      const ruleCandidates = await this.evaluateRule(rule, adAccount, recentExecutedActionKeys);
      candidates.push(...ruleCandidates);
    }

    const bestCandidatesByEntity = new Map<string, SuggestionCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.entityType}:${candidate.entityId}`;
      const existing = bestCandidatesByEntity.get(key);
      if (!existing || this.isCandidatePreferred(candidate, existing)) {
        bestCandidatesByEntity.set(key, candidate);
      }
    }

    const createdSuggestions: OptimizationSuggestion[] = [];
    for (const [entityKey, candidate] of bestCandidatesByEntity.entries()) {
      const existingForEntity = existingByEntity.get(entityKey) || [];
      const bestExisting = this.getBestExistingSuggestion(existingForEntity);

      if (bestExisting && !this.isCandidatePreferredOverExisting(candidate, bestExisting)) {
        continue;
      }

      if (existingForEntity.length > 0) {
        await OptimizationSuggestion.update(
          {
            status: 'expired',
            reviewed_at: new Date(),
          },
          {
            where: {
              id: { [Op.in]: existingForEntity.map((item) => item.id) },
            },
          }
        );
      }

      const suggestion = await this.persistSuggestion(candidate);
      createdSuggestions.push(suggestion);
    }

    return {
      suggestions: createdSuggestions,
      rulesEvaluated: rules.length,
      suggestionsGenerated: createdSuggestions.length,
    };
  }

  private async evaluateRule(
    rule: OptimizationRule,
    adAccount: AdAccount,
    recentExecutedActionKeys: Set<string>
  ): Promise<SuggestionCandidate[]> {
    const candidates: SuggestionCandidate[] = [];
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

      const minImpressions = Math.max(
        Number(rule.min_impressions_threshold || 0),
        this.getGlobalMinImpressions()
      );
      const minSpend = Math.max(
        Number(rule.min_spend_threshold || 0),
        this.getGlobalMinSpend()
      );

      if (metrics.impressions < minImpressions || metrics.spend < minSpend) {
        continue;
      }

      if (!evaluateConditions(conditions, metrics)) {
        continue;
      }

      for (const action of actions) {
        const candidate = this.buildCandidate({
          rule,
          adAccount,
          entityType: entityType as 'campaign' | 'ad_set' | 'ad',
          entityId,
          metaEntityId: entityData.metaEntityId,
          action,
          metrics,
          recentExecutedActionKeys,
        });

        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  private buildCandidate(input: {
    rule: OptimizationRule;
    adAccount: AdAccount;
    entityType: 'campaign' | 'ad_set' | 'ad';
    entityId: string;
    metaEntityId: string;
    action: RuleAction;
    metrics: PerformanceMetrics;
    recentExecutedActionKeys: Set<string>;
  }): SuggestionCandidate | null {
    const { rule, adAccount, entityType, entityId, metaEntityId, action, metrics, recentExecutedActionKeys } = input;

    if (action.type === 'duplicate' && entityType !== 'ad') {
      return null;
    }

    if (
      (action.type === 'increase_budget' || action.type === 'decrease_budget') &&
      entityType === 'ad'
    ) {
      return null;
    }

    const executedActionType = this.mapActionToExecutedActionType(action.type, entityType);
    if (executedActionType) {
      const cooldownKey = `${entityType}:${entityId}:${executedActionType}`;
      if (recentExecutedActionKeys.has(cooldownKey)) {
        return null;
      }
    }

    const confidence = this.calculateConfidence(metrics);
    if (confidence < this.getMinConfidenceThreshold()) {
      return null;
    }

    const suggestionType = this.mapActionToSuggestionType(action.type);
    const { title, description, reason, expectedImpact, proposedChanges } =
      this.generateSuggestionContent(action, entityType, metrics);

    return {
      rule,
      adAccount,
      entityType,
      entityId,
      metaEntityId,
      action,
      suggestionType,
      confidence,
      metrics,
      title,
      description,
      reason,
      expectedImpact,
      proposedChanges,
    };
  }

  private async persistSuggestion(candidate: SuggestionCandidate): Promise<OptimizationSuggestion> {
    return OptimizationSuggestion.create({
      id: uuidv4(),
      organization_id: candidate.adAccount.organization_id,
      ad_account_id: candidate.adAccount.id,
      rule_id: candidate.rule.id,
      entity_type: candidate.entityType,
      entity_id: candidate.entityId,
      meta_entity_id: candidate.metaEntityId,
      suggestion_type: candidate.suggestionType,
      title: candidate.title,
      description: candidate.description,
      reason: candidate.reason,
      expected_impact: candidate.expectedImpact,
      confidence_score: candidate.confidence,
      current_metrics: JSON.stringify(candidate.metrics),
      proposed_changes: JSON.stringify(candidate.proposedChanges),
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  private isCandidatePreferred(
    candidate: SuggestionCandidate,
    other: SuggestionCandidate
  ): boolean {
    if (candidate.rule.priority !== other.rule.priority) {
      return candidate.rule.priority > other.rule.priority;
    }

    const candidateRank = this.getSuggestionPriorityRank(candidate.suggestionType);
    const otherRank = this.getSuggestionPriorityRank(other.suggestionType);
    if (candidateRank !== otherRank) {
      return candidateRank > otherRank;
    }

    return candidate.confidence > other.confidence;
  }

  private isCandidatePreferredOverExisting(
    candidate: SuggestionCandidate,
    existing: ExistingPendingSuggestionMeta
  ): boolean {
    if (candidate.rule.priority !== existing.priority) {
      return candidate.rule.priority > existing.priority;
    }

    const candidateRank = this.getSuggestionPriorityRank(candidate.suggestionType);
    const existingRank = this.getSuggestionPriorityRank(existing.suggestionType);
    if (candidateRank !== existingRank) {
      return candidateRank > existingRank;
    }

    return candidate.confidence > existing.confidence;
  }

  private getBestExistingSuggestion(
    existingItems: ExistingPendingSuggestionMeta[]
  ): ExistingPendingSuggestionMeta | null {
    if (existingItems.length === 0) {
      return null;
    }

    return existingItems.reduce((best, current) => {
      if (!best) {
        return current;
      }

      if (current.priority !== best.priority) {
        return current.priority > best.priority ? current : best;
      }

      const currentRank = this.getSuggestionPriorityRank(current.suggestionType);
      const bestRank = this.getSuggestionPriorityRank(best.suggestionType);
      if (currentRank !== bestRank) {
        return currentRank > bestRank ? current : best;
      }

      return current.confidence > best.confidence ? current : best;
    }, null as ExistingPendingSuggestionMeta | null);
  }

  private getSuggestionPriorityRank(
    suggestionType: OptimizationSuggestion['suggestion_type']
  ): number {
    if (suggestionType === 'pause') {
      return 4;
    }
    if (suggestionType === 'decrease_budget') {
      return 3;
    }
    if (suggestionType === 'increase_budget') {
      return 2;
    }
    if (suggestionType === 'duplicate') {
      return 1;
    }
    return 0;
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

  private mapActionToExecutedActionType(
    actionType: RuleAction['type'],
    entityType: 'campaign' | 'ad_set' | 'ad'
  ): ExecutedAction['action_type'] | null {
    if (actionType === 'pause') {
      if (entityType === 'campaign') {
        return 'pause_campaign';
      }
      if (entityType === 'ad_set') {
        return 'pause_adset';
      }
      return 'pause_ad';
    }

    if (actionType === 'duplicate') {
      return 'duplicate_ad';
    }

    if (actionType === 'increase_budget') {
      return 'increase_budget';
    }

    if (actionType === 'decrease_budget') {
      return 'decrease_budget';
    }

    return null;
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
  ): 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget' {
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

  private getGlobalMinImpressions(): number {
    const parsed = Number.parseInt(process.env.OPTIMIZATION_MIN_IMPRESSIONS || '500', 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 500;
    }
    return parsed;
  }

  private getGlobalMinSpend(): number {
    const parsed = Number.parseFloat(process.env.OPTIMIZATION_MIN_SPEND || '20');
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 20;
    }
    return parsed;
  }

  private getMinConfidenceThreshold(): number {
    const parsed = Number.parseFloat(process.env.OPTIMIZATION_MIN_CONFIDENCE || '0.65');
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return 0.65;
    }
    return parsed;
  }

  private getSuggestionCooldownHours(): number {
    const parsed = Number.parseInt(process.env.OPTIMIZATION_SUGGESTION_COOLDOWN_HOURS || '24', 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 24;
    }
    return parsed;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export default new OptimizationEngine();
