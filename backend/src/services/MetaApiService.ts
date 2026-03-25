import axios, { AxiosError, AxiosInstance } from 'axios';
import { decrypt } from './EncryptionService';
import AdAccount from '../models/AdAccount';
import { AppError } from '../middleware/errorHandler';

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
  special_ad_categories?: Array<{ name?: string }>;
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
  targeting?: Record<string, unknown>;
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

interface MetaApiResponse<T> {
  data: T;
}

interface MetaApiServiceOptions {
  apiVersion?: string;
  baseUrl?: string;
  decryptAccessToken?: (encryptedToken: string) => string;
}

export class MetaApiError extends AppError {
  constructor(
    message: string,
    statusCode = 502,
    public readonly metaCode?: number,
    details?: unknown
  ) {
    super(message, statusCode, details);
  }
}

export class MetaApiService {
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly decryptAccessToken: (encryptedToken: string) => string;

  constructor(options: MetaApiServiceOptions = {}) {
    this.apiVersion = options.apiVersion || META_API_VERSION;
    this.baseUrl = options.baseUrl || META_GRAPH_URL;
    this.decryptAccessToken = options.decryptAccessToken || decrypt;
  }

  private getAccessToken(adAccount: AdAccount): string {
    return this.decryptAccessToken(adAccount.access_token_encrypted);
  }

  private createClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: `${this.baseUrl}/${this.apiVersion}`,
      timeout: 15000,
      params: {
        access_token: accessToken,
      },
    });
  }

  private normalizeError(error: unknown): MetaApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const statusCode = axiosError.response?.status || 502;
      const metaError = axiosError.response?.data?.error;
      const message =
        metaError?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Meta API request failed';

      return new MetaApiError(message, statusCode, metaError?.code, {
        type: metaError?.type,
        subcode: metaError?.error_subcode,
        trace_id: metaError?.fbtrace_id,
      });
    }

    if (error instanceof Error) {
      return new MetaApiError(error.message);
    }

    return new MetaApiError('Meta API request failed');
  }

  private async request<T>(operation: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await operation();
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const client = this.createClient(accessToken);
    const response = await this.request<MetaApiResponse<MetaAdAccount[]>>(() =>
      client.get('/me/adaccounts', {
        params: {
          fields: 'id,name,currency,business',
          limit: 100,
        },
      })
    );
    return response.data;
  }

  async getCampaigns(adAccount: AdAccount, limit = 100): Promise<MetaCampaign[]> {
    const client = this.createClient(this.getAccessToken(adAccount));
    const response = await this.request<MetaApiResponse<MetaCampaign[]>>(() =>
      client.get(`/act_${adAccount.meta_account_id}/campaigns`, {
        params: {
          fields:
            'id,name,objective,status,buying_type,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time',
          limit,
        },
      })
    );
    return response.data;
  }

  async getAdSets(adAccount: AdAccount, campaignId?: string, limit = 100): Promise<MetaAdSet[]> {
    const client = this.createClient(this.getAccessToken(adAccount));
    const endpoint = campaignId
      ? `/act_${adAccount.meta_account_id}/campaigns/${campaignId}/adsets`
      : `/act_${adAccount.meta_account_id}/adsets`;

    const response = await this.request<MetaApiResponse<MetaAdSet[]>>(() =>
      client.get(endpoint, {
        params: {
          fields:
            'id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,bid_strategy,optimization_goal,targeting,start_time,end_time',
          limit,
        },
      })
    );
    return response.data;
  }

  async getAds(adAccount: AdAccount, adSetId?: string, limit = 100): Promise<MetaAd[]> {
    const client = this.createClient(this.getAccessToken(adAccount));
    const endpoint = adSetId
      ? `/act_${adAccount.meta_account_id}/adsets/${adSetId}/ads`
      : `/act_${adAccount.meta_account_id}/ads`;

    const response = await this.request<MetaApiResponse<MetaAd[]>>(() =>
      client.get(endpoint, {
        params: {
          fields:
            'id,name,adset_id,status,creative{body,headline,description,call_to_action,link_url,image_url,video_url},ad_creative{body,headline,description}',
          limit,
        },
      })
    );
    return response.data;
  }

  async getInsights(
    adAccount: AdAccount,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    entityId?: string,
    dateRange?: { since: string; until: string }
  ): Promise<MetaInsight[]> {
    const client = this.createClient(this.getAccessToken(adAccount));

    let endpoint = `/act_${adAccount.meta_account_id}/insights`;
    if (entityId) {
      if (level === 'campaign') {
        endpoint = `/act_${adAccount.meta_account_id}/campaigns/${entityId}/insights`;
      } else if (level === 'adset') {
        endpoint = `/act_${adAccount.meta_account_id}/adsets/${entityId}/insights`;
      } else if (level === 'ad') {
        endpoint = `/act_${adAccount.meta_account_id}/ads/${entityId}/insights`;
      }
    }

    const response = await this.request<MetaApiResponse<MetaInsight[]>>(() =>
      client.get(endpoint, {
        params: {
          fields:
            'date,impressions,reach,clicks,ctr,cpc,cpm,spend,conversions,conversion_value,frequency',
          sort: 'date_desc',
          ...(dateRange
            ? {
                date_preset: 'custom',
                time_range: JSON.stringify(dateRange),
              }
            : {}),
        },
      })
    );
    return response.data;
  }

  async pauseAd(adAccount: AdAccount, adId: string): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/act_${adAccount.meta_account_id}`, {
        ad_id: adId,
        status: 'PAUSED',
      })
    );
  }

  async updateAdStatus(
    adAccount: AdAccount,
    adId: string,
    status: 'ACTIVE' | 'PAUSED'
  ): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/${adId}`, {
        status,
      })
    );
  }

  async updateAdSetBudget(
    adAccount: AdAccount,
    adSetId: string,
    dailyBudget: number
  ): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/${adSetId}`, {
        daily_budget: dailyBudget,
      })
    );
  }

  async updateCampaignBudget(
    adAccount: AdAccount,
    campaignId: string,
    dailyBudget: number
  ): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/${campaignId}`, {
        daily_budget: dailyBudget,
      })
    );
  }

  async duplicateAd(
    adAccount: AdAccount,
    adId: string,
    newName: string
  ): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/act_${adAccount.meta_account_id}/adcreatives`, {
        source_ad_id: adId,
        name: newName,
      })
    );
  }

  async pauseAdSet(adAccount: AdAccount, adSetId: string): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/${adSetId}`, {
        status: 'PAUSED',
      })
    );
  }

  async pauseCampaign(adAccount: AdAccount, campaignId: string): Promise<Record<string, unknown>> {
    const client = this.createClient(this.getAccessToken(adAccount));
    return this.request<Record<string, unknown>>(() =>
      client.post(`/${campaignId}`, {
        status: 'PAUSED',
      })
    );
  }
}

export default new MetaApiService();
