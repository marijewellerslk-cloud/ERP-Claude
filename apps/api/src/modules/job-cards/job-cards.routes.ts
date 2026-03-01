import { Router } from 'express';
import { jobCardsController } from './job-cards.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Define permissions for job cards module
const RESOURCES = {
  JOB_CARDS: 'job_cards',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
} as const;

const router = Router();

// All job card routes require authentication
router.use(authenticate);

// Statistics route (must be before :jobCardId routes)
router.get(
  '/statistics',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.READ),
  (req, res) => jobCardsController.getStatistics(req, res)
);

// List job cards
router.get(
  '/',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.READ),
  (req, res) => jobCardsController.listJobCards(req, res)
);

// Create job card
router.post(
  '/',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.CREATE),
  (req, res) => jobCardsController.createJobCard(req, res)
);

// Get job card by ID
router.get(
  '/:jobCardId',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.READ),
  (req, res) => jobCardsController.getJobCard(req, res)
);

// Record metal return
router.put(
  '/:jobCardId/return',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.UPDATE),
  (req, res) => jobCardsController.recordReturn(req, res)
);

// Settle job card (mark labour as paid)
router.put(
  '/:jobCardId/settle',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.UPDATE),
  (req, res) => jobCardsController.settleJobCard(req, res)
);

// Update job card status
router.patch(
  '/:jobCardId/status',
  requirePermission(RESOURCES.JOB_CARDS, ACTIONS.UPDATE),
  (req, res) => jobCardsController.updateStatus(req, res)
);

export default router;
