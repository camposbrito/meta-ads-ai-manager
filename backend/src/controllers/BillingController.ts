import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AdAccount, Organization, User } from '../models';
import billingService, { BillingCycle, PlanType } from '../services/BillingService';
import { AppError } from '../middleware/errorHandler';
import type { Request } from 'express';

export class BillingController {
  async getPlans(req: AuthRequest, res: Response): Promise<void> {
    try {
      const plans = [
        {
          id: 'free',
          name: 'Free',
          description: 'Perfect for getting started',
          monthly_price: 0,
          yearly_price: 0,
          features: [
            '1 Ad Account',
            '1 Daily Sync',
            '2 Team Members',
            'Basic Optimization',
            '30 Days Data Retention',
            'Community Support',
          ],
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'For growing businesses',
          monthly_price: 49,
          yearly_price: 470,
          features: [
            '5 Ad Accounts',
            '4 Daily Syncs',
            '10 Team Members',
            'Advanced Optimization',
            'Auto-optimization',
            '90 Days Data Retention',
            'Email Support',
          ],
          popular: true,
        },
        {
          id: 'agency',
          name: 'Agency',
          description: 'For agencies and large teams',
          monthly_price: 199,
          yearly_price: 1910,
          features: [
            '50 Ad Accounts',
            '24 Daily Syncs (hourly)',
            '100 Team Members',
            'Full Optimization Suite',
            'Auto-optimization',
            '365 Days Data Retention',
            'Priority Support (SLA)',
            'Dedicated Success Channel',
          ],
        },
      ];

      res.json({ plans });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getCurrentPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organization = await Organization.findByPk(req.user.organizationId, {
        attributes: [
          'id',
          'name',
          'plan',
          'max_ad_accounts',
          'max_daily_syncs',
          'subscription_status',
          'subscription_ends_at',
        ],
      });

      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const limits = billingService.getPlanLimits(organization.plan as PlanType);
      const [adAccounts, userCount] = await Promise.all([
        AdAccount.findAll({
          where: { organization_id: organization.id, is_active: true },
          attributes: ['id', 'daily_sync_count', 'last_sync_date'],
        }),
        User.count({ where: { organization_id: organization.id, is_active: true } }),
      ]);
      const today = new Date().toISOString().split('T')[0];
      const dailySyncUsage = adAccounts.reduce((sum, account) => {
        if (account.last_sync_date !== today) {
          return sum;
        }
        return sum + Number(account.daily_sync_count || 0);
      }, 0);

      res.json({
        plan: {
          id: organization.plan,
          name: organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1),
          status: organization.subscription_status,
          ends_at: organization.subscription_ends_at,
          limits,
          usage: {
            ad_accounts: adAccounts.length,
            daily_syncs: dailySyncUsage,
            users: userCount,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async upgradePlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { plan, billing_cycle = 'monthly' } = req.body;

      if (!plan || !['free', 'pro', 'agency'].includes(plan)) {
        res.status(400).json({ error: 'Valid plan required' });
        return;
      }

      if (!['monthly', 'yearly'].includes(billing_cycle)) {
        res.status(400).json({ error: 'billing_cycle must be monthly or yearly' });
        return;
      }

      if (plan === 'free') {
        const organization = await billingService.downgradePlan(req.user.organizationId, 'free');
        res.json({
          message: 'Plan changed successfully',
          plan: organization.plan,
        });
        return;
      }

      const checkout = await billingService.createCheckoutSession(
        req.user.organizationId,
        plan as PlanType,
        billing_cycle as BillingCycle
      );

      res.json({
        message: 'Checkout session created',
        checkout_url: checkout.url,
        session_id: checkout.id,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async cancelSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const organization = await billingService.cancelSubscription(req.user.organizationId);

      res.json({
        message: 'Subscription canceled. Access continues until the end of the billing period.',
        subscription_ends_at: organization.subscription_ends_at,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSupportOptions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organization = await Organization.findByPk(req.user.organizationId, {
        attributes: ['plan'],
      });

      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const plan = organization.plan as PlanType;
      const limits = billingService.getPlanLimits(plan);

      const optionsByPlan: Record<PlanType, Array<{ channel: string; label: string; value: string }>> = {
        free: [
          {
            channel: 'community',
            label: 'Comunidade',
            value: process.env.SUPPORT_COMMUNITY_URL || 'https://github.com/camposbrito/meta-ads-ai-manager/discussions',
          },
        ],
        pro: [
          {
            channel: 'email',
            label: 'Email',
            value: process.env.SUPPORT_EMAIL || 'suporte@metaadsai.local',
          },
        ],
        agency: [
          {
            channel: 'priority_email',
            label: 'Priority Email',
            value: process.env.SUPPORT_PRIORITY_EMAIL || process.env.SUPPORT_EMAIL || 'priority@metaadsai.local',
          },
          {
            channel: 'dedicated_channel',
            label: 'Canal Dedicado',
            value: process.env.SUPPORT_DEDICATED_CHANNEL_URL || 'https://wa.me/5500000000000',
          },
        ],
      };

      res.json({
        support: {
          support_level: limits.support_level,
          channels: optionsByPlan[plan],
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        throw new AppError('Missing stripe-signature header', 400);
      }

      if (!Buffer.isBuffer(req.body)) {
        throw new AppError('Invalid webhook payload', 400);
      }

      await billingService.handleStripeWebhook(req.body, signature);
      res.json({ received: true });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new BillingController();
