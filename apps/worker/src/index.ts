import { Worker, Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { garminSyncJob } from './jobs/garmin-sync';
import { stravaSyncJob } from './jobs/strava-sync';
import { calendarSyncJob } from './jobs/calendar-sync';
import { morningReportJob } from './jobs/morning-report';
import { weeklyPlanJob } from './jobs/weekly-plan';
import { setupSchedules } from './schedules';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Create queues
const queues = {
  garminSync: new Queue('garmin-sync', { connection }),
  stravaSync: new Queue('strava-sync', { connection }),
  calendarSync: new Queue('calendar-sync', { connection }),
  morningReport: new Queue('morning-report', { connection }),
  weeklyPlan: new Queue('weekly-plan', { connection }),
};

// Create workers
const workers = [
  new Worker('garmin-sync', garminSyncJob, { connection, concurrency: 3 }),
  new Worker('strava-sync', stravaSyncJob, { connection, concurrency: 3 }),
  new Worker('calendar-sync', calendarSyncJob, { connection, concurrency: 3 }),
  new Worker('morning-report', morningReportJob, { connection, concurrency: 2 }),
  new Worker('weekly-plan', weeklyPlanJob, { connection, concurrency: 1 }),
];

// Error handling
workers.forEach((worker) => {
  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`[${worker.name}] Job ${job.id} completed`);
  });
});

// Setup cron schedules (currently commented out in schedules.ts)
setupSchedules(queues);

console.log('🚀 Worker service started, listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
});
