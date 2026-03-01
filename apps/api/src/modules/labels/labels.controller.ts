import { Response } from 'express';
import { labelsService } from './labels.service.js';
import {
  createLabelTemplateSchema,
  updateLabelTemplateSchema,
} from './labels.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export class LabelsController {
  // Create new label template
  async createTemplate(req: AuthRequest, res: Response) {
    try {
      const validatedData = createLabelTemplateSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.createTemplate(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      logger.error('Create label template error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_TEMPLATE_FAILED',
          message: error.message || 'Failed to create label template',
        },
      });
    }
  }

  // List all label templates
  async listTemplates(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const includeInactive = req.query.includeInactive === 'true';
      const templates = await labelsService.listTemplates(
        req.user.storeId,
        includeInactive
      );

      res.json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      logger.error('List label templates error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_TEMPLATES_FAILED',
          message: 'Failed to list label templates',
        },
      });
    }
  }

  // Get a single label template
  async getTemplate(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.getTemplate(
        templateId,
        req.user.storeId
      );

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      logger.error('Get label template error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: error.message || 'Label template not found',
        },
      });
    }
  }

  // Get the default template
  async getDefaultTemplate(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.getDefaultTemplate(req.user.storeId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_DEFAULT_TEMPLATE',
            message: 'No default template found',
          },
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      logger.error('Get default template error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_DEFAULT_TEMPLATE_FAILED',
          message: 'Failed to get default template',
        },
      });
    }
  }

  // Update a label template
  async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.params;
      const validatedData = updateLabelTemplateSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.updateTemplate(
        templateId,
        req.user.storeId,
        validatedData,
        req.user.userId
      );

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      logger.error('Update label template error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_TEMPLATE_FAILED',
          message: error.message || 'Failed to update label template',
        },
      });
    }
  }

  // Delete a label template
  async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await labelsService.deleteTemplate(templateId, req.user.storeId);

      res.json({
        success: true,
        message: 'Label template deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete label template error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_TEMPLATE_FAILED',
          message: error.message || 'Failed to delete label template',
        },
      });
    }
  }

  // Set a template as default
  async setDefaultTemplate(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.setDefaultTemplate(
        templateId,
        req.user.storeId
      );

      res.json({
        success: true,
        data: template,
        message: 'Default template set successfully',
      });
    } catch (error: any) {
      logger.error('Set default template error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'SET_DEFAULT_FAILED',
          message: error.message || 'Failed to set default template',
        },
      });
    }
  }

  // Duplicate a template
  async duplicateTemplate(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.params;
      const { name } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const template = await labelsService.duplicateTemplate(
        templateId,
        req.user.storeId,
        req.user.userId,
        name
      );

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template duplicated successfully',
      });
    } catch (error: any) {
      logger.error('Duplicate template error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_TEMPLATE_FAILED',
          message: error.message || 'Failed to duplicate template',
        },
      });
    }
  }
}

export const labelsController = new LabelsController();
