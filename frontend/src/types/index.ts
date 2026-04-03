export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'agency';
  };
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
  ad_account_id?: string;
  ad_account_name?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
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
  ctr?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
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
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  min_spend_threshold?: number;
  min_impressions_threshold?: number;
  evaluation_period_days?: number;
  created_at?: string;
}

export interface RuleCondition {
  field: 'impressions' | 'reach' | 'clicks' | 'spend' | 'conversions' | 'ctr' | 'cpc' | 'cpa' | 'roas';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in';
  value: number | string | [number, number] | Array<number | string>;
}

export interface RuleAction {
  type: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget';
  params?: Record<string, number | string | boolean>;
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

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  last_login_at?: string | null;
  created_at: string;
}

export interface MetaAvailableAdAccount {
  id: string;
  meta_account_id: string;
  name: string;
  currency: string;
  business_id?: string | null;
}

export interface BillingSubscription {
  id: 'free' | 'pro' | 'agency';
  name: string;
  status?: string | null;
  ends_at?: string | null;
  limits: {
    max_ad_accounts: number;
    max_daily_syncs: number;
    max_users: number;
    optimization_enabled: boolean;
    auto_optimization_enabled: boolean;
    data_retention_days: number;
    support_level: 'community' | 'email' | 'priority';
  };
  usage: {
    ad_accounts: number;
    daily_syncs: number;
    users?: number;
  };
}

export interface Ga4Integration {
  id: string;
  property_id: string;
  measurement_id?: string | null;
  service_account_email: string;
  is_active: boolean;
  has_credentials: boolean;
  last_tested_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}
