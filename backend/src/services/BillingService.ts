import { AdAccount, Organization, User } from '../models';
import { AppError } from '../middleware/errorHandler';

export type PlanType = 'free' | 'pro' | 'agency';

export interface PlanLimits {
  max_ad_accounts: number;
  max_daily_syncs: number;
  max_users: number;
  optimization_enabled: boolean;
  auto_optimization_enabled: boolean;
  data_retention_days: number;
  support_level: 'community' | 'email' | 'priority';
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    max_ad_accounts: 1,
    max_daily_syncs: 1,
    max_users: 2,
    optimization_enabled: true,
    auto_optimization_enabled: false,
    data_retention_days: 30,
    support_level: 'community',
  },
  pro: {
    max_ad_accounts: 5,
    max_daily_syncs: 4,
    max_users: 10,
    optimization_enabled: true,
    auto_optimization_enabled: true,
    data_retention_days: 90,
    support_level: 'email',
  },
  agency: {
    max_ad_accounts: 50,
    max_daily_syncs: 24,
    max_users: 100,
    optimization_enabled: true,
    auto_optimization_enabled: true,
    data_retention_days: 365,
    support_level: 'priority',
  },
};

export const PLAN_PRICING: Record<PlanType, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 49, yearly: 470 },
  agency: { monthly: 199, yearly: 1910 },
};

export class BillingService {
  async upgradePlan(organizationId: string, newPlan: PlanType): Promise<Organization> {
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const limits = PLAN_LIMITS[newPlan];

    await organization.update({
      plan: newPlan,
      max_ad_accounts: limits.max_ad_accounts,
      max_daily_syncs: limits.max_daily_syncs,
      subscription_status: newPlan === 'free' ? null : 'active',
      subscription_ends_at: newPlan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return organization;
  }

  async downgradePlan(organizationId: string, newPlan: PlanType): Promise<Organization> {
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const limits = PLAN_LIMITS[newPlan];

    // Check if downgrade would violate limits
    const currentAdAccountCount = await AdAccount.count({
      where: { organization_id: organizationId, is_active: true },
    });
    const currentUserCount = await User.count({
      where: { organization_id: organizationId, is_active: true },
    });
    
    if (currentAdAccountCount > limits.max_ad_accounts) {
      throw new AppError(
        `Cannot downgrade: organization has more ad accounts (${currentAdAccountCount}) than the new plan allows (${limits.max_ad_accounts})`
      , 409);
    }

    if (currentUserCount > limits.max_users) {
      throw new AppError(
        `Cannot downgrade: organization has more active users (${currentUserCount}) than the new plan allows (${limits.max_users})`,
        409
      );
    }

    await organization.update({
      plan: newPlan,
      max_ad_accounts: limits.max_ad_accounts,
      max_daily_syncs: limits.max_daily_syncs,
      subscription_status: newPlan === 'free' ? null : 'active',
      subscription_ends_at: newPlan === 'free' ? null : organization.subscription_ends_at,
    });

    return organization;
  }

  async cancelSubscription(organizationId: string): Promise<Organization> {
    const organization = await Organization.findByPk(organizationId);
    
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Keep access until the end of the billing period
    await organization.update({
      subscription_status: 'canceled',
    });

    return organization;
  }

  getPlanLimits(plan: PlanType): PlanLimits {
    return PLAN_LIMITS[plan];
  }

  getPlanPricing(plan: PlanType): { monthly: number; yearly: number } {
    return PLAN_PRICING[plan];
  }

  canPerformAction(organization: Organization, action: string, currentCount: number): boolean {
    const limits = PLAN_LIMITS[organization.plan as PlanType];

    switch (action) {
      case 'add_ad_account':
        return currentCount < limits.max_ad_accounts;
      case 'add_user':
        return currentCount < limits.max_users;
      case 'daily_sync':
        return currentCount < limits.max_daily_syncs;
      case 'auto_optimization':
        return limits.auto_optimization_enabled;
      default:
        return true;
    }
  }
}

export default new BillingService();
