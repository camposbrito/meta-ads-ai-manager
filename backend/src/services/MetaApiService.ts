import axios, { AxiosInstance } from 'axios';
import { decrypt } from '../services/EncryptionService';
import AdAccount from '../models/AdAccount';

const META_API_VERSION = 'v18.0';
const META_GRAPH_URL = 'https://graph.facebook.com';

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  business?: { id: string };
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  buying_type: string;
  special_ad_categories?: any[];
  daily_budget?: number;
  lifetime_budget?: number;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  bid_amount?: number;
  bid_strategy?: string;
  optimization_goal?: string;
  targeting?: any;
  start_time?: string;
  end_time?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  creative?: {
    body?: string;
    headline?: string;
    description?: string;
    call_to_action?: { type: string };
    link_url?: string;
    image_url?: string;
    video_url?: string;
  };
  ad_creative?: {
    body?: string;
    headline?: string;
    description?: string;
  };
}

export interface MetaInsight {
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  frequency: number;
}

export class MetaApiService {
  private getAccessToken(adAccount: AdAccount): string {
    return decrypt(adAccount.access_token_encrypted);
  }

  private createClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: `${META_GRAPH_URL}/${META_API_VERSION}`,
      params: {
        access_token: accessToken,
      },
    });
  }

  async getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const client = this.createClient(accessToken);
    const response = await client.get('/me/adaccounts', {
      params: {
        fields: 'id,name,currency,business',
        limit: 100,
      },
    });
    return response.data.data;
  }

  async getCampaigns(adAccount: AdAccount, limit = 100): Promise<MetaCampaign[]> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.get(`/act_${adAccount.meta_account_id}/campaigns`, {
      params: {
        fields: 'id,name,objective,status,buying_type,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time',
        limit,
      },
    });
    return response.data.data;
  }

  async getAdSets(adAccount: AdAccount, campaignId?: string, limit = 100): Promise<MetaAdSet[]> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    let endpoint = `/act_${adAccount.meta_account_id}/adsets`;
    const params: any = {
      fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,bid_strategy,optimization_goal,targeting,start_time,end_time',
      limit,
    };

    if (campaignId) {
      endpoint = `/act_${adAccount.meta_account_id}/campaigns/${campaignId}/adsets`;
    }

    const response = await client.get(endpoint, { params });
    return response.data.data;
  }

  async getAds(adAccount: AdAccount, adSetId?: string, limit = 100): Promise<MetaAd[]> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    let endpoint = `/act_${adAccount.meta_account_id}/ads`;
    const params: any = {
      fields: 'id,name,adset_id,status,creative{body,headline,description,call_to_action,link_url,image_url,video_url},ad_creative{body,headline,description}',
      limit,
    };

    if (adSetId) {
      endpoint = `/act_${adAccount.meta_account_id}/adsets/${adSetId}/ads`;
    }

    const response = await client.get(endpoint, { params });
    return response.data.data;
  }

  async getInsights(
    adAccount: AdAccount,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    entityId?: string,
    dateRange?: { since: string; until: string }
  ): Promise<MetaInsight[]> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    let endpoint = `/act_${adAccount.meta_account_id}/insights`;
    if (entityId) {
      switch (level) {
        case 'campaign':
          endpoint = `/act_${adAccount.meta_account_id}/campaigns/${entityId}/insights`;
          break;
        case 'adset':
          endpoint = `/act_${adAccount.meta_account_id}/adsets/${entityId}/insights`;
          break;
        case 'ad':
          endpoint = `/act_${adAccount.meta_account_id}/ads/${entityId}/insights`;
          break;
      }
    }

    const params: any = {
      fields: 'date,impressions,reach,clicks,ctr,cpc,cpm,spend,conversions,conversion_value,frequency',
      sort: 'date_desc',
    };

    if (dateRange) {
      params.date_preset = 'custom';
      params.time_range = JSON.stringify({
        since: dateRange.since,
        until: dateRange.until,
      });
    }

    const response = await client.get(endpoint, { params });
    return response.data.data;
  }

  async pauseAd(adAccount: AdAccount, adId: string): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/act_${adAccount.meta_account_id}`, {
      ad_id: adId,
      status: 'PAUSED',
    });
    return response.data;
  }

  async updateAdStatus(adAccount: AdAccount, adId: string, status: 'ACTIVE' | 'PAUSED'): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/${adId}`, {
      status,
    });
    return response.data;
  }

  async updateAdSetBudget(adAccount: AdAccount, adSetId: string, dailyBudget: number): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/${adSetId}`, {
      daily_budget: dailyBudget,
    });
    return response.data;
  }

  async updateCampaignBudget(adAccount: AdAccount, campaignId: string, dailyBudget: number): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/${campaignId}`, {
      daily_budget: dailyBudget,
    });
    return response.data;
  }

  async duplicateAd(adAccount: AdAccount, adId: string, newName: string): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/act_${adAccount.meta_account_id}/adcreatives`, {
      object_story_spec: {
        page_id: adAccount.meta_account_id,
      },
      name: newName,
    });
    return response.data;
  }

  async pauseAdSet(adAccount: AdAccount, adSetId: string): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/${adSetId}`, {
      status: 'PAUSED',
    });
    return response.data;
  }

  async pauseCampaign(adAccount: AdAccount, campaignId: string): Promise<any> {
    const accessToken = this.getAccessToken(adAccount);
    const client = this.createClient(accessToken);
    
    const response = await client.post(`/${campaignId}`, {
      status: 'PAUSED',
    });
    return response.data;
  }
}

export default new MetaApiService();
