import { db } from '../config/database.js';
import { whatsappMessages, whatsappLeads, customers } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// WhatsApp Business API configuration
interface WhatsAppConfig {
  instanceId: string;
  apiToken: string;
  apiUrl: string;
}

interface SendMessageParams {
  phoneNumber: string;
  message: string;
  storeId: string;
  customerId?: string;
  leadId?: string;
  referenceType?: string;
  referenceId?: string;
  sentBy?: string;
}

interface SendTemplateParams {
  phoneNumber: string;
  templateName: string;
  templateParams: Record<string, string>;
  storeId: string;
  customerId?: string;
  leadId?: string;
  referenceType?: string;
  referenceId?: string;
  sentBy?: string;
}

interface SendMediaParams extends SendMessageParams {
  mediaUrl: string;
  mediaType: 'image' | 'document' | 'audio' | 'video';
  caption?: string;
}

class WhatsAppService {
  private config: WhatsAppConfig | null = null;

  constructor() {
    this.initConfig();
  }

  private initConfig() {
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.green-api.com';

    if (instanceId && apiToken) {
      this.config = { instanceId, apiToken, apiUrl };
      logger.info('WhatsApp service initialized successfully');
    } else {
      logger.warn('WhatsApp credentials not configured. WhatsApp features will be disabled.');
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  // Format phone number for WhatsApp (add country code if missing)
  private formatPhoneNumber(phone: string): string {
    // Remove any non-numeric characters except +
    let formatted = phone.replace(/[^\d+]/g, '');

    // If doesn't start with +, assume Sri Lankan number (default)
    if (!formatted.startsWith('+')) {
      // Remove leading 0 if present
      if (formatted.startsWith('0')) {
        formatted = formatted.substring(1);
      }
      // Add Sri Lanka country code if not present (checking for 94 prefix)
      // SL numbers are usually 9 digits (e.g., 771234567) without country code
      // If it's already 11 digits starting with 94, we don't add it.
      if (!formatted.startsWith('94')) {
        formatted = '94' + formatted;
      }
    } else {
      // Remove the + for API
      formatted = formatted.substring(1);
    }

    return formatted;
  }

  // Send a text message
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const { phoneNumber, message, storeId, customerId, leadId, referenceType, referenceId, sentBy } = params;
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    try {
      // Call Green API to send message
      const response = await fetch(
        `${this.config.apiUrl}/waInstance${this.config.instanceId}/sendMessage/${this.config.apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: `${formattedPhone}@c.us`,
            message: message,
          }),
        }
      );

      const result = await response.json() as { idMessage?: string; error?: string };

      // Log message to database
      const [savedMessage] = await db.insert(whatsappMessages).values({
        storeId,
        customerId,
        leadId,
        phoneNumber: formattedPhone,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        referenceType,
        referenceId,
        whatsappMessageId: result.idMessage,
        status: result.idMessage ? 'sent' : 'failed',
        errorMessage: result.error,
        sentBy,
        sentAt: new Date(),
      }).returning();

      if (result.idMessage) {
        logger.info(`WhatsApp message sent successfully: ${result.idMessage}`);
        return { success: true, messageId: savedMessage.id };
      } else {
        logger.error(`Failed to send WhatsApp message: ${result.error}`);
        return { success: false, error: result.error || 'Unknown error' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`WhatsApp send error: ${errorMessage}`);

      // Log failed message
      await db.insert(whatsappMessages).values({
        storeId,
        customerId,
        leadId,
        phoneNumber: formattedPhone,
        direction: 'outbound',
        messageType: 'text',
        content: message,
        referenceType,
        referenceId,
        status: 'failed',
        errorMessage,
        sentBy,
      });

      return { success: false, error: errorMessage };
    }
  }

  // Send a template message (for approved templates)
  async sendTemplateMessage(params: SendTemplateParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const { phoneNumber, templateName, templateParams, storeId, customerId, leadId, referenceType, referenceId, sentBy } = params;
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    try {
      // Green API doesn't have native template support, so we'll construct the message
      // In production, you'd use the official WhatsApp Business API for templates
      let message = this.getTemplateContent(templateName, templateParams);

      const response = await fetch(
        `${this.config.apiUrl}/waInstance${this.config.instanceId}/sendMessage/${this.config.apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: `${formattedPhone}@c.us`,
            message: message,
          }),
        }
      );

      const result = await response.json() as { idMessage?: string; error?: string };

      // Log message to database
      const [savedMessage] = await db.insert(whatsappMessages).values({
        storeId,
        customerId,
        leadId,
        phoneNumber: formattedPhone,
        direction: 'outbound',
        messageType: 'template',
        templateName,
        content: message,
        referenceType,
        referenceId,
        whatsappMessageId: result.idMessage,
        status: result.idMessage ? 'sent' : 'failed',
        errorMessage: result.error,
        sentBy,
        sentAt: new Date(),
      }).returning();

      return result.idMessage
        ? { success: true, messageId: savedMessage.id }
        : { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Send media (image, document, etc.)
  async sendMedia(params: SendMediaParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const { phoneNumber, mediaUrl, mediaType, caption, storeId, customerId, leadId, referenceType, referenceId, sentBy } = params;
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const endpoints: Record<string, string> = {
      image: 'sendFileByUrl',
      document: 'sendFileByUrl',
      audio: 'sendFileByUrl',
      video: 'sendFileByUrl',
    };

    try {
      const response = await fetch(
        `${this.config.apiUrl}/waInstance${this.config.instanceId}/${endpoints[mediaType]}/${this.config.apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: `${formattedPhone}@c.us`,
            urlFile: mediaUrl,
            caption: caption || '',
          }),
        }
      );

      const result = await response.json() as { idMessage?: string; error?: string };

      // Log message
      const [savedMessage] = await db.insert(whatsappMessages).values({
        storeId,
        customerId,
        leadId,
        phoneNumber: formattedPhone,
        direction: 'outbound',
        messageType: mediaType,
        content: caption,
        mediaUrl,
        referenceType,
        referenceId,
        whatsappMessageId: result.idMessage,
        status: result.idMessage ? 'sent' : 'failed',
        errorMessage: result.error,
        sentBy,
        sentAt: new Date(),
      }).returning();

      return result.idMessage
        ? { success: true, messageId: savedMessage.id }
        : { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Get template content based on template name
  private getTemplateContent(templateName: string, params: Record<string, string>): string {
    const templates: Record<string, string> = {
      'purchase_receipt': `Thank you for your purchase at MARI Jewellers!

Order #: {{invoiceNumber}}
Date: {{date}}
Amount: {{amount}}

Items:
{{items}}

Thank you for choosing us! Visit again.`,

      'wishlist_stock_alert': `Good news from MARI Jewellers!

An item matching your wishlist is now available:
{{itemDescription}}

Price: {{price}}
Weight: {{weight}}

Visit us or reply to this message to reserve it!`,

      'loyalty_milestone': `Congratulations! You've reached {{tierName}} status at MARI Jewellers!

Your Points: {{points}}
Benefits unlocked:
{{benefits}}

Thank you for being a valued customer!`,

      'loyalty_points_earned': `Thank you for your purchase!

You've earned {{pointsEarned}} loyalty points.
Total Points: {{totalPoints}}
Current Tier: {{tier}}

Redeem your points on your next visit!`,

      'welcome_new_customer': `Welcome to MARI Jewellers!

Dear {{customerName}},

Thank you for choosing us. As a welcome gift, you've received {{welcomePoints}} bonus points!

Start your jewelry journey with us today.`,

      'referral_thank_you': `Thank you for your referral!

Dear {{referrerName}},

Your referral {{referredName}} has made their first purchase!
You've earned {{rewardPoints}} bonus points.

Total Points: {{totalPoints}}

Keep spreading the word!`,

      'appointment_reminder': `Reminder from MARI Jewellers

Dear {{customerName}},

This is a reminder for your appointment:
Date: {{date}}
Time: {{time}}

We look forward to seeing you!`,

      'personalized_offer': `Exclusive Offer for You!

Dear {{customerName}},

Based on your preferences, we have a special offer:
{{offerDescription}}

Valid until: {{validUntil}}

Visit us to avail this offer!`,
    };

    let content = templates[templateName] || `Message from MARI Jewellers: ${templateName}`;

    // Replace placeholders
    Object.entries(params).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return content;
  }

  // Send purchase receipt
  async sendPurchaseReceipt(
    storeId: string,
    customerId: string,
    invoiceNumber: string,
    date: string,
    amount: string,
    items: string,
    phoneNumber: string,
    sentBy: string,
    invoiceId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'purchase_receipt',
      templateParams: { invoiceNumber, date, amount, items },
      storeId,
      customerId,
      referenceType: 'invoice',
      referenceId: invoiceId,
      sentBy,
    });
  }

  // Send wishlist stock alert
  async sendWishlistAlert(
    storeId: string,
    customerId: string,
    phoneNumber: string,
    itemDescription: string,
    price: string,
    weight: string,
    wishlistId: string,
    sentBy?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'wishlist_stock_alert',
      templateParams: { itemDescription, price, weight },
      storeId,
      customerId,
      referenceType: 'wishlist_alert',
      referenceId: wishlistId,
      sentBy,
    });
  }

  // Send loyalty milestone notification
  async sendLoyaltyMilestone(
    storeId: string,
    customerId: string,
    phoneNumber: string,
    tierName: string,
    points: string,
    benefits: string,
    sentBy?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'loyalty_milestone',
      templateParams: { tierName, points, benefits },
      storeId,
      customerId,
      referenceType: 'loyalty_milestone',
      sentBy,
    });
  }

  // Send loyalty points earned notification
  async sendLoyaltyPointsEarned(
    storeId: string,
    customerId: string,
    phoneNumber: string,
    pointsEarned: string,
    totalPoints: string,
    tier: string,
    invoiceId: string,
    sentBy?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'loyalty_points_earned',
      templateParams: { pointsEarned, totalPoints, tier },
      storeId,
      customerId,
      referenceType: 'invoice',
      referenceId: invoiceId,
      sentBy,
    });
  }

  // Send welcome message to new customer
  async sendWelcomeMessage(
    storeId: string,
    customerId: string,
    phoneNumber: string,
    customerName: string,
    welcomePoints: string,
    sentBy?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'welcome_new_customer',
      templateParams: { customerName, welcomePoints },
      storeId,
      customerId,
      referenceType: 'welcome',
      sentBy,
    });
  }

  // Send referral thank you message
  async sendReferralThankYou(
    storeId: string,
    customerId: string,
    phoneNumber: string,
    referrerName: string,
    referredName: string,
    rewardPoints: string,
    totalPoints: string,
    referralId: string,
    sentBy?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendTemplateMessage({
      phoneNumber,
      templateName: 'referral_thank_you',
      templateParams: { referrerName, referredName, rewardPoints, totalPoints },
      storeId,
      customerId,
      referenceType: 'referral',
      referenceId: referralId,
      sentBy,
    });
  }

  // Handle incoming webhook (for receiving messages)
  async handleIncomingMessage(webhookData: {
    typeWebhook: string;
    instanceData: { idInstance: number };
    timestamp: number;
    senderData: { chatId: string; sender: string; senderName: string };
    messageData: { typeMessage: string; textMessageData?: { textMessage: string }; extendedTextMessageData?: { text: string } };
  }, storeId: string): Promise<{ success: boolean; leadId?: string }> {
    try {
      const { senderData, messageData } = webhookData;

      // Extract phone number (remove @c.us suffix)
      const phoneNumber = senderData.chatId.replace('@c.us', '');
      const messageContent = messageData.textMessageData?.textMessage ||
        messageData.extendedTextMessageData?.text || '';

      // Check if this is from an existing customer
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.whatsapp, phoneNumber),
      });

      let leadId: string | undefined;
      let customerId: string | undefined;

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Check for existing lead or create new one
        let lead = await db.query.whatsappLeads.findFirst({
          where: and(
            eq(whatsappLeads.phoneNumber, phoneNumber),
            eq(whatsappLeads.storeId, storeId)
          ),
        });

        if (!lead) {
          // Create new lead
          const [newLead] = await db.insert(whatsappLeads).values({
            storeId,
            phoneNumber,
            name: senderData.senderName,
            source: 'whatsapp_enquiry',
            stage: 'new',
            totalInteractions: 1,
          }).returning();
          lead = newLead;
        } else {
          // Update lead interaction count
          await db.update(whatsappLeads)
            .set({
              totalInteractions: (lead.totalInteractions || 0) + 1,
              lastContactedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(whatsappLeads.id, lead.id));
        }
        leadId = lead.id;
      }

      // Save incoming message
      await db.insert(whatsappMessages).values({
        storeId,
        customerId,
        leadId,
        phoneNumber,
        direction: 'inbound',
        messageType: messageData.typeMessage || 'text',
        content: messageContent,
        status: 'delivered',
        deliveredAt: new Date(),
      });

      logger.info(`Incoming WhatsApp message processed from ${phoneNumber}`);
      return { success: true, leadId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error processing incoming WhatsApp message: ${errorMessage}`);
      return { success: false };
    }
  }

  // Get message history for a customer/lead
  async getMessageHistory(
    storeId: string,
    phoneNumber?: string,
    customerId?: string,
    leadId?: string,
    limit = 50
  ) {
    const conditions = [eq(whatsappMessages.storeId, storeId)];

    if (phoneNumber) {
      conditions.push(eq(whatsappMessages.phoneNumber, this.formatPhoneNumber(phoneNumber)));
    }
    if (customerId) {
      conditions.push(eq(whatsappMessages.customerId, customerId));
    }
    if (leadId) {
      conditions.push(eq(whatsappMessages.leadId, leadId));
    }

    return db.query.whatsappMessages.findMany({
      where: and(...conditions),
      orderBy: [desc(whatsappMessages.createdAt)],
      limit,
    });
  }

  // Update message status (from webhook)
  async updateMessageStatus(
    whatsappMessageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    errorMessage?: string
  ) {
    const updateData: Record<string, unknown> = {
      status,
      statusUpdatedAt: new Date(),
    };

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'read') {
      updateData.readAt = new Date();
    } else if (status === 'failed' && errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await db.update(whatsappMessages)
      .set(updateData)
      .where(eq(whatsappMessages.whatsappMessageId, whatsappMessageId));
  }
}

export const whatsappService = new WhatsAppService();
