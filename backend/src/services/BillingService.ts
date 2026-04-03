import { AdAccount, Organization, User } from '../models';
import { AppError } from '../middleware/errorHandler';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

export type PlanType = 'free' | 'pro' | 'agency';
export type BillingCycle = 'monthly' | 'yearly';

interface PlanContext {
  plan: PlanType;
  billingCycle: BillingCycle;
}

interface CheckoutSessionResult {
  id: string;
  url: string;
}

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
  private stripeClient: Stripe | null = null;
  private frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

  private getStripeClient(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('your_stripe_key_here')) {
      throw new AppError('Stripe is not configured', 500);
    }

    if (!this.stripeClient) {
      this.stripeClient = new Stripe(key);
    }

    return this.stripeClient;
  }

  private resolvePriceId(plan: PlanType, billingCycle: BillingCycle): string {
    if (plan === 'free') {
      throw new AppError('Free plan does not require checkout', 400);
    }

    const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${billingCycle.toUpperCase()}`;
    const priceId = process.env[envKey];

    if (!priceId || priceId.includes('your_price_id_here')) {
      throw new AppError(`Missing Stripe price configuration: ${envKey}`, 500);
    }

    return priceId;
  }

  private resolvePlanByPriceId(priceId: string): PlanContext | null {
    const candidates: Array<{ key: string; plan: PlanType; billingCycle: BillingCycle }> = [
      { key: process.env.STRIPE_PRICE_PRO_MONTHLY || '', plan: 'pro', billingCycle: 'monthly' },
      { key: process.env.STRIPE_PRICE_PRO_YEARLY || '', plan: 'pro', billingCycle: 'yearly' },
      { key: process.env.STRIPE_PRICE_AGENCY_MONTHLY || '', plan: 'agency', billingCycle: 'monthly' },
      { key: process.env.STRIPE_PRICE_AGENCY_YEARLY || '', plan: 'agency', billingCycle: 'yearly' },
    ];

    const match = candidates.find((candidate) => candidate.key && candidate.key === priceId);
    if (!match) {
      return null;
    }

    return { plan: match.plan, billingCycle: match.billingCycle };
  }

  private async ensureStripeCustomer(organization: Organization): Promise<string> {
    if (organization.stripe_customer_id) {
      return organization.stripe_customer_id;
    }

    const stripe = this.getStripeClient();
    const customer = await stripe.customers.create({
      name: organization.name,
      metadata: {
        organization_id: organization.id,
      },
    });

    await organization.update({
      stripe_customer_id: customer.id,
    });

    return customer.id;
  }

  private applyPlanLimits(organization: Organization, plan: PlanType): {
    max_ad_accounts: number;
    max_daily_syncs: number;
  } {
    const limits = PLAN_LIMITS[plan];

    return {
      max_ad_accounts: limits.max_ad_accounts,
      max_daily_syncs: limits.max_daily_syncs,
    };
  }

  async createCheckoutSession(
    organizationId: string,
    plan: PlanType,
    billingCycle: BillingCycle
  ): Promise<CheckoutSessionResult> {
    if (plan === 'free') {
      throw new AppError('Free plan does not require checkout', 400);
    }

    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const stripe = this.getStripeClient();
    const customerId = await this.ensureStripeCustomer(organization);
    const priceId = this.resolvePriceId(plan, billingCycle);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.frontendUrl}/billing?checkout=success`,
      cancel_url: `${this.frontendUrl}/billing?checkout=cancel`,
      metadata: {
        organization_id: organization.id,
        plan,
        billing_cycle: billingCycle,
      },
    });

    if (!session.url) {
      throw new AppError('Could not create Stripe checkout URL', 500);
    }

    return {
      id: session.id,
      url: session.url,
    };
  }

  async upgradePlan(
    organizationId: string,
    newPlan: PlanType,
    billingCycle: BillingCycle = 'monthly'
  ): Promise<Organization> {
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
      subscription_ends_at:
        newPlan === 'free'
          ? null
          : new Date(
              Date.now() +
                (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
            ),
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

    const stripeSubscriptionId = organization.stripe_subscription_id;
    if (stripeSubscriptionId) {
      const stripe = this.getStripeClient();
      const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await organization.update({
        subscription_status: 'canceled',
        subscription_ends_at: this.resolveSubscriptionEndDate(subscription),
      });
    } else {
      // Keep access until the end of the billing period
      await organization.update({
        subscription_status: 'canceled',
      });
    }

    return organization;
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.includes('your_webhook_secret_here')) {
      throw new AppError('Stripe webhook secret is not configured', 500);
    }

    const stripe = this.getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.handleCheckoutCompleted(session);
      return;
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await this.handleSubscriptionChanged(subscription);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organization_id;
    const plan = session.metadata?.plan as PlanType | undefined;
    if (!organizationId || !plan) {
      return;
    }

    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      return;
    }

    const limits = this.applyPlanLimits(organization, plan);
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    await organization.update({
      plan,
      ...limits,
      stripe_customer_id: customerId || organization.stripe_customer_id,
      stripe_subscription_id: subscriptionId || organization.stripe_subscription_id,
      subscription_status: 'active',
    });

    if (subscriptionId) {
      const stripe = this.getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await organization.update({
        subscription_status: subscription.status,
        subscription_ends_at: this.resolveSubscriptionEndDate(subscription),
      });
    }
  }

  private async handleSubscriptionChanged(subscription: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const organization = await Organization.findOne({
      where: { stripe_customer_id: customerId },
    });

    if (!organization) {
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id;
    const mappedPlan = priceId ? this.resolvePlanByPriceId(priceId) : null;

    await organization.update({
      plan: mappedPlan?.plan || organization.plan,
      ...(mappedPlan ? this.applyPlanLimits(organization, mappedPlan.plan) : {}),
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_ends_at: this.resolveSubscriptionEndDate(subscription),
    });
  }

  private resolveSubscriptionEndDate(
    subscription: Stripe.Response<Stripe.Subscription> | Stripe.Subscription
  ): Date | null {
    const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
    if (itemPeriodEnd) {
      return new Date(itemPeriodEnd * 1000);
    }

    if (subscription.cancel_at) {
      return new Date(subscription.cancel_at * 1000);
    }

    if (subscription.trial_end) {
      return new Date(subscription.trial_end * 1000);
    }

    return null;
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
