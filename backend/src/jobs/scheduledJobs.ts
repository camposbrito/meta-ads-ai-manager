import { CronJob } from 'cron';
import { AdAccount, Insight, Organization } from '../models';
import { scheduledSyncQueue, optimizationQueue } from '../queues/workers';
import { Op } from 'sequelize';
import billingService, { PlanType } from '../services/BillingService';
import SyncService from '../services/SyncService';

export class ScheduledJobs {
  // Sync planner - runs hourly and schedules based on plan limits.
  private syncPlannerJob: CronJob;

  // Hourly optimization check for plans with auto optimization enabled.
  private optimizationCheckJob: CronJob;

  // Daily data retention cleanup.
  private retentionCleanupJob: CronJob;

  constructor() {
    // Sync planning every hour.
    this.syncPlannerJob = new CronJob(
      '0 * * * *',
      async () => {
        console.log('Running scheduled sync planner');
        await this.runPlannedSync();
      },
      null,
      true,
      'UTC'
    );

    // Optimization check every hour
    this.optimizationCheckJob = new CronJob(
      '0 * * * *',
      async () => {
        console.log('Running hourly optimization check');
        await this.runOptimizationCheck();
      },
      null,
      true,
      'UTC'
    );

    // Data retention cleanup at 2:30 AM UTC.
    this.retentionCleanupJob = new CronJob(
      '30 2 * * *',
      async () => {
        console.log('Running data retention cleanup');
        await this.runDataRetentionCleanup();
      },
      null,
      true,
      'UTC'
    );
  }

  start(): void {
    this.syncPlannerJob.start();
    this.optimizationCheckJob.start();
    this.retentionCleanupJob.start();
    console.log('Scheduled jobs started');
  }

  stop(): void {
    this.syncPlannerJob.stop();
    this.optimizationCheckJob.stop();
    this.retentionCleanupJob.stop();
    console.log('Scheduled jobs stopped');
  }

  private async runPlannedSync(): Promise<void> {
    const adAccounts = await AdAccount.findAll({
      where: { is_active: true },
      include: [
        {
          model: Organization,
          as: 'organization',
          where: { is_active: true },
        },
      ],
    });

    let queuedCount = 0;
    for (const adAccount of adAccounts) {
      try {
        if (!adAccount.organization) {
          continue;
        }

        const canSyncToday = await SyncService.canSyncToday(adAccount.id);
        if (!canSyncToday) {
          continue;
        }

        if (
          !this.shouldQueueScheduledSync(
            adAccount.last_synced_at,
            adAccount.organization.max_daily_syncs
          )
        ) {
          continue;
        }

        await scheduledSyncQueue.add('daily-sync', {
          adAccountId: adAccount.id,
        });
        queuedCount++;
      } catch (error) {
        console.error(`Failed to queue sync for ad account ${adAccount.id}:`, error);
      }
    }

    console.log(`Queued scheduled sync for ${queuedCount} ad accounts`);
  }

  private async runOptimizationCheck(): Promise<void> {
    const adAccounts = await AdAccount.findAll({
      where: {
        is_active: true,
        last_synced_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Synced in last 24 hours
        },
      },
      include: [
        {
          model: Organization,
          as: 'organization',
          where: { is_active: true },
          attributes: ['plan'],
        },
      ],
    });

    let queuedCount = 0;
    for (const adAccount of adAccounts) {
      try {
        if (!adAccount.organization) {
          continue;
        }

        const planLimits = billingService.getPlanLimits(
          adAccount.organization.plan as PlanType
        );
        if (!planLimits.auto_optimization_enabled) {
          continue;
        }

        await optimizationQueue.add('optimize', {
          adAccountId: adAccount.id,
        });
        queuedCount++;
      } catch (error) {
        console.error(`Failed to queue optimization for ad account ${adAccount.id}:`, error);
      }
    }

    console.log(`Queued optimization check for ${queuedCount} ad accounts`);
  }

  private async runDataRetentionCleanup(): Promise<void> {
    const organizations = await Organization.findAll({
      where: { is_active: true },
      attributes: ['id', 'plan'],
    });

    let totalDeleted = 0;

    for (const organization of organizations) {
      const retentionDays = billingService.getPlanLimits(
        organization.plan as PlanType
      ).data_retention_days;
      const cutoffDate = this.getCutoffDate(retentionDays);

      const adAccounts = await AdAccount.findAll({
        where: { organization_id: organization.id },
        attributes: ['id'],
      });

      const adAccountIds = adAccounts.map((account) => account.id);
      if (adAccountIds.length === 0) {
        continue;
      }

      const deletedCount = await Insight.destroy({
        where: {
          ad_account_id: { [Op.in]: adAccountIds },
          date: { [Op.lt]: cutoffDate },
        },
      });

      totalDeleted += deletedCount;
    }

    console.log(`Data retention cleanup removed ${totalDeleted} insight rows`);
  }

  private shouldQueueScheduledSync(
    lastSyncedAt: Date | null,
    maxDailySyncs: number
  ): boolean {
    const safeMaxDailySyncs = Math.max(1, maxDailySyncs);
    const intervalHours = Math.max(1, Math.floor(24 / safeMaxDailySyncs));

    if (!lastSyncedAt) {
      return true;
    }

    return Date.now() - lastSyncedAt.getTime() >= intervalHours * 60 * 60 * 1000;
  }

  private getCutoffDate(retentionDays: number): string {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    return cutoff.toISOString().split('T')[0];
  }
}

export default new ScheduledJobs();
