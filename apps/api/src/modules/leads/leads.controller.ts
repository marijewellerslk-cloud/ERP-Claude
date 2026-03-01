import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';
import { leadService } from '../../services/lead.service.js';
import { whatsappService } from '../../services/whatsapp.service.js';

export class LeadsController {
  async createLead(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const lead = await leadService.createOrUpdateLead({
        storeId: req.user.storeId,
        createdBy: req.user.userId,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        data: lead,
      });
    } catch (error: any) {
      logger.error('Create lead error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CREATE_LEAD_FAILED', message: error.message },
      });
    }
  }

  async getLead(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const lead = await leadService.getLead(leadId);

      if (!lead) {
        return res.status(404).json({
          success: false,
          error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found' },
        });
      }

      res.json({
        success: true,
        data: lead,
      });
    } catch (error: any) {
      logger.error('Get lead error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_LEAD_FAILED', message: error.message },
      });
    }
  }

  async updateLead(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const lead = await leadService.updateLead(leadId, req.body);

      res.json({
        success: true,
        data: lead,
      });
    } catch (error: any) {
      logger.error('Update lead error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_LEAD_FAILED', message: error.message },
      });
    }
  }

  async listLeads(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { stage, assignedTo, search, minScore, maxScore, limit, offset } = req.query;

      const leads = await leadService.getLeads(req.user.storeId, {
        stage: stage as string,
        assignedTo: assignedTo as string,
        search: search as string,
        minScore: minScore ? parseInt(minScore as string) : undefined,
        maxScore: maxScore ? parseInt(maxScore as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: leads,
      });
    } catch (error: any) {
      logger.error('List leads error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'LIST_LEADS_FAILED', message: error.message },
      });
    }
  }

  async getPipeline(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const pipeline = await leadService.getPipelineStats(req.user.storeId);

      res.json({
        success: true,
        data: pipeline,
      });
    } catch (error: any) {
      logger.error('Get pipeline error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_PIPELINE_FAILED', message: error.message },
      });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await leadService.getLeadStats(req.user.storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get lead stats error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_STATS_FAILED', message: error.message },
      });
    }
  }

  async getFollowUps(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { assignedTo } = req.query;
      const leads = await leadService.getLeadsNeedingFollowUp(
        req.user.storeId,
        assignedTo as string
      );

      res.json({
        success: true,
        data: leads,
      });
    } catch (error: any) {
      logger.error('Get follow-ups error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_FOLLOWUPS_FAILED', message: error.message },
      });
    }
  }

  async convertToCustomer(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const { firstName, lastName, email, customerCode, invoiceId, invoiceAmount } = req.body;

      const customer = await leadService.convertToCustomer(
        leadId,
        { firstName, lastName, email, customerCode },
        invoiceId,
        invoiceAmount
      );

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      logger.error('Convert lead error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CONVERT_LEAD_FAILED', message: error.message },
      });
    }
  }

  async markAsLost(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const { reason } = req.body;

      const lead = await leadService.markAsLost(leadId, reason);

      res.json({
        success: true,
        data: lead,
      });
    } catch (error: any) {
      logger.error('Mark lead lost error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'MARK_LOST_FAILED', message: error.message },
      });
    }
  }

  async bulkAssign(req: AuthRequest, res: Response) {
    try {
      const { leadIds, assignedTo } = req.body;

      const leads = await leadService.bulkAssign(leadIds, assignedTo);

      res.json({
        success: true,
        data: leads,
      });
    } catch (error: any) {
      logger.error('Bulk assign error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'BULK_ASSIGN_FAILED', message: error.message },
      });
    }
  }

  async getMessages(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const { limit } = req.query;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const messages = await whatsappService.getMessageHistory(
        req.user.storeId,
        undefined,
        undefined,
        leadId,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      logger.error('Get lead messages error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_MESSAGES_FAILED', message: error.message },
      });
    }
  }

  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { leadId } = req.params;
      const { message, phoneNumber } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      if (!whatsappService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: { code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp is not configured' },
        });
      }

      const result = await whatsappService.sendMessage({
        phoneNumber,
        message,
        storeId: req.user.storeId,
        leadId,
        sentBy: req.user.userId,
      });

      res.json({
        success: result.success,
        data: { messageId: result.messageId },
        error: result.error ? { message: result.error } : undefined,
      });
    } catch (error: any) {
      logger.error('Send lead message error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SEND_MESSAGE_FAILED', message: error.message },
      });
    }
  }

  // WhatsApp webhook handler
  async handleWebhook(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const webhookData = req.body;

      // Verify it's an incoming message
      if (webhookData.typeWebhook === 'incomingMessageReceived') {
        await whatsappService.handleIncomingMessage(webhookData, storeId);
      }

      // Always respond with 200 to acknowledge webhook
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('Webhook handler error:', error);
      res.status(200).send('OK'); // Still respond 200 to prevent retries
    }
  }
}

export const leadsController = new LeadsController();
