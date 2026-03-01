import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import salesRoutes from './modules/sales/sales.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import loansRoutes from './modules/loans/loans.routes.js';
import suppliersRoutes from './modules/suppliers/suppliers.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import labelsRoutes from './modules/labels/labels.routes.js';
import leadsRoutes from './modules/leads/leads.routes.js';
import repairsRoutes from './modules/repairs/repairs.routes.js';
import customOrdersRoutes from './modules/custom-orders/custom-orders.routes.js';
import accountingRoutes from './modules/accounting/accounting.routes.js';
import hrmRoutes from './modules/hrm/hrm.routes.js';
import commandCenterRoutes from './modules/command-center/command-center.routes.js';
import metalRoutes from './modules/metal/metal.routes.js';
import karigarsRoutes from './modules/karigars/karigars.routes.js';
import jobCardsRoutes from './modules/job-cards/job-cards.routes.js';
import scrapRoutes from './modules/scrap/scrap.routes.js';
import storesRoutes from './modules/stores/stores.routes.js';
import pawningRoutes from './modules/pawning/pawning.routes.js';
import backupRoutes from './modules/backup/backup.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import marketDataRoutes from './modules/market/market.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import goldLedgerRoutes from './modules/gold-ledger/gold-ledger.routes.js';
import aiReportRoutes from './modules/ai-reports/ai-report.routes.js';
import printRoutes from './modules/print/print.routes.js';
import { apiLimiter, authLimiter } from './middleware/rate-limiter.middleware.js';
import { timeRestrictionMiddleware } from './middleware/time-restriction.middleware.js';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parser
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API version prefix
  app.get('/api/v1', (req, res) => {
    res.json({
      message: 'MARI Jewellers ERP API',
      version: '1.0.0',
      status: 'operational',
    });
  });

  // Route handlers
  // Apply global rate limiter
  app.use('/api', apiLimiter);

  // Apply strict rate limiter to auth routes
  app.use('/api/v1/auth', authLimiter);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/sales', salesRoutes);
  app.use('/api/v1/customers', customersRoutes);
  app.use('/api/v1/loans', loansRoutes);
  app.use('/api/v1/suppliers', suppliersRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/labels', labelsRoutes);
  app.use('/api/v1/leads', leadsRoutes);
  app.use('/api/v1/repairs', repairsRoutes);
  app.use('/api/v1/custom-orders', customOrdersRoutes);
  app.use('/api/v1/accounting', accountingRoutes);
  app.use('/api/v1/hrm', hrmRoutes);
  app.use('/api/v1/command-center', commandCenterRoutes);
  app.use('/api/v1/metal', metalRoutes);
  app.use('/api/v1/karigars', karigarsRoutes);
  app.use('/api/v1/job-cards', jobCardsRoutes);
  app.use('/api/v1/scrap', scrapRoutes);
  app.use('/api/v1/stores', storesRoutes);
  app.use('/api/v1/pawning', pawningRoutes);
  app.use('/api/v1/backups', backupRoutes);
  app.use('/api/v1/upload', uploadRoutes);
  app.use('/api/v1/market-data', marketDataRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/gold-ledger', goldLedgerRoutes);
  app.use('/api/v1/ai-reports', aiReportRoutes);
  app.use('/api/v1/print', printRoutes);

  // Serve static files (for local uploads)
  app.use('/api/static', express.static('public'));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);

    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        ...(env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
  });

  return app;
}
