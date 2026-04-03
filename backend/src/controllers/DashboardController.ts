import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth';
import {
  Ad,
  AdAccount,
  Campaign,
  ExecutedAction,
  Insight,
  OptimizationSuggestion,
} from '../models';
import { calculatePerformanceMetrics } from '../utils/metrics';
import { AppError } from '../middleware/errorHandler';
import { parsePositiveInt, requireAuth, requireString } from '../utils/request';

export class DashboardController {
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const daysNum = parsePositiveInt(req.query.days, 'days', 30, { min: 1, max: 365 });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    const endDate = new Date();
    const previousEndDate = new Date(startDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - (daysNum - 1));
    const periodLabel = `${this.formatDate(startDate)}..${this.formatDate(endDate)}`;
    const previousPeriodLabel = `${this.formatDate(previousStartDate)}..${this.formatDate(previousEndDate)}`;

    const adAccounts = await AdAccount.findAll({
      where: { organization_id: user.organizationId, is_active: true },
      attributes: ['id', 'last_synced_at'],
    });

    const adAccountIds = adAccounts.map((account) => account.id);
    const pendingSuggestions = await OptimizationSuggestion.count({
      where: {
        organization_id: user.organizationId,
        status: 'pending',
      },
    });
    const recentActions = await ExecutedAction.findAll({
      where: { organization_id: user.organizationId },
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    const latestSyncAt = this.getLatestSyncAt(adAccounts);
    const emptyOverview = this.toOverviewPayload(this.emptyPerformance());
    const emptyComparison = this.toComparisonPayload(emptyOverview, emptyOverview);

    if (adAccountIds.length === 0) {
      res.json({
        overview: emptyOverview,
        previous_overview: emptyOverview,
        comparison: emptyComparison,
        meta: {
          source_level: 'account',
          window_days: daysNum,
          compared_window_days: daysNum,
          period: periodLabel,
          compared_period: previousPeriodLabel,
          last_synced_at: latestSyncAt,
        },
        connected_accounts: 0,
        pending_suggestions: pendingSuggestions,
        recent_actions: recentActions,
      });
      return;
    }

    const totals = await this.getAccountLevelTotals(adAccountIds, {
      [Op.between]: [this.formatDate(startDate), this.formatDate(endDate)],
    });
    const previousTotals = await this.getAccountLevelTotals(adAccountIds, {
      [Op.between]: [this.formatDate(previousStartDate), this.formatDate(previousEndDate)],
    });
    const overviewPayload = this.toOverviewPayload(totals);
    const previousOverviewPayload = this.toOverviewPayload(previousTotals);

    res.json({
      overview: overviewPayload,
      previous_overview: previousOverviewPayload,
      comparison: this.toComparisonPayload(overviewPayload, previousOverviewPayload),
      meta: {
        source_level: 'account',
        window_days: daysNum,
        compared_window_days: daysNum,
        period: periodLabel,
        compared_period: previousPeriodLabel,
        last_synced_at: latestSyncAt,
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
  }

  async getPerformanceChart(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const daysNum = parsePositiveInt(req.query.days, 'days', 30, { min: 1, max: 365 });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    const endDate = new Date();

    const adAccounts = await AdAccount.findAll({
      where: { organization_id: user.organizationId, is_active: true },
      attributes: ['id', 'last_synced_at'],
    });

    const insights = await Insight.findAll({
      where: {
        ad_account_id: { [Op.in]: adAccounts.map((account) => account.id) },
        campaign_id: null,
        ad_set_id: null,
        ad_id: null,
        date: {
          [Op.between]: [this.formatDate(startDate), this.formatDate(endDate)],
        },
      },
      order: [['date', 'ASC']],
    });

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

      grouped[key].spend += Number(insight.spend);
      grouped[key].impressions += Number(insight.impressions);
      grouped[key].clicks += Number(insight.clicks);
      grouped[key].conversions += Number(insight.conversions);
      grouped[key].conversion_value += Number(insight.conversion_value);
    }

    res.json({
      data: Object.values(grouped).map((item: any) => ({
        ...item,
        ctr: item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : 0,
        cpc: item.clicks > 0 ? (item.spend / item.clicks).toFixed(2) : 0,
        cpa: item.conversions > 0 ? (item.spend / item.conversions).toFixed(2) : 0,
        roas: item.spend > 0 ? (item.conversion_value / item.spend).toFixed(2) : 0,
      })),
      meta: {
        source_level: 'account',
        window_days: daysNum,
        period: `${this.formatDate(startDate)}..${this.formatDate(endDate)}`,
        last_synced_at: this.getLatestSyncAt(adAccounts),
      },
    });
  }

  async getCampaigns(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const daysNum = parsePositiveInt(req.query.days, 'days', 30, { min: 1, max: 365 });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const adAccounts = await AdAccount.findAll({
      where: { organization_id: user.organizationId, is_active: true },
      attributes: ['id', 'last_synced_at'],
    });

    const campaigns = await Campaign.findAll({
      where: { ad_account_id: { [Op.in]: adAccounts.map((account) => account.id) }, is_active: true },
      include: [
        {
          model: AdAccount,
          as: 'adAccount',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const metricsByCampaign = new Map<string, ReturnType<typeof calculatePerformanceMetrics>>();

    if (campaignIds.length > 0) {
      const insightRows = (await Insight.findAll({
        where: {
          campaign_id: { [Op.in]: campaignIds },
          ad_set_id: null,
          ad_id: null,
          date: { [Op.gte]: startDate.toISOString().split('T')[0] },
        },
        attributes: [
          'campaign_id',
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('spend')), 0), 'spend'],
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('impressions')), 0), 'impressions'],
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('clicks')), 0), 'clicks'],
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversions')), 0), 'conversions'],
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversion_value')), 0), 'conversion_value'],
          [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('reach')), 0), 'reach'],
        ],
        group: ['campaign_id'],
        raw: true,
      })) as unknown as Array<Record<string, string | null>>;

      for (const row of insightRows) {
        const campaignId = row.campaign_id;
        if (!campaignId) {
          continue;
        }

        metricsByCampaign.set(
          campaignId,
          calculatePerformanceMetrics({
            spend: Number(row.spend || 0),
            impressions: Number(row.impressions || 0),
            clicks: Number(row.clicks || 0),
            conversions: Number(row.conversions || 0),
            conversionValue: Number(row.conversion_value || 0),
            reach: Number(row.reach || 0),
          })
        );
      }
    }

    const emptyPerformance = calculatePerformanceMetrics({
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
      reach: 0,
    });

    res.json({
      campaigns: campaigns.map((campaign) => {
        const metrics = metricsByCampaign.get(campaign.id) || emptyPerformance;

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget != null ? Number(campaign.daily_budget) : null,
          ad_account_id: campaign.ad_account_id,
          ad_account_name: campaign.adAccount?.name,
          spend: metrics.spend,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          conversions: metrics.conversions,
          revenue: metrics.conversionValue,
          ctr: metrics.ctr * 100,
          cpc: metrics.cpc,
          cpa: metrics.cpa,
          roas: metrics.roas,
        };
      }),
      meta: {
        source_level: 'campaign',
        window_days: daysNum,
        period: `${this.formatDate(startDate)}..${this.formatDate(new Date())}`,
        last_synced_at: this.getLatestSyncAt(adAccounts),
      },
    });
  }

  async getCampaignAds(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const campaignId = requireString(req.params.campaignId, 'campaignId');
    const daysNum = parsePositiveInt(req.query.days, 'days', 30, { min: 1, max: 365 });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const campaign = await Campaign.findOne({
      where: { id: campaignId, is_active: true },
      include: [
        {
          model: AdAccount,
          as: 'adAccount',
          attributes: ['id', 'organization_id', 'name'],
        },
      ],
    });

    if (!campaign || !campaign.adAccount || campaign.adAccount.organization_id !== user.organizationId) {
      throw new AppError('Campaign not found', 404);
    }

    const insights = await Insight.findAll({
      where: {
        campaign_id: campaign.id,
        ad_id: { [Op.ne]: null },
        date: { [Op.gte]: startDate.toISOString().split('T')[0] },
      },
      attributes: [
        'ad_id',
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('spend')), 0), 'spend'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('impressions')), 0), 'impressions'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('clicks')), 0), 'clicks'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversions')), 0), 'conversions'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversion_value')), 0), 'conversion_value'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('reach')), 0), 'reach'],
      ],
      group: ['ad_id', 'ad.id'],
      include: [
        {
          model: Ad,
          as: 'ad',
          attributes: ['id', 'name', 'headline', 'status'],
        },
      ],
      order: [[Insight.sequelize!.fn('SUM', Insight.sequelize!.col('spend')), 'DESC']],
    });

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      ads: insights.map((insight: any) => {
        const performance = calculatePerformanceMetrics({
          spend: Number(insight.dataValues.spend || 0),
          impressions: Number(insight.dataValues.impressions || 0),
          clicks: Number(insight.dataValues.clicks || 0),
          conversions: Number(insight.dataValues.conversions || 0),
          conversionValue: Number(insight.dataValues.conversion_value || 0),
          reach: Number(insight.dataValues.reach || 0),
        });

        return {
          id: insight.ad_id,
          name: insight.ad?.name || '-',
          headline: insight.ad?.headline || null,
          status: insight.ad?.status || 'UNKNOWN',
          spend: performance.spend,
          impressions: performance.impressions,
          clicks: performance.clicks,
          conversions: performance.conversions,
          revenue: performance.conversionValue,
          ctr: performance.ctr * 100,
          cpc: performance.cpc,
          cpa: performance.cpa,
          roas: performance.roas,
        };
      }),
      meta: {
        source_level: 'ad',
        window_days: daysNum,
        account_name: campaign.adAccount.name,
      },
    });
  }

  async getTopAds(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const daysNum = parsePositiveInt(req.query.days, 'days', 7, { min: 1, max: 365 });
    const limitNum = parsePositiveInt(req.query.limit, 'limit', 10, { min: 1, max: 100 });
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const adAccounts = await AdAccount.findAll({
      where: { organization_id: user.organizationId, is_active: true },
      attributes: ['id', 'last_synced_at'],
    });

    const insights = await Insight.findAll({
      where: {
        ad_account_id: { [Op.in]: adAccounts.map((account) => account.id) },
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
      group: ['ad_id', 'ad.id'],
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
      ads: insights.map((insight: any) => ({
        id: insight.ad_id,
        name: insight.ad?.name,
        headline: insight.ad?.headline,
        status: insight.ad?.status,
        spend: parseFloat(insight.dataValues.spend),
        clicks: parseInt(insight.dataValues.clicks, 10),
        conversions: parseInt(insight.dataValues.conversions, 10),
        revenue: parseFloat(insight.dataValues.conversion_value),
        impressions: parseInt(insight.dataValues.impressions, 10),
      })),
      meta: {
        source_level: 'ad',
        window_days: daysNum,
        period: `${this.formatDate(startDate)}..${this.formatDate(new Date())}`,
        last_synced_at: this.getLatestSyncAt(adAccounts),
      },
    });
  }

  private async getAccountLevelTotals(
    adAccountIds: string[],
    dateFilter: Record<string, unknown>
  ): Promise<ReturnType<typeof calculatePerformanceMetrics>> {
    const totalsRow = (await Insight.findOne({
      where: {
        ad_account_id: { [Op.in]: adAccountIds },
        campaign_id: null,
        ad_set_id: null,
        ad_id: null,
        date: dateFilter,
      },
      attributes: [
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('spend')), 0), 'spend'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('impressions')), 0), 'impressions'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('clicks')), 0), 'clicks'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversions')), 0), 'conversions'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('conversion_value')), 0), 'conversion_value'],
        [Insight.sequelize!.fn('COALESCE', Insight.sequelize!.fn('SUM', Insight.sequelize!.col('reach')), 0), 'reach'],
      ],
      raw: true,
    })) as Record<string, string> | null;

    return calculatePerformanceMetrics({
      spend: Number(totalsRow?.spend || 0),
      impressions: Number(totalsRow?.impressions || 0),
      clicks: Number(totalsRow?.clicks || 0),
      conversions: Number(totalsRow?.conversions || 0),
      conversionValue: Number(totalsRow?.conversion_value || 0),
      reach: Number(totalsRow?.reach || 0),
    });
  }

  private emptyPerformance(): ReturnType<typeof calculatePerformanceMetrics> {
    return calculatePerformanceMetrics({
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
      reach: 0,
    });
  }

  private toOverviewPayload(metrics: ReturnType<typeof calculatePerformanceMetrics>) {
    return {
      total_spend: metrics.spend,
      total_impressions: metrics.impressions,
      total_clicks: metrics.clicks,
      total_conversions: metrics.conversions,
      total_revenue: metrics.conversionValue,
      ctr: metrics.ctr * 100,
      cpc: metrics.cpc,
      cpa: metrics.cpa,
      roas: metrics.roas,
    };
  }

  private toComparisonPayload(
    current: ReturnType<DashboardController['toOverviewPayload']>,
    previous: ReturnType<DashboardController['toOverviewPayload']>
  ) {
    return {
      spend_change_pct: this.calculateChangePct(current.total_spend, previous.total_spend),
      impressions_change_pct: this.calculateChangePct(
        current.total_impressions,
        previous.total_impressions
      ),
      clicks_change_pct: this.calculateChangePct(current.total_clicks, previous.total_clicks),
      conversions_change_pct: this.calculateChangePct(
        current.total_conversions,
        previous.total_conversions
      ),
      revenue_change_pct: this.calculateChangePct(current.total_revenue, previous.total_revenue),
      ctr_change_pct: this.calculateChangePct(current.ctr, previous.ctr),
      cpc_change_pct: this.calculateChangePct(current.cpc, previous.cpc),
      cpa_change_pct: this.calculateChangePct(current.cpa, previous.cpa),
      roas_change_pct: this.calculateChangePct(current.roas, previous.roas),
    };
  }

  private calculateChangePct(current: number, previous: number): number {
    if (previous === 0) {
      if (current === 0) {
        return 0;
      }
      return 100;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private getLatestSyncAt(
    adAccounts: Array<Pick<AdAccount, 'last_synced_at'>>
  ): string | null {
    let latest: Date | null = null;

    for (const account of adAccounts) {
      const currentDate = account.last_synced_at ? new Date(account.last_synced_at) : null;
      if (!currentDate) {
        continue;
      }

      if (!latest || currentDate > latest) {
        latest = currentDate;
      }
    }

    return latest ? latest.toISOString() : null;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export default new DashboardController();
