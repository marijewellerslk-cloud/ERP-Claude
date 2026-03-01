import { createApp } from './app.js';
import { env } from './config/env.js';
import { testDatabaseConnection } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { schedulerService } from './services/scheduler.service.js';
import { backupSchedulerService } from './modules/backup/backup.scheduler.service.js';

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Connect to Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.warn('⚠️  Redis connection failed, continuing without cache');
    }

    // Initialize scheduler for daily briefings and other jobs
    await schedulerService.initialize();
    
    // Initialize backup scheduler
    await backupSchedulerService.initialize();
    backupSchedulerService.start();

    // Create and start Express app
    const app = createApp();

    app.listen(env.API_PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🏪  MARI Jewellers ERP API Server                ║
║                                                       ║
║     Environment: ${env.NODE_ENV.padEnd(34)}║
║     Port: ${env.API_PORT.toString().padEnd(42)}║
║     API URL: http://localhost:${env.API_PORT}/api/v1${' '.repeat(10)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      schedulerService.stopAll();
      backupSchedulerService.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      schedulerService.stopAll();
      backupSchedulerService.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
