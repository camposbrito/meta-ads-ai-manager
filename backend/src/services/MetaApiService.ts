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
    id?: string;
    name?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
    object_story_spec?: {
      link_data?: {
        name?: string;
        message?: string;
        description?: string;
        link?: string;
        picture?: string;
        call_to_action?: {
          type?: string;
          value?: {
            link?: string;
          };
        };
      };
      video_data?: {
        title?: string;
        message?: string;
        image_url?: string;
        video_id?: string;
        call_to_action?: {
          type?: string;
          value?: {
            link?: string;
          };
        };
      };
      photo_data?: {
        caption?: string;
        url?: string;
      };
      template_data?: {
        name?: string;
        message?: string;
        description?: string;
        link?: string;
        call_to_action?: {
          type?: string;
          value?: {
            link?: string;
          };
        };
      };
    };
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

interface MetaActionMetric {
  action_type?: string;
  value?: string | number;
}

interface RawMetaInsight {
  date_start?: string;
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  spend?: string | number;
  frequency?: string | number;
  actions?: MetaActionMetric[];
  action_values?: MetaActionMetric[];
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

  private parseMetric(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private isConversionAction(actionType: string): boolean {
    const normalized = actionType.toLowerCase();

    return (
      normalized.startsWith('offsite_conversion') ||
      normalized.startsWith('onsite_conversion') ||
      normalized.startsWith('omni_') ||
      normalized.includes('conversion') ||
      normalized.includes('purchase') ||
      normalized.includes('lead') ||
      normalized.includes('complete_registration') ||
      normalized.includes('subscribe') ||
      normalized.includes('add_to_cart') ||
      normalized.includes('initiate_checkout') ||
      normalized.includes('contact') ||
      normalized.includes('view_content')
    );
  }

  private sumConversionMetrics(metrics: unknown): number {
    if (!Array.isArray(metrics)) {
      return 0;
    }

    let total = 0;

    for (const metric of metrics as MetaActionMetric[]) {
      const actionType = typeof metric.action_type === 'string' ? metric.action_type : '';
      if (!actionType || !this.isConversionAction(actionType)) {
        continue;
      }

      total += this.parseMetric(metric.value);
    }

    return total;
  }

  private normalizeInsight(raw: RawMetaInsight): MetaInsight {
    const conversions = this.sumConversionMetrics(raw.actions);
    const conversionValue = this.sumConversionMetrics(raw.action_values);

    return {
      date: raw.date_start || '',
      impressions: this.parseMetric(raw.impressions),
      reach: this.parseMetric(raw.reach),
      clicks: this.parseMetric(raw.clicks),
      ctr: this.parseMetric(raw.ctr),
      cpc: this.parseMetric(raw.cpc),
      cpm: this.parseMetric(raw.cpm),
      spend: this.parseMetric(raw.spend),
      conversions,
      conversion_value: conversionValue,
      frequency: this.parseMetric(raw.frequency),
    };
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
            'id,name,adset_id,status,creative{id,name,title,body,call_to_action_type,object_story_spec}',
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

    const endpoint = entityId ? `/${entityId}/insights` : `/act_${adAccount.meta_account_id}/insights`;

    const response = await this.request<MetaApiResponse<RawMetaInsight[]>>(() =>
      client.get(endpoint, {
        params: {
          fields:
            'date_start,impressions,reach,clicks,ctr,cpc,cpm,spend,frequency,actions,action_values',
          ...(dateRange
            ? {
                time_range: JSON.stringify(dateRange),
              }
            : {}),
        },
      })
    );
    return response.data.map((insight) => this.normalizeInsight(insight));
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
      client.post(`/${adId}/copies`, {
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
