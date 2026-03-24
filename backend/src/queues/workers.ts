import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import SyncService from '../services/SyncService';
import OptimizationEngine from '../services/OptimizationEngine';

dotenv.config();

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Queue definitions
export const syncQueue = new Queue('sync-queue', { connection: redisConnection });
export const optimizationQueue = new Queue('optimization-queue', { connection: redisConnection });
export const scheduledSyncQueue = new Queue('scheduled-sync-queue', { connection: redisConnection });

// Sync job processor
const syncWorker = new Worker(
  'sync-queue',
  async (job: Job) => {
    const { adAccountId, jobType } = job.data;
    console.log(`Processing sync job ${job.id} for ad account ${adAccountId}`);
    await SyncService.syncAdAccount(adAccountId, jobType);
    console.log(`Sync job ${job.id} completed`);
  },
  { connection: redisConnection, concurrency: 5 }
);

// Optimization job processor
const optimizationWorker = new Worker(
  'optimization-queue',
  async (job: Job) => {
    const { adAccountId } = job.data;
    console.log(`Processing optimization job ${job.id} for ad account ${adAccountId}`);
    const result = await OptimizationEngine.evaluateAdAccount(adAccountId);
    console.log(`Optimization job ${job.id} completed. Generated ${result.suggestionsGenerated} suggestions`);
    return result;
  },
  { connection: redisConnection, concurrency: 3 }
);

// Scheduled sync processor
const scheduledSyncWorker = new Worker(
  'scheduled-sync-queue',
  async (job: Job) => {
    const { adAccountId } = job.data;
    console.log(`Processing scheduled sync for ad account ${adAccountId}`);
    await SyncService.syncAdAccount(adAccountId, 'incremental_sync');
    
    // After sync, run optimization
    await optimizationQueue.add('optimize', { adAccountId });
  },
  { connection: redisConnection, concurrency: 5 }
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await syncWorker.close();
  await optimizationWorker.close();
  await scheduledSyncWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

export { syncWorker, optimizationWorker, scheduledSyncWorker };
