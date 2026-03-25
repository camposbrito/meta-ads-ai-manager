import { v4 as uuidv4 } from 'uuid';
import MetaApiService, { MetaAd, MetaAdSet, MetaCampaign, MetaInsight } from './MetaApiService';
import { Ad, AdAccount, AdSet, Campaign, Insight, Organization, SyncJob } from '../models';
import { AppError } from '../middleware/errorHandler';

export class SyncService {
  async syncAdAccount(
    adAccountId: string,
    jobType: 'full_sync' | 'incremental_sync' | 'insights_sync' = 'full_sync'
  ): Promise<void> {
    const syncJob = await SyncJob.create({
      id: uuidv4(),
      ad_account_id: adAccountId,
      job_type: jobType,
      status: 'pending',
      records_synced: 0,
    });

    try {
      await syncJob.update({ status: 'running', started_at: new Date() });

      const adAccount = await AdAccount.findByPk(adAccountId, {
        include: [{ model: Organization, as: 'organization' }],
      });

      if (!adAccount) {
        throw new AppError('Ad account not found', 404);
      }

      let recordsSynced = 0;

      if (jobType === 'full_sync' || jobType === 'incremental_sync') {
        const campaigns = await MetaApiService.getCampaigns(adAccount);
        const campaignMap = await this.loadCampaignMap(campaigns.map((campaign) => campaign.id));

        for (const metaCampaign of campaigns) {
          await this.syncCampaign(adAccount.id, metaCampaign, campaignMap);
          recordsSynced++;
        }

        const adSets = await MetaApiService.getAdSets(adAccount);
        const adSetMap = await this.loadAdSetMap(adSets.map((adSet) => adSet.id));

        for (const metaAdSet of adSets) {
          await this.syncAdSet(metaAdSet, campaignMap, adSetMap);
          recordsSynced++;
        }

        const ads = await MetaApiService.getAds(adAccount);
        const adMap = await this.loadAdMap(ads.map((ad) => ad.id));

        for (const metaAd of ads) {
          await this.syncAd(metaAd, adSetMap, adMap);
          recordsSynced++;
        }
      }

      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const insights = await MetaApiService.getInsights(adAccount, 'account', undefined, {
        since: this.formatDate(thirtyDaysAgo),
        until: this.formatDate(today),
      });

      for (const metaInsight of insights) {
        await this.syncInsight(adAccount.id, metaInsight, null, null, null);
        recordsSynced++;
      }

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

    const values = {
      ad_set_id: adSet.id,
      meta_ad_id: metaAd.id,
      name: metaAd.name,
      status: metaAd.status,
      creative_type: metaAd.creative ? 'image' : 'unknown',
      headline: metaAd.creative?.headline || metaAd.ad_creative?.headline || null,
      primary_text: metaAd.creative?.body || metaAd.ad_creative?.body || null,
      description: metaAd.creative?.description || metaAd.ad_creative?.description || null,
      call_to_action: metaAd.creative?.call_to_action?.type || null,
      link_url: metaAd.creative?.link_url || null,
      image_url: metaAd.creative?.image_url || null,
      video_url: metaAd.creative?.video_url || null,
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

  private async syncInsight(
    adAccountId: string,
    metaInsight: MetaInsight,
    campaignId: string | null,
    adSetId: string | null,
    adId: string | null
  ): Promise<Insight> {
    const [insight] = await Insight.findOrCreate({
      where: {
        ad_account_id: adAccountId,
        date: metaInsight.date,
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
        date: metaInsight.date,
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
