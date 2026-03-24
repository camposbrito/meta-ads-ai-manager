import dotenv from 'dotenv';
import scheduledJobs from './jobs/scheduledJobs';

dotenv.config();

console.log('Starting worker process...');

// Start scheduled jobs
scheduledJobs.start();

console.log('Worker process started. Waiting for jobs...');

// Keep the process running
process.on('SIGINT', () => {
  console.log('Shutting down worker...');
  scheduledJobs.stop();
  process.exit(0);
});
