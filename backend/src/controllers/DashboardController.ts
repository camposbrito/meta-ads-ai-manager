import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth';
import {
  AdAccount,
  Campaign,
  AdSet,
  Ad,
  Insight,
  OptimizationSuggestion,
  ExecutedAction,
} from '../models';

export class DashboardController {
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { days = 30 } = req.query;
      const daysNum = parseInt(days as string, 10) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const adAccounts = await AdAccount.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
      });

      const adAccountIds = adAccounts.map((acc) => acc.id);

      // Get aggregated insights
      const insights = await Insight.findAll({
        where: {
          ad_account_id: { [Op.in]: adAccountIds },
          date: { [Op.gte]: startDate.toISOString().split('T')[0] },
        },
      });

      // Calculate totals
      const totals = insights.reduce(
        (acc, insight) => ({
          spend: acc.spend + insight.spend,
          impressions: acc.impressions + insight.impressions,
          clicks: acc.clicks + insight.clicks,
          conversions: acc.conversions + insight.conversions,
          conversion_value: acc.conversion_value + insight.conversion_value,
        }),
        { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }
      );

      // Get pending suggestions count
      const pendingSuggestions = await OptimizationSuggestion.count({
        where: {
          organization_id: req.user.organizationId,
          status: 'pending',
        },
      });

      // Get recent actions
      const recentActions = await ExecutedAction.findAll({
        where: { organization_id: req.user.organizationId },
        order: [['created_at', 'DESC']],
        limit: 5,
      });

      res.json({
        overview: {
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_conversions: totals.conversions,
          total_revenue: totals.conversion_value,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
          cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
          roas: totals.spend > 0 ? totals.conversion_value / totals.spend : 0,
        },
        connected_accounts: adAccounts.length,
        pending_suggestions: pendingSuggestions,
        recent_actions: recentActions.map((action) => ({
          id: action.id,
          action_type: action.action_type,
          entity_type: action.entity_type,
          status: action.status,
          created_at: action.created_at,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getPerformanceChart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { days = 30, groupBy = 'date' } = req.query;
      const daysNum = parseInt(days as string, 10) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const adAccounts = await AdAccount.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
      });

      const adAccountIds = adAccounts.map((acc) => acc.id);

      const insights = await Insight.findAll({
        where: {
          ad_account_id: { [Op.in]: adAccountIds },
          date: { [Op.gte]: startDate.toISOString().split('T')[0] },
        },
        order: [['date', 'ASC']],
      });

      // Group by date
      const grouped: Record<string, any> = {};
      for (const insight of insights) {
        const key = insight.date;
        if (!grouped[key]) {
          grouped[key] = {
            date: key,
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_value: 0,
          };
        }
        grouped[key].spend += insight.spend;
        grouped[key].impressions += insight.impressions;
        grouped[key].clicks += insight.clicks;
        grouped[key].conversions += insight.conversions;
        grouped[key].conversion_value += insight.conversion_value;
      }

      const chartData = Object.values(grouped).map((item: any) => ({
        ...item,
        ctr: item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : 0,
        cpc: item.clicks > 0 ? (item.spend / item.clicks).toFixed(2) : 0,
        cpa: item.conversions > 0 ? (item.spend / item.conversions).toFixed(2) : 0,
        roas: item.spend > 0 ? (item.conversion_value / item.spend).toFixed(2) : 0,
      }));

      res.json({ data: chartData });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const adAccounts = await AdAccount.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
      });

      const adAccountIds = adAccounts.map((acc) => acc.id);

      const campaigns = await Campaign.findAll({
        where: { ad_account_id: { [Op.in]: adAccountIds }, is_active: true },
        include: [
          {
            model: AdAccount,
            as: 'ad_account',
            attributes: ['id', 'name'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      res.json({
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          daily_budget: c.daily_budget,
          ad_account_name: c.ad_account?.name,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTopAds(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { days = 7, limit = 10 } = req.query;
      const daysNum = parseInt(days as string, 10) || 7;
      const limitNum = parseInt(limit as string, 10) || 10;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const adAccounts = await AdAccount.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
      });

      const adAccountIds = adAccounts.map((acc) => acc.id);

      // Get top ads by conversions
      const insights = await Insight.findAll({
        where: {
          ad_account_id: { [Op.in]: adAccountIds },
          ad_id: { [Op.ne]: null },
          date: { [Op.gte]: startDate.toISOString().split('T')[0] },
        },
        attributes: [
          'ad_id',
          [Insight.sequelize!.fn('SUM', Insight.sequelize!.col('spend')), 'spend'],
          [Insight.sequelize!.fn('SUM', Insight.sequelize!.col('clicks')), 'clicks'],
          [Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversions')), 'conversions'],
          [Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversion_value')), 'conversion_value'],
          [Insight.sequelize!.fn('SUM', Insight.sequelize!.col('impressions')), 'impressions'],
        ],
        group: ['ad_id'],
        order: [[Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversions')), 'DESC']],
        limit: limitNum,
        include: [
          {
            model: Ad,
            as: 'ad',
            attributes: ['id', 'name', 'headline', 'status'],
          },
        ],
      });

      res.json({
        ads: insights.map((i: any) => ({
          id: i.ad_id,
          name: i.ad?.name,
          headline: i.ad?.headline,
          status: i.ad?.status,
          spend: parseFloat(i.dataValues.spend),
          clicks: parseInt(i.dataValues.clicks),
          conversions: parseInt(i.dataValues.conversions),
          revenue: parseFloat(i.dataValues.conversion_value),
          impressions: parseInt(i.dataValues.impressions),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new DashboardController();
