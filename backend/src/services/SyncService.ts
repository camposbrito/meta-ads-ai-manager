import { v4 as uuidv4 } from 'uuid';
import MetaApiService, { MetaAd, MetaAdSet, MetaCampaign, MetaInsight } from './MetaApiService';
import { Ad, AdAccount, AdSet, Campaign, Insight, Organization, SyncJob } from '../models';
import { AppError } from '../middleware/errorHandler';

interface SyncExecutionOptions {
  existingJobId?: string;
}

export class SyncService {
  async syncAdAccount(
    adAccountId: string,
    jobType: 'full_sync' | 'incremental_sync' | 'insights_sync' = 'full_sync',
    options: SyncExecutionOptions = {}
  ): Promise<void> {
    let syncJob: SyncJob | null = null;

    if (options.existingJobId) {
      syncJob = await SyncJob.findOne({
        where: {
          id: options.existingJobId,
          ad_account_id: adAccountId,
        },
      });

      if (!syncJob) {
        throw new AppError('Sync job not found', 404);
      }
    }

    if (!syncJob) {
      syncJob = await SyncJob.create({
        id: uuidv4(),
        ad_account_id: adAccountId,
        job_type: jobType,
        status: 'pending',
        records_synced: 0,
      });
    }

    try {
      await syncJob.update({
        job_type: jobType,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
        error_message: null,
      });

      const adAccount = await AdAccount.findByPk(adAccountId, {
        include: [{ model: Organization, as: 'organization' }],
      });

      if (!adAccount) {
        throw new AppError('Ad account not found', 404);
      }

      let recordsSynced = 0;
      let campaignMap = new Map<string, Campaign>();
      let adSetMap = new Map<string, AdSet>();
      let adMap = new Map<string, Ad>();

      if (jobType === 'full_sync' || jobType === 'incremental_sync') {
        const campaigns = await MetaApiService.getCampaigns(adAccount);
        campaignMap = await this.loadCampaignMap(campaigns.map((campaign) => campaign.id));

        for (const metaCampaign of campaigns) {
          await this.syncCampaign(adAccount.id, metaCampaign, campaignMap);
          recordsSynced++;
        }

        const adSets = await MetaApiService.getAdSets(adAccount);
        adSetMap = await this.loadAdSetMap(adSets.map((adSet) => adSet.id));

        for (const metaAdSet of adSets) {
          await this.syncAdSet(metaAdSet, campaignMap, adSetMap);
          recordsSynced++;
        }

        const ads = await MetaApiService.getAds(adAccount);
        adMap = await this.loadAdMap(ads.map((ad) => ad.id));

        for (const metaAd of ads) {
          await this.syncAd(metaAd, adSetMap, adMap);
          recordsSynced++;
        }
      } else {
        campaignMap = await this.loadCampaignMapByAdAccount(adAccount.id);
        adSetMap = await this.loadAdSetMapByCampaignIds(
          Array.from(campaignMap.values()).map((campaign) => campaign.id)
        );
        adMap = await this.loadAdMapByAdSetIds(
          Array.from(adSetMap.values()).map((adSet) => adSet.id)
        );
      }

      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateRange = {
        since: this.formatDate(thirtyDaysAgo),
        until: this.formatDate(today),
      };

      recordsSynced += await this.syncAccountInsights(adAccount, dateRange);
      recordsSynced += await this.syncCampaignInsights(adAccount, campaignMap, dateRange);
      recordsSynced += await this.syncAdSetInsights(adAccount, adSetMap, dateRange);
      recordsSynced += await this.syncAdInsights(adAccount, adMap, adSetMap, dateRange);

      await adAccount.update({
        last_synced_at: new Date(),
        daily_sync_count: adAccount.daily_sync_count + 1,
        last_sync_date: this.formatDate(new Date()),
      });

      await syncJob.update({
        status: 'completed',
        completed_at: new Date(),
        records_synced: recordsSynced,
      });
    } catch (error) {
      await syncJob.update({
        status: 'failed',
        completed_at: new Date(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async loadCampaignMap(metaCampaignIds: string[]): Promise<Map<string, Campaign>> {
    if (metaCampaignIds.length === 0) {
      return new Map();
    }

    const campaigns = await Campaign.findAll({
      where: { meta_campaign_id: metaCampaignIds },
    });

    return new Map(campaigns.map((campaign) => [campaign.meta_campaign_id, campaign]));
  }

  private async loadAdSetMap(metaAdSetIds: string[]): Promise<Map<string, AdSet>> {
    if (metaAdSetIds.length === 0) {
      return new Map();
    }

    const adSets = await AdSet.findAll({
      where: { meta_adset_id: metaAdSetIds },
    });

    return new Map(adSets.map((adSet) => [adSet.meta_adset_id, adSet]));
  }

  private async loadAdMap(metaAdIds: string[]): Promise<Map<string, Ad>> {
    if (metaAdIds.length === 0) {
      return new Map();
    }

    const ads = await Ad.findAll({
      where: { meta_ad_id: metaAdIds },
    });

    return new Map(ads.map((ad) => [ad.meta_ad_id, ad]));
  }

  private async loadCampaignMapByAdAccount(adAccountId: string): Promise<Map<string, Campaign>> {
    const campaigns = await Campaign.findAll({
      where: { ad_account_id: adAccountId, is_active: true },
    });

    return new Map(campaigns.map((campaign) => [campaign.meta_campaign_id, campaign]));
  }

  private async loadAdSetMapByCampaignIds(campaignIds: string[]): Promise<Map<string, AdSet>> {
    if (campaignIds.length === 0) {
      return new Map();
    }

    const adSets = await AdSet.findAll({
      where: { campaign_id: campaignIds, is_active: true },
    });

    return new Map(adSets.map((adSet) => [adSet.meta_adset_id, adSet]));
  }

  private async loadAdMapByAdSetIds(adSetIds: string[]): Promise<Map<string, Ad>> {
    if (adSetIds.length === 0) {
      return new Map();
    }

    const ads = await Ad.findAll({
      where: { ad_set_id: adSetIds, is_active: true },
    });

    return new Map(ads.map((ad) => [ad.meta_ad_id, ad]));
  }

  private async syncAccountInsights(
    adAccount: AdAccount,
    dateRange: { since: string; until: string }
  ): Promise<number> {
    const insights = await MetaApiService.getInsights(adAccount, 'account', undefined, dateRange);
    let synced = 0;

    for (const metaInsight of insights) {
      await this.syncInsight(adAccount.id, metaInsight, null, null, null);
      synced++;
    }

    return synced;
  }

  private async syncCampaignInsights(
    adAccount: AdAccount,
    campaignMap: Map<string, Campaign>,
    dateRange: { since: string; until: string }
  ): Promise<number> {
    let synced = 0;

    for (const campaign of campaignMap.values()) {
      const insights = await MetaApiService.getInsights(
        adAccount,
        'campaign',
        campaign.meta_campaign_id,
        dateRange
      );

      for (const metaInsight of insights) {
        await this.syncInsight(adAccount.id, metaInsight, campaign.id, null, null);
        synced++;
      }
    }

    return synced;
  }

  private async syncAdSetInsights(
    adAccount: AdAccount,
    adSetMap: Map<string, AdSet>,
    dateRange: { since: string; until: string }
  ): Promise<number> {
    let synced = 0;

    for (const adSet of adSetMap.values()) {
      const insights = await MetaApiService.getInsights(
        adAccount,
        'adset',
        adSet.meta_adset_id,
        dateRange
      );

      for (const metaInsight of insights) {
        await this.syncInsight(adAccount.id, metaInsight, adSet.campaign_id, adSet.id, null);
        synced++;
      }
    }

    return synced;
  }

  private async syncAdInsights(
    adAccount: AdAccount,
    adMap: Map<string, Ad>,
    adSetMap: Map<string, AdSet>,
    dateRange: { since: string; until: string }
  ): Promise<number> {
    let synced = 0;
    const adSetsById = new Map<string, AdSet>();

    for (const adSet of adSetMap.values()) {
      adSetsById.set(adSet.id, adSet);
    }

    for (const ad of adMap.values()) {
      const insights = await MetaApiService.getInsights(adAccount, 'ad', ad.meta_ad_id, dateRange);
      const relatedAdSet = adSetsById.get(ad.ad_set_id);
      const campaignId = relatedAdSet?.campaign_id || null;

      for (const metaInsight of insights) {
        await this.syncInsight(adAccount.id, metaInsight, campaignId, ad.ad_set_id, ad.id);
        synced++;
      }
    }

    return synced;
  }

  private async syncCampaign(
    adAccountId: string,
    metaCampaign: MetaCampaign,
    campaignMap: Map<string, Campaign>
  ): Promise<Campaign> {
    const values = {
      ad_account_id: adAccountId,
      meta_campaign_id: metaCampaign.id,
      name: metaCampaign.name,
      objective: metaCampaign.objective,
      status: metaCampaign.status,
      buying_type: metaCampaign.buying_type,
      special_ad_category: metaCampaign.special_ad_categories?.[0]?.name || null,
      daily_budget: metaCampaign.daily_budget ? metaCampaign.daily_budget / 100 : null,
      lifetime_budget: metaCampaign.lifetime_budget ? metaCampaign.lifetime_budget / 100 : null,
      start_time: metaCampaign.start_time ? new Date(metaCampaign.start_time) : null,
      stop_time: metaCampaign.stop_time ? new Date(metaCampaign.stop_time) : null,
      is_active: metaCampaign.status !== 'DELETED',
    };

    const existingCampaign = campaignMap.get(metaCampaign.id);
    if (existingCampaign) {
      await existingCampaign.update(values);
      return existingCampaign;
    }

    const campaign = await Campaign.create({
      id: uuidv4(),
      ...values,
    });

    campaignMap.set(metaCampaign.id, campaign);
    return campaign;
  }

  private async syncAdSet(
    metaAdSet: MetaAdSet,
    campaignMap: Map<string, Campaign>,
    adSetMap: Map<string, AdSet>
  ): Promise<AdSet> {
    const campaign = campaignMap.get(metaAdSet.campaign_id);
    if (!campaign) {
      throw new AppError(`Campaign not found for ad set ${metaAdSet.id}`, 422);
    }

    const values = {
      campaign_id: campaign.id,
      meta_adset_id: metaAdSet.id,
      name: metaAdSet.name,
      status: metaAdSet.status,
      daily_budget: metaAdSet.daily_budget ? metaAdSet.daily_budget / 100 : null,
      lifetime_budget: metaAdSet.lifetime_budget ? metaAdSet.lifetime_budget / 100 : null,
      bid_amount: metaAdSet.bid_amount ? metaAdSet.bid_amount / 100 : null,
      bid_strategy: metaAdSet.bid_strategy || null,
      optimization_goal: metaAdSet.optimization_goal || null,
      targeting: metaAdSet.targeting ? JSON.stringify(metaAdSet.targeting) : null,
      start_time: metaAdSet.start_time ? new Date(metaAdSet.start_time) : null,
      end_time: metaAdSet.end_time ? new Date(metaAdSet.end_time) : null,
      is_active: metaAdSet.status !== 'DELETED',
    };

    const existingAdSet = adSetMap.get(metaAdSet.id);
    if (existingAdSet) {
      await existingAdSet.update(values);
      return existingAdSet;
    }

    const adSet = await AdSet.create({
      id: uuidv4(),
      ...values,
    });

    adSetMap.set(metaAdSet.id, adSet);
    return adSet;
  }

  private async syncAd(
    metaAd: MetaAd,
    adSetMap: Map<string, AdSet>,
    adMap: Map<string, Ad>
  ): Promise<Ad> {
    const adSet = adSetMap.get(metaAd.adset_id);
    if (!adSet) {
      throw new AppError(`Ad set not found for ad ${metaAd.id}`, 422);
    }

    const creative = this.extractAdCreative(metaAd);

    const values = {
      ad_set_id: adSet.id,
      meta_ad_id: metaAd.id,
      name: this.sanitizeRequiredText(metaAd.name),
      status: metaAd.status,
      creative_type: creative.creativeType,
      headline: this.sanitizeText(creative.headline),
      primary_text: this.sanitizeText(creative.primaryText),
      description: this.sanitizeText(creative.description),
      call_to_action: this.sanitizeText(creative.callToAction),
      link_url: this.sanitizeText(creative.linkUrl),
      image_url: this.sanitizeText(creative.imageUrl),
      video_url: this.sanitizeText(creative.videoUrl),
      is_active: metaAd.status !== 'DELETED',
    };

    const existingAd = adMap.get(metaAd.id);
    if (existingAd) {
      await existingAd.update(values);
      return existingAd;
    }

    const ad = await Ad.create({
      id: uuidv4(),
      ...values,
    });

    adMap.set(metaAd.id, ad);
    return ad;
  }

  private extractAdCreative(metaAd: MetaAd): {
    creativeType: string;
    headline: string | null;
    primaryText: string | null;
    description: string | null;
    callToAction: string | null;
    linkUrl: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
  } {
    const creative = metaAd.creative;
    const storySpec = creative?.object_story_spec;
    const linkData = storySpec?.link_data || storySpec?.template_data;
    const videoData = storySpec?.video_data;
    const photoData = storySpec?.photo_data;

    const headline = creative?.title || linkData?.name || videoData?.title || null;
    const primaryText =
      creative?.body || linkData?.message || videoData?.message || photoData?.caption || null;
    const description = linkData?.description || null;
    const callToAction =
      linkData?.call_to_action?.type ||
      videoData?.call_to_action?.type ||
      creative?.call_to_action_type ||
      null;

    const linkUrl =
      linkData?.link ||
      linkData?.call_to_action?.value?.link ||
      videoData?.call_to_action?.value?.link ||
      null;

    const imageUrl = storySpec?.link_data?.picture || videoData?.image_url || photoData?.url || null;
    const videoUrl = videoData?.video_id ? `https://www.facebook.com/${videoData.video_id}` : null;
    const creativeType = videoData?.video_id ? 'video' : imageUrl ? 'image' : creative ? 'creative' : 'unknown';

    return {
      creativeType,
      headline,
      primaryText,
      description,
      callToAction,
      linkUrl,
      imageUrl,
      videoUrl,
    };
  }

  private sanitizeText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const sanitized = value
      .replace(/\u0000/g, '')
      .normalize('NFKC')
      // Keep line breaks/tabs and latin-1 range; drop unsupported symbols (e.g. emoji).
      .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, '')
      .trim();

    return sanitized === '' ? null : sanitized;
  }

  private sanitizeRequiredText(value: string): string {
    const sanitized = this.sanitizeText(value);
    return sanitized || '[invalid-text]';
  }

  private async syncInsight(
    adAccountId: string,
    metaInsight: MetaInsight,
    campaignId: string | null,
    adSetId: string | null,
    adId: string | null
  ): Promise<Insight> {
    const insightDate = this.normalizeInsightDate(metaInsight.date);

    const [insight] = await Insight.findOrCreate({
      where: {
        ad_account_id: adAccountId,
        date: insightDate,
        campaign_id: campaignId,
        ad_set_id: adSetId,
        ad_id: adId,
      },
      defaults: {
        id: uuidv4(),
        ad_account_id: adAccountId,
        campaign_id: campaignId,
        ad_set_id: adSetId,
        ad_id: adId,
        date: insightDate,
        impressions: metaInsight.impressions,
        reach: metaInsight.reach,
        clicks: metaInsight.clicks,
        ctr: metaInsight.ctr,
        cpc: metaInsight.cpc,
        cpm: metaInsight.cpm,
        spend: metaInsight.spend,
        conversions: metaInsight.conversions,
        conversion_value: metaInsight.conversion_value,
        cpa:
          metaInsight.spend > 0 && metaInsight.conversions > 0
            ? metaInsight.spend / metaInsight.conversions
            : 0,
        roas: metaInsight.spend > 0 ? metaInsight.conversion_value / metaInsight.spend : 0,
        frequency: metaInsight.frequency,
      },
    });

    await insight.update({
      impressions: metaInsight.impressions,
      reach: metaInsight.reach,
      clicks: metaInsight.clicks,
      ctr: metaInsight.ctr,
      cpc: metaInsight.cpc,
      cpm: metaInsight.cpm,
      spend: metaInsight.spend,
      conversions: metaInsight.conversions,
      conversion_value: metaInsight.conversion_value,
      cpa:
        metaInsight.spend > 0 && metaInsight.conversions > 0
          ? metaInsight.spend / metaInsight.conversions
          : 0,
      roas: metaInsight.spend > 0 ? metaInsight.conversion_value / metaInsight.spend : 0,
      frequency: metaInsight.frequency,
    });

    return insight;
  }

  private normalizeInsightDate(rawDate: string): string {
    if (!rawDate) {
      return this.formatDate(new Date());
    }

    return rawDate.slice(0, 10);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async canSyncToday(adAccountId: string): Promise<boolean> {
    const adAccount = await AdAccount.findByPk(adAccountId, {
      include: [{ model: Organization, as: 'organization' }],
    });

    if (!adAccount || !adAccount.organization) {
      return false;
    }

    const today = this.formatDate(new Date());

    if (adAccount.last_sync_date === today) {
      return adAccount.daily_sync_count < adAccount.organization.max_daily_syncs;
    }

    return true;
  }
}

export default new SyncService();
