import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import MetaApiService, { MetaCampaign, MetaAdSet, MetaAd, MetaInsight } from './MetaApiService';
import {
  AdAccount,
  Campaign,
  AdSet,
  Ad,
  Insight,
  SyncJob,
  Organization,
} from '../models';
import sequelize from '../config/database';

export class SyncService {
  async syncAdAccount(adAccountId: string, jobType: 'full_sync' | 'incremental_sync' | 'insights_sync' = 'full_sync'): Promise<void> {
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
        throw new Error('Ad account not found');
      }

      let recordsSynced = 0;

      if (jobType === 'full_sync' || jobType === 'incremental_sync') {
        // Sync campaigns
        const campaigns = await MetaApiService.getCampaigns(adAccount);
        for (const campaign of campaigns) {
          await this.syncCampaign(adAccount.id, campaign);
          recordsSynced++;
        }

        // Sync ad sets
        const adSets = await MetaApiService.getAdSets(adAccount);
        for (const adSet of adSets) {
          await this.syncAdSet(adAccount.id, adSet);
          recordsSynced++;
        }

        // Sync ads
        const ads = await MetaApiService.getAds(adAccount);
        for (const ad of ads) {
          await this.syncAd(adAccount.id, ad);
          recordsSynced++;
        }
      }

      // Sync insights
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const insights = await MetaApiService.getInsights(adAccount, 'account', undefined, {
        since: this.formatDate(thirtyDaysAgo),
        until: this.formatDate(today),
      });

      for (const insight of insights) {
        await this.syncInsight(adAccount.id, insight, null, null, null);
        recordsSynced++;
      }

      // Update ad account sync info
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

  private async syncCampaign(adAccountId: string, metaCampaign: MetaCampaign): Promise<Campaign> {
    const [campaign] = await Campaign.findOrCreate({
      where: { meta_campaign_id: metaCampaign.id },
      defaults: {
        id: uuidv4(),
        ad_account_id: adAccountId,
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
      },
    });

    await campaign.update({
      name: metaCampaign.name,
      objective: metaCampaign.objective,
      status: metaCampaign.status,
      buying_type: metaCampaign.buying_type,
      daily_budget: metaCampaign.daily_budget ? metaCampaign.daily_budget / 100 : null,
      lifetime_budget: metaCampaign.lifetime_budget ? metaCampaign.lifetime_budget / 100 : null,
      start_time: metaCampaign.start_time ? new Date(metaCampaign.start_time) : null,
      stop_time: metaCampaign.stop_time ? new Date(metaCampaign.stop_time) : null,
      is_active: metaCampaign.status !== 'DELETED',
    });

    return campaign;
  }

  private async syncAdSet(adAccountId: string, metaAdSet: MetaAdSet): Promise<AdSet> {
    const campaign = await Campaign.findOne({
      where: { meta_campaign_id: metaAdSet.campaign_id },
    });

    if (!campaign) {
      throw new Error(`Campaign not found for ad set ${metaAdSet.id}`);
    }

    const [adSet] = await AdSet.findOrCreate({
      where: { meta_adset_id: metaAdSet.id },
      defaults: {
        id: uuidv4(),
        campaign_id: campaign.id,
        name: metaAdSet.name,
        status: metaAdSet.status,
        daily_budget: metaAdSet.daily_budget ? metaAdSet.daily_budget / 100 : null,
        lifetime_budget: metaAdSet.lifetime_budget ? metaAdSet.lifetime_budget / 100 : null,
        bid_amount: metaAdSet.bid_amount ? metaAdSet.bid_amount / 100 : null,
        bid_strategy: metaAdSet.bid_strategy,
        optimization_goal: metaAdSet.optimization_goal,
        targeting: metaAdSet.targeting ? JSON.stringify(metaAdSet.targeting) : null,
        start_time: metaAdSet.start_time ? new Date(metaAdSet.start_time) : null,
        end_time: metaAdSet.end_time ? new Date(metaAdSet.end_time) : null,
        is_active: metaAdSet.status !== 'DELETED',
      },
    });

    await adSet.update({
      campaign_id: campaign.id,
      name: metaAdSet.name,
      status: metaAdSet.status,
      daily_budget: metaAdSet.daily_budget ? metaAdSet.daily_budget / 100 : null,
      lifetime_budget: metaAdSet.lifetime_budget ? metaAdSet.lifetime_budget / 100 : null,
      bid_amount: metaAdSet.bid_amount ? metaAdSet.bid_amount / 100 : null,
      bid_strategy: metaAdSet.bid_strategy,
      optimization_goal: metaAdSet.optimization_goal,
      targeting: metaAdSet.targeting ? JSON.stringify(metaAdSet.targeting) : null,
      start_time: metaAdSet.start_time ? new Date(metaAdSet.start_time) : null,
      end_time: metaAdSet.end_time ? new Date(metaAdSet.end_time) : null,
      is_active: metaAdSet.status !== 'DELETED',
    });

    return adSet;
  }

  private async syncAd(adAccountId: string, metaAd: MetaAd): Promise<Ad> {
    const adSet = await AdSet.findOne({
      where: { meta_adset_id: metaAd.adset_id },
    });

    if (!adSet) {
      throw new Error(`Ad set not found for ad ${metaAd.id}`);
    }

    const [ad] = await Ad.findOrCreate({
      where: { meta_ad_id: metaAd.id },
      defaults: {
        id: uuidv4(),
        ad_set_id: adSet.id,
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
      },
    });

    await ad.update({
      ad_set_id: adSet.id,
      name: metaAd.name,
      status: metaAd.status,
      headline: metaAd.creative?.headline || metaAd.ad_creative?.headline || null,
      primary_text: metaAd.creative?.body || metaAd.ad_creative?.body || null,
      description: metaAd.creative?.description || metaAd.ad_creative?.description || null,
      call_to_action: metaAd.creative?.call_to_action?.type || null,
      link_url: metaAd.creative?.link_url || null,
      image_url: metaAd.creative?.image_url || null,
      video_url: metaAd.creative?.video_url || null,
      is_active: metaAd.status !== 'DELETED',
    });

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
        impressions: metaInsight.impressions,
        reach: metaInsight.reach,
        clicks: metaInsight.clicks,
        ctr: metaInsight.ctr,
        cpc: metaInsight.cpc,
        cpm: metaInsight.cpm,
        spend: metaInsight.spend,
        conversions: metaInsight.conversions,
        conversion_value: metaInsight.conversion_value,
        cpa: metaInsight.spend > 0 && metaInsight.conversions > 0 
          ? metaInsight.spend / metaInsight.conversions 
          : 0,
        roas: metaInsight.spend > 0 
          ? metaInsight.conversion_value / metaInsight.spend 
          : 0,
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
      cpa: metaInsight.spend > 0 && metaInsight.conversions > 0 
        ? metaInsight.spend / metaInsight.conversions 
        : 0,
      roas: metaInsight.spend > 0 
        ? metaInsight.conversion_value / metaInsight.spend 
        : 0,
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
