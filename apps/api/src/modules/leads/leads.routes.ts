import { Router } from 'express';
import { leadsController } from './leads.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  CUSTOMERS: 'customers', // Using customers permission for leads as well
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
} as const;

const router = Router();

// WhatsApp webhook (no auth required for incoming webhooks)
router.post('/webhook/:storeId', (req, res) => leadsController.handleWebhook(req, res));

// All other routes require authentication
router.use(authenticate);

// Lead CRUD
router.post(
  '/',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => leadsController.createLead(req, res)
);

router.get(
  '/',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.listLeads(req, res)
);

router.get(
  '/pipeline',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.getPipeline(req, res)
);

router.get(
  '/stats',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.getStats(req, res)
);

router.get(
  '/follow-ups',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.getFollowUps(req, res)
);

router.post(
  '/bulk-assign',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => leadsController.bulkAssign(req, res)
);

router.get(
  '/:leadId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.getLead(req, res)
);

router.put(
  '/:leadId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => leadsController.updateLead(req, res)
);

// Lead conversion
router.post(
  '/:leadId/convert',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => leadsController.convertToCustomer(req, res)
);

router.post(
  '/:leadId/lost',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => leadsController.markAsLost(req, res)
);

// Lead communication
router.get(
  '/:leadId/messages',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => leadsController.getMessages(req, res)
);

router.post(
  '/:leadId/messages',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => leadsController.sendMessage(req, res)
);

export default router;
