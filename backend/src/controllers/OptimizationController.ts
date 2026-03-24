import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { OptimizationRule, OptimizationSuggestion, AdAccount } from '../models';
import OptimizationEngine from '../services/OptimizationEngine';
import ActionExecutionService from '../services/ActionExecutionService';

export class OptimizationController {
  async getRules(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const rules = await OptimizationRule.findAll({
        where: { organization_id: req.user.organizationId },
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
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const {
        name,
        description,
        rule_type,
        conditions,
        actions,
        priority = 0,
        min_spend_threshold = 0,
        min_impressions_threshold = 0,
        evaluation_period_days = 7,
      } = req.body;

      if (!name || !rule_type || !conditions || !actions) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const rule = await OptimizationRule.create({
        id: uuidv4(),
        organization_id: req.user.organizationId,
        name,
        description: description || null,
        rule_type,
        is_active: true,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions),
        priority,
        min_spend_threshold,
        min_impressions_threshold,
        evaluation_period_days,
      });

      res.status(201).json({
        rule: {
          id: rule.id,
          name: rule.name,
          rule_type: rule.rule_type,
          is_active: rule.is_active,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const rule = await OptimizationRule.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!rule) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }

      if (updates.conditions) {
        updates.conditions = JSON.stringify(updates.conditions);
      }
      if (updates.actions) {
        updates.actions = JSON.stringify(updates.actions);
      }

      await rule.update(updates);

      res.json({ message: 'Rule updated' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const rule = await OptimizationRule.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!rule) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }

      await rule.destroy();

      res.json({ message: 'Rule deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async toggleRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { is_active } = req.body;

      const rule = await OptimizationRule.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!rule) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }

      await rule.update({ is_active });

      res.json({ message: 'Rule updated' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSuggestions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { status = 'pending', ad_account_id } = req.query;

      const where: any = {
        organization_id: req.user.organizationId,
        status: status || { [require('sequelize').Op.in]: ['pending', 'accepted', 'rejected', 'executed'] },
      };

      if (ad_account_id) {
        where.ad_account_id = ad_account_id;
      }

      const suggestions = await OptimizationSuggestion.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 50,
      });

      res.json({
        suggestions: suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          suggestion_type: s.suggestion_type,
          entity_type: s.entity_type,
          status: s.status,
          confidence_score: s.confidence_score,
          expected_impact: s.expected_impact,
          created_at: s.created_at,
          expires_at: s.expires_at,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const suggestion = await OptimizationSuggestion.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!suggestion) {
        res.status(404).json({ error: 'Suggestion not found' });
        return;
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
          proposed_changes: suggestion.proposed_changes ? JSON.parse(suggestion.proposed_changes) : null,
          created_at: suggestion.created_at,
          expires_at: suggestion.expires_at,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async acceptSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { execute = false } = req.body;

      const suggestion = await OptimizationSuggestion.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!suggestion) {
        res.status(404).json({ error: 'Suggestion not found' });
        return;
      }

      await suggestion.update({
        status: 'accepted',
        reviewed_by: req.user.userId,
        reviewed_at: new Date(),
      });

      if (execute) {
        const action = await ActionExecutionService.executeAction({
          organizationId: req.user.organizationId!,
          adAccountId: suggestion.ad_account_id,
          suggestionId: suggestion.id,
          actionType: this.mapSuggestionToActionType(suggestion.suggestion_type),
          entityType: suggestion.entity_type,
          entityId: suggestion.entity_id,
          executionMethod: 'manual',
          executedBy: req.user.userId,
        });

        res.json({
          message: 'Suggestion accepted and executed',
          action: {
            id: action.id,
            status: action.status,
          },
        });
        return;
      }

      res.json({ message: 'Suggestion accepted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async rejectSuggestion(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;

      const suggestion = await OptimizationSuggestion.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!suggestion) {
        res.status(404).json({ error: 'Suggestion not found' });
        return;
      }

      await suggestion.update({
        status: 'rejected',
        reviewed_by: req.user.userId,
        reviewed_at: new Date(),
      });

      res.json({ message: 'Suggestion rejected' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async runOptimization(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { ad_account_id } = req.body;

      if (!ad_account_id) {
        res.status(400).json({ error: 'ad_account_id required' });
        return;
      }

      const adAccount = await AdAccount.findOne({
        where: { id: ad_account_id, organization_id: req.user.organizationId },
      });

      if (!adAccount) {
        res.status(404).json({ error: 'Ad account not found' });
        return;
      }

      const result = await OptimizationEngine.evaluateAdAccount(adAccount.id);

      res.json({
        rules_evaluated: result.rulesEvaluated,
        suggestions_generated: result.suggestionsGenerated,
        suggestions: result.suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          suggestion_type: s.suggestion_type,
          entity_type: s.entity_type,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private mapSuggestionToActionType(
    suggestionType: string
  ): 'pause_ad' | 'pause_adset' | 'pause_campaign' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative' {
    switch (suggestionType) {
      case 'pause':
        return 'pause_ad';
      case 'duplicate':
        return 'duplicate_ad';
      case 'increase_budget':
        return 'increase_budget';
      case 'decrease_budget':
        return 'decrease_budget';
      default:
        return 'pause_ad';
    }
  }
}

export default new OptimizationController();
