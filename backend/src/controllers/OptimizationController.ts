import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth';
import { AdAccount, OptimizationRule, OptimizationSuggestion } from '../models';
import OptimizationEngine from '../services/OptimizationEngine';
import ActionExecutionService from '../services/ActionExecutionService';
import { AppError } from '../middleware/errorHandler';
import {
  requireArray,
  requireAuth,
  requireBoolean,
  requireString,
  parsePositiveInt,
} from '../utils/request';
import { type RuleCondition, validateRuleConditions } from '../utils/optimizationRules';

type SuggestionActionType =
  | 'pause_ad'
  | 'pause_adset'
  | 'pause_campaign'
  | 'duplicate_ad'
  | 'increase_budget'
  | 'decrease_budget'
  | 'modify_targeting'
  | 'modify_creative';

export class OptimizationController {
  async getRules(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);

    const rules = await OptimizationRule.findAll({
      where: { organization_id: user.organizationId },
      order: [['priority', 'DESC']],
    });

    res.json({
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        rule_type: rule.rule_type,
        is_active: rule.is_active,
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions),
        priority: rule.priority,
        min_spend_threshold: rule.min_spend_threshold,
        min_impressions_threshold: rule.min_impressions_threshold,
        evaluation_period_days: rule.evaluation_period_days,
        created_at: rule.created_at,
      })),
    });
  }

  async createRule(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const conditions = requireArray<RuleCondition>(req.body.conditions, 'conditions');
    const actions = requireArray(req.body.actions, 'actions');

    validateRuleConditions(conditions);

    const rule = await OptimizationRule.create({
      id: uuidv4(),
      organization_id: user.organizationId,
      name: requireString(req.body.name, 'name'),
      description:
        typeof req.body.description === 'string' && req.body.description.trim() !== ''
          ? req.body.description.trim()
          : null,
      rule_type: requireString(req.body.rule_type, 'rule_type') as OptimizationRule['rule_type'],
      is_active: true,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      priority: parsePositiveInt(req.body.priority, 'priority', 0, { min: 0 }),
      min_spend_threshold: Number(req.body.min_spend_threshold || 0),
      min_impressions_threshold: parsePositiveInt(
        req.body.min_impressions_threshold,
        'min_impressions_threshold',
        0,
        { min: 0 }
      ),
      evaluation_period_days: parsePositiveInt(
        req.body.evaluation_period_days,
        'evaluation_period_days',
        7,
        { min: 1, max: 365 }
      ),
    });

    res.status(201).json({
      rule: {
        id: rule.id,
        name: rule.name,
        rule_type: rule.rule_type,
        is_active: rule.is_active,
      },
    });
  }

  async updateRule(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;
    const updates = { ...req.body };

    const rule = await OptimizationRule.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!rule) {
      throw new AppError('Rule not found', 404);
    }

    if (updates.conditions) {
      const conditions = requireArray<RuleCondition>(updates.conditions, 'conditions');
      validateRuleConditions(conditions);
      updates.conditions = JSON.stringify(conditions);
    }

    if (updates.actions) {
      updates.actions = JSON.stringify(requireArray(updates.actions, 'actions'));
    }

    await rule.update(updates);
    res.json({ message: 'Rule updated' });
  }

  async deleteRule(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const rule = await OptimizationRule.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!rule) {
      throw new AppError('Rule not found', 404);
    }

    await rule.destroy();
    res.json({ message: 'Rule deleted' });
  }

  async toggleRule(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const rule = await OptimizationRule.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!rule) {
      throw new AppError('Rule not found', 404);
    }

    await rule.update({ is_active: requireBoolean(req.body.is_active, 'is_active') });
    res.json({ message: 'Rule updated' });
  }

  async getSuggestions(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const adAccountId =
      typeof req.query.ad_account_id === 'string' ? req.query.ad_account_id : undefined;

    const where: Record<string, unknown> = {
      organization_id: user.organizationId,
      status:
        status === 'all' ? { [Op.in]: ['pending', 'accepted', 'rejected', 'executed', 'expired'] } : status,
    };

    if (adAccountId) {
      where.ad_account_id = adAccountId;
    }

    const suggestions = await OptimizationSuggestion.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    res.json({
      suggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        suggestion_type: suggestion.suggestion_type,
        entity_type: suggestion.entity_type,
        status: suggestion.status,
        confidence_score: suggestion.confidence_score,
        expected_impact: suggestion.expected_impact,
        created_at: suggestion.created_at,
        expires_at: suggestion.expires_at,
      })),
    });
  }

  async getSuggestion(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const suggestion = await OptimizationSuggestion.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!suggestion) {
      throw new AppError('Suggestion not found', 404);
    }

    res.json({
      suggestion: {
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        reason: suggestion.reason,
        suggestion_type: suggestion.suggestion_type,
        entity_type: suggestion.entity_type,
        meta_entity_id: suggestion.meta_entity_id,
        status: suggestion.status,
        confidence_score: suggestion.confidence_score,
        expected_impact: suggestion.expected_impact,
        current_metrics: suggestion.current_metrics ? JSON.parse(suggestion.current_metrics) : null,
        proposed_changes: suggestion.proposed_changes
          ? JSON.parse(suggestion.proposed_changes)
          : null,
        created_at: suggestion.created_at,
        expires_at: suggestion.expires_at,
      },
    });
  }

  async acceptSuggestion(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;
    const execute = Boolean(req.body.execute);

    const suggestion = await OptimizationSuggestion.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!suggestion) {
      throw new AppError('Suggestion not found', 404);
    }

    await suggestion.update({
      status: 'accepted',
      reviewed_by: user.userId,
      reviewed_at: new Date(),
    });

    if (!execute) {
      res.json({ message: 'Suggestion accepted' });
      return;
    }

    const action = await ActionExecutionService.executeAction({
      organizationId: user.organizationId,
      adAccountId: suggestion.ad_account_id,
      suggestionId: suggestion.id,
      actionType: this.mapSuggestionToActionType(
        suggestion.suggestion_type,
        suggestion.entity_type
      ),
      entityType: suggestion.entity_type,
      entityId: suggestion.entity_id,
      executionMethod: 'manual',
      executedBy: user.userId,
    });

    res.json({
      message: 'Suggestion accepted and executed',
      action: {
        id: action.id,
        status: action.status,
      },
    });
  }

  async rejectSuggestion(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const { id } = req.params;

    const suggestion = await OptimizationSuggestion.findOne({
      where: { id, organization_id: user.organizationId },
    });

    if (!suggestion) {
      throw new AppError('Suggestion not found', 404);
    }

    await suggestion.update({
      status: 'rejected',
      reviewed_by: user.userId,
      reviewed_at: new Date(),
    });

    res.json({ message: 'Suggestion rejected' });
  }

  async runOptimization(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const adAccountId = requireString(req.body.ad_account_id, 'ad_account_id');

    const adAccount = await AdAccount.findOne({
      where: { id: adAccountId, organization_id: user.organizationId },
    });

    if (!adAccount) {
      throw new AppError('Ad account not found', 404);
    }

    const result = await OptimizationEngine.evaluateAdAccount(adAccount.id);

    res.json({
      rules_evaluated: result.rulesEvaluated,
      suggestions_generated: result.suggestionsGenerated,
      suggestions: result.suggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        suggestion_type: suggestion.suggestion_type,
        entity_type: suggestion.entity_type,
      })),
    });
  }

  private mapSuggestionToActionType(
    suggestionType: string,
    entityType: 'campaign' | 'ad_set' | 'ad'
  ): SuggestionActionType {
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
      return 'duplicate_ad';
    }

    if (suggestionType === 'increase_budget') {
      return 'increase_budget';
    }

    if (suggestionType === 'decrease_budget') {
      return 'decrease_budget';
    }

    return 'pause_ad';
  }
}

export default new OptimizationController();
