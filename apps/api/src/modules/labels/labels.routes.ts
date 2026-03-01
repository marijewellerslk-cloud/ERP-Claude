import { Router } from 'express';
import { labelsController } from './labels.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get default template (any authenticated user)
router.get('/default', (req, res) => labelsController.getDefaultTemplate(req, res));

// List all templates (any authenticated user)
router.get('/', (req, res) => labelsController.listTemplates(req, res));

// Get a single template (any authenticated user)
router.get('/:templateId', (req, res) => labelsController.getTemplate(req, res));

// Create a new template (any authenticated user)
router.post('/', (req, res) => labelsController.createTemplate(req, res));

// Update a template (any authenticated user)
router.put('/:templateId', (req, res) => labelsController.updateTemplate(req, res));

// Delete a template (any authenticated user)
router.delete('/:templateId', (req, res) => labelsController.deleteTemplate(req, res));

// Set a template as default (any authenticated user)
router.post('/:templateId/set-default', (req, res) => labelsController.setDefaultTemplate(req, res));

// Duplicate a template (any authenticated user)
router.post('/:templateId/duplicate', (req, res) => labelsController.duplicateTemplate(req, res));

export default router;
