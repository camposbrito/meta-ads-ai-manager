import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Organization } from '../models';
import billingService, { PlanType } from '../services/BillingService';

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
            'Priority Support',
            'Dedicated Account Manager',
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

      res.json({
        plan: {
          id: organization.plan,
          name: organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1),
          status: organization.subscription_status,
          ends_at: organization.subscription_ends_at,
          limits,
          usage: {
            ad_accounts: organization.max_ad_accounts,
            daily_syncs: organization.max_daily_syncs,
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

      const organization = await billingService.upgradePlan(req.user.organizationId, plan as PlanType);

      // In production, this would create a Stripe checkout session
      res.json({
        message: 'Plan upgraded successfully',
        plan: organization.plan,
        // checkout_url: stripeSession.url, // Would redirect to Stripe
      });
    } catch (error) {
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
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new BillingController();
