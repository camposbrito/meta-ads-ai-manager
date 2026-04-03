import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Organization, User, AdAccount } from '../models';
import { hashPassword } from '../services/PasswordService';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import billingService from '../services/BillingService';

export class OrganizationController {
  async getOrganization(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organization = await Organization.findByPk(req.user.organizationId, {
        attributes: {
          exclude: ['stripe_customer_id', 'stripe_subscription_id'],
        },
      });

      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const memberCount = await User.count({
        where: { organization_id: organization.id, is_active: true },
      });

      const adAccountCount = await AdAccount.count({
        where: { organization_id: organization.id, is_active: true },
      });

      res.json({
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          max_ad_accounts: organization.max_ad_accounts,
          max_daily_syncs: organization.max_daily_syncs,
          subscription_status: organization.subscription_status,
          subscription_ends_at: organization.subscription_ends_at,
          member_count: memberCount,
          ad_account_count: adAccountCount,
          created_at: organization.created_at,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateOrganization(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { name } = req.body;

      const organization = await Organization.findByPk(req.user.organizationId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      await organization.update({ name });

      res.json({
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const members = await User.findAll({
        where: { organization_id: req.user.organizationId, is_active: true },
        attributes: ['id', 'email', 'name', 'role', 'last_login_at', 'created_at'],
        order: [['created_at', 'ASC']],
      });

      res.json({
        members: members.map((m) => ({
          id: m.id,
          email: m.email,
          name: m.name,
          role: m.role,
          last_login_at: m.last_login_at,
          created_at: m.created_at,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async addMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { email, name, role = 'member' } = req.body;

      if (!email || !name) {
        res.status(400).json({ error: 'Email and name required' });
        return;
      }

      const organization = await Organization.findByPk(req.user.organizationId);
      if (!organization) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const activeMembersCount = await User.count({
        where: { organization_id: req.user.organizationId, is_active: true },
      });
      const limits = billingService.getPlanLimits(organization.plan as 'free' | 'pro' | 'agency');
      if (activeMembersCount >= limits.max_users) {
        res.status(403).json({
          error: 'Maximum number of team members reached for your plan',
          details: {
            max_users: limits.max_users,
            current_users: activeMembersCount,
          },
        });
        return;
      }

      const existingUser = await User.findOne({
        where: { email, organization_id: req.user.organizationId },
      });

      if (existingUser) {
        res.status(409).json({ error: 'User already exists in this organization' });
        return;
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).substring(2, 10);
      const passwordHash = await hashPassword(tempPassword);

      const user = await User.create({
        id: uuidv4(),
        organization_id: req.user.organizationId,
        email,
        password_hash: passwordHash,
        name,
        role: role as 'admin' | 'member',
        is_active: true,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        temporary_password: tempPassword,
        message: 'User created. Share the temporary password securely.',
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { id } = req.params;

      if (id === req.user.userId) {
        res.status(400).json({ error: 'Cannot remove yourself' });
        return;
      }

      const user = await User.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      await user.update({ is_active: false });

      res.json({ message: 'User removed' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!role || !['admin', 'member'].includes(role)) {
        res.status(400).json({ error: 'Valid role required' });
        return;
      }

      const user = await User.findOne({
        where: { id, organization_id: req.user.organizationId },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      await user.update({ role });

      res.json({ message: 'Role updated' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new OrganizationController();
