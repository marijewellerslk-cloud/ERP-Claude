import { Router } from 'express';
import { backupController } from './backup.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
const RESOURCES = { BACKUPS: 'backups' } as const;
const ACTIONS = { CREATE: 'create', READ: 'read', DELETE: 'delete' } as const;

const router = Router();

// Apply authentication to all backup routes
router.use(authenticate);

// Create a new backup
router.post(
  '/', 
  requirePermission(RESOURCES.BACKUPS, ACTIONS.CREATE),
  backupController.createBackup.bind(backupController)
);

// List all backups
router.get(
  '/',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.READ),
  backupController.listBackups.bind(backupController)
);

// Get backup statistics
router.get(
  '/stats',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.READ),
  backupController.getBackupStats.bind(backupController)
);

// Perform health check
router.get(
  '/health',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.READ),
  backupController.performHealthCheck.bind(backupController)
);

// Cleanup old backups
router.delete(
  '/cleanup',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.DELETE),
  backupController.cleanupOldBackups.bind(backupController)
);

// Restore from backup
router.post(
  '/restore',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.CREATE), // Using CREATE as restore is a destructive operation
  backupController.restoreFromBackup.bind(backupController)
);

// Get backup info
router.get(
  '/info',
  requirePermission(RESOURCES.BACKUPS, ACTIONS.READ),
  backupController.getBackupInfo.bind(backupController)
);

export default router;