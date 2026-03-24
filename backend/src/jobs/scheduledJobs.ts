import { CronJob } from 'cron';
import { AdAccount, Organization } from '../models';
import { scheduledSyncQueue, optimizationQueue } from './workers';
import { Op } from 'sequelize';

export class ScheduledJobs {
  // Daily sync job - runs at 6 AM UTC
  private dailySyncJob: CronJob;

  // Hourly optimization check
  private optimizationCheckJob: CronJob;

  constructor() {
    // Daily sync at 6 AM UTC
    this.dailySyncJob = new CronJob(
      '0 6 * * *',
      async () => {
        console.log('Running daily sync for all active ad accounts');
        await this.runDailySync();
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
  }

  start(): void {
    this.dailySyncJob.start();
    this.optimizationCheckJob.start();
    console.log('Scheduled jobs started');
  }

  stop(): void {
    this.dailySyncJob.stop();
    this.optimizationCheckJob.stop();
    console.log('Scheduled jobs stopped');
  }

  private async runDailySync(): Promise<void> {
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

    for (const adAccount of adAccounts) {
      try {
        await scheduledSyncQueue.add('daily-sync', {
          adAccountId: adAccount.id,
        });
      } catch (error) {
        console.error(`Failed to queue sync for ad account ${adAccount.id}:`, error);
      }
    }

    console.log(`Queued daily sync for ${adAccounts.length} ad accounts`);
  }

  private async runOptimizationCheck(): Promise<void> {
    const adAccounts = await AdAccount.findAll({
      where: {
        is_active: true,
        last_synced_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Synced in last 24 hours
        },
      },
    });

    for (const adAccount of adAccounts) {
      try {
        await optimizationQueue.add('optimize', {
          adAccountId: adAccount.id,
        });
      } catch (error) {
        console.error(`Failed to queue optimization for ad account ${adAccount.id}:`, error);
      }
    }

    console.log(`Queued optimization check for ${adAccounts.length} ad accounts`);
  }
}

export default new ScheduledJobs();
