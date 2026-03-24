export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  organizationId: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'agency';
  max_ad_accounts: number;
  max_daily_syncs: number;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
}

export interface AdAccount {
  id: string;
  meta_account_id: string;
  name: string;
  currency: string;
  is_active: boolean;
  last_synced_at?: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
  daily_budget?: number | null;
  ad_account_name?: string;
}

export interface Ad {
  id: string;
  name: string;
  headline?: string | null;
  status: string;
  spend?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  impressions?: number;
}

export interface Insight {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  suggestion_type: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget';
  entity_type: 'campaign' | 'ad_set' | 'ad';
  status: 'pending' | 'accepted' | 'rejected' | 'executed' | 'expired';
  confidence_score?: number | null;
  expected_impact?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export interface OptimizationRule {
  id: string;
  name: string;
  description?: string | null;
  rule_type: 'pause_ad' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget';
  is_active: boolean;
  conditions: any;
  actions: any;
  priority: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  features: string[];
  popular?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
