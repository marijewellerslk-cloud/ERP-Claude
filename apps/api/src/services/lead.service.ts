import { db } from '../config/database.js';
import { whatsappLeads, whatsappMessages, customers } from '../db/schema.js';
import { eq, and, desc, sql, count, isNull, isNotNull, gte, lte, or, ilike } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Lead scoring configuration
const LEAD_SCORING = {
  // Base scores
  enquiryTypeScores: {
    product: 20,
    pricing: 25,
    availability: 30,
    custom_order: 35,
    general: 10,
  },
  // Budget range scores
  budgetScores: {
    under_10k: 5,
    '10k_50k': 15,
    '50k_1l': 25,
    '1l_5l': 35,
    above_5l: 40,
  },
  // Interaction scores
  interactionScore: 5, // per interaction
  maxInteractionScore: 25,
  // Response time bonus (if replied within hours)
  responseTimeBonus: {
    1: 15,   // Within 1 hour
    4: 10,   // Within 4 hours
    24: 5,   // Within 24 hours
  },
  // Decay (reduces score over time without interaction)
  decayPerDay: 2,
  maxDecay: 30,
};

// Lead stage pipeline
const LEAD_STAGES = [
  { id: 'new', name: 'New', description: 'Fresh enquiry' },
  { id: 'contacted', name: 'Contacted', description: 'Initial contact made' },
  { id: 'interested', name: 'Interested', description: 'Showing buying interest' },
  { id: 'negotiating', name: 'Negotiating', description: 'Discussing terms' },
  { id: 'converted', name: 'Converted', description: 'Became customer' },
  { id: 'lost', name: 'Lost', description: 'Did not convert' },
];

interface CreateLeadParams {
  storeId: string;
  phoneNumber: string;
  name?: string;
  source?: string;
  campaignId?: string;
  enquiryType?: string;
  interestedProducts?: { categoryId?: string; productType?: string; description?: string }[];
  budgetRange?: string;
  notes?: string;
  tags?: string[];
  createdBy?: string;
}

interface UpdateLeadParams {
  name?: string;
  stage?: string;
  enquiryType?: string;
  interestedProducts?: { categoryId?: string; productType?: string; description?: string }[];
  budgetRange?: string;
  assignedTo?: string;
  nextFollowUpDate?: Date;
  notes?: string;
  tags?: string[];
}

class LeadService {
  // Create or update a lead from WhatsApp enquiry
  async createOrUpdateLead(params: CreateLeadParams) {
    const {
      storeId,
      phoneNumber,
      name,
      source = 'whatsapp_enquiry',
      campaignId,
      enquiryType,
      interestedProducts,
      budgetRange,
      notes,
      tags,
      createdBy,
    } = params;

    // Format phone number
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Check for existing lead
    let lead = await db.query.whatsappLeads.findFirst({
      where: and(
        eq(whatsappLeads.phoneNumber, formattedPhone),
        eq(whatsappLeads.storeId, storeId)
      ),
    });

    if (lead) {
      // Update existing lead
      const updateData: Record<string, unknown> = {
        totalInteractions: (lead.totalInteractions || 0) + 1,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      };

      if (name && !lead.name) updateData.name = name;
      if (enquiryType) updateData.enquiryType = enquiryType;
      if (interestedProducts) updateData.interestedProducts = interestedProducts;
      if (budgetRange) updateData.budgetRange = budgetRange;
      if (notes) updateData.notes = lead.notes ? `${lead.notes}\n${notes}` : notes;
      if (tags) updateData.tags = [...(lead.tags as string[] || []), ...tags];

      // Recalculate score
      updateData.leadScore = this.calculateLeadScore({
        ...lead,
        ...updateData,
      } as typeof whatsappLeads.$inferSelect);
      updateData.scoringFactors = this.getScoringFactors({
        ...lead,
        ...updateData,
      } as typeof whatsappLeads.$inferSelect);

      const [updated] = await db.update(whatsappLeads)
        .set(updateData)
        .where(eq(whatsappLeads.id, lead.id))
        .returning();

      lead = updated;
    } else {
      // Create new lead
      const initialScore = this.calculateLeadScore({
        enquiryType,
        budgetRange,
        totalInteractions: 1,
      } as typeof whatsappLeads.$inferSelect);

      const [newLead] = await db.insert(whatsappLeads).values({
        storeId,
        phoneNumber: formattedPhone,
        name,
        source,
        campaignId,
        enquiryType,
        interestedProducts,
        budgetRange,
        leadScore: initialScore,
        scoringFactors: this.getScoringFactors({
          enquiryType,
          budgetRange,
          totalInteractions: 1,
        } as typeof whatsappLeads.$inferSelect),
        stage: 'new',
        totalInteractions: 1,
        notes,
        tags,
        createdBy,
      }).returning();

      lead = newLead;
    }

    logger.info(`Lead ${lead.id} created/updated for phone ${formattedPhone}`);
    return lead;
  }

  // Format phone number
  private formatPhoneNumber(phone: string): string {
    let formatted = phone.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('0')) {
        formatted = formatted.substring(1);
      }
      if (!formatted.startsWith('91')) {
        formatted = '91' + formatted;
      }
    } else {
      formatted = formatted.substring(1);
    }
    return formatted;
  }

  // Calculate lead score
  private calculateLeadScore(lead: Partial<typeof whatsappLeads.$inferSelect>): number {
    let score = 0;

    // Enquiry type score
    if (lead.enquiryType) {
      score += LEAD_SCORING.enquiryTypeScores[lead.enquiryType as keyof typeof LEAD_SCORING.enquiryTypeScores] || 0;
    }

    // Budget score
    if (lead.budgetRange) {
      score += LEAD_SCORING.budgetScores[lead.budgetRange as keyof typeof LEAD_SCORING.budgetScores] || 0;
    }

    // Interaction score
    const interactionScore = Math.min(
      (lead.totalInteractions || 0) * LEAD_SCORING.interactionScore,
      LEAD_SCORING.maxInteractionScore
    );
    score += interactionScore;

    // Cap at 100
    return Math.min(score, 100);
  }

  // Get scoring factors breakdown
  private getScoringFactors(lead: Partial<typeof whatsappLeads.$inferSelect>): Record<string, number> {
    return {
      enquiryType: lead.enquiryType
        ? LEAD_SCORING.enquiryTypeScores[lead.enquiryType as keyof typeof LEAD_SCORING.enquiryTypeScores] || 0
        : 0,
      budgetRange: lead.budgetRange
        ? LEAD_SCORING.budgetScores[lead.budgetRange as keyof typeof LEAD_SCORING.budgetScores] || 0
        : 0,
      interactions: Math.min(
        (lead.totalInteractions || 0) * LEAD_SCORING.interactionScore,
        LEAD_SCORING.maxInteractionScore
      ),
    };
  }

  // Update lead
  async updateLead(leadId: string, params: UpdateLeadParams) {
    const lead = await db.query.whatsappLeads.findFirst({
      where: eq(whatsappLeads.id, leadId),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (params.name !== undefined) updateData.name = params.name;
    if (params.stage !== undefined) updateData.stage = params.stage;
    if (params.enquiryType !== undefined) updateData.enquiryType = params.enquiryType;
    if (params.interestedProducts !== undefined) updateData.interestedProducts = params.interestedProducts;
    if (params.budgetRange !== undefined) updateData.budgetRange = params.budgetRange;
    if (params.assignedTo !== undefined) updateData.assignedTo = params.assignedTo;
    if (params.nextFollowUpDate !== undefined) updateData.nextFollowUpDate = params.nextFollowUpDate;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.tags !== undefined) updateData.tags = params.tags;

    // Recalculate score if relevant fields changed
    if (params.enquiryType || params.budgetRange) {
      const updatedLead = { ...lead, ...updateData };
      updateData.leadScore = this.calculateLeadScore(updatedLead as typeof whatsappLeads.$inferSelect);
      updateData.scoringFactors = this.getScoringFactors(updatedLead as typeof whatsappLeads.$inferSelect);
    }

    const [updated] = await db.update(whatsappLeads)
      .set(updateData)
      .where(eq(whatsappLeads.id, leadId))
      .returning();

    return updated;
  }

  // Convert lead to customer
  async convertToCustomer(
    leadId: string,
    customerData: {
      firstName: string;
      lastName?: string;
      email?: string;
      customerCode: string;
    },
    invoiceId?: string,
    invoiceAmount?: number
  ) {
    const lead = await db.query.whatsappLeads.findFirst({
      where: eq(whatsappLeads.id, leadId),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.convertedToCustomerId) {
      throw new Error('Lead already converted');
    }

    // Create customer
    const [customer] = await db.insert(customers).values({
      storeId: lead.storeId,
      customerCode: customerData.customerCode,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: lead.phoneNumber,
      whatsapp: lead.phoneNumber,
      whatsappOptIn: true,
      tier: 'bronze',
      loyaltyPoints: 0,
    }).returning();

    // Update lead
    await db.update(whatsappLeads)
      .set({
        stage: 'converted',
        convertedToCustomerId: customer.id,
        conversionDate: new Date(),
        conversionValue: invoiceAmount?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(whatsappLeads.id, leadId));

    // Update all messages from this lead to link to customer
    await db.update(whatsappMessages)
      .set({ customerId: customer.id })
      .where(eq(whatsappMessages.leadId, leadId));

    logger.info(`Lead ${leadId} converted to customer ${customer.id}`);

    return customer;
  }

  // Mark lead as lost
  async markAsLost(leadId: string, reason?: string) {
    const [updated] = await db.update(whatsappLeads)
      .set({
        stage: 'lost',
        notes: reason ? `Lost reason: ${reason}` : undefined,
        updatedAt: new Date(),
      })
      .where(eq(whatsappLeads.id, leadId))
      .returning();

    return updated;
  }

  // Get lead by ID
  async getLead(leadId: string) {
    return db.query.whatsappLeads.findFirst({
      where: eq(whatsappLeads.id, leadId),
      with: {
        convertedCustomer: true,
        assignedToUser: true,
        messages: {
          orderBy: [desc(whatsappMessages.createdAt)],
          limit: 20,
        },
      },
    });
  }

  // Get leads for a store
  async getLeads(
    storeId: string,
    options: {
      stage?: string;
      assignedTo?: string;
      search?: string;
      minScore?: number;
      maxScore?: number;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const conditions = [eq(whatsappLeads.storeId, storeId)];

    if (options.stage) {
      conditions.push(eq(whatsappLeads.stage, options.stage));
    }
    if (options.assignedTo) {
      conditions.push(eq(whatsappLeads.assignedTo, options.assignedTo));
    }
    if (options.search) {
      conditions.push(
        or(
          ilike(whatsappLeads.name, `%${options.search}%`),
          ilike(whatsappLeads.phoneNumber, `%${options.search}%`)
        )!
      );
    }
    if (options.minScore !== undefined) {
      conditions.push(gte(whatsappLeads.leadScore, options.minScore));
    }
    if (options.maxScore !== undefined) {
      conditions.push(lte(whatsappLeads.leadScore, options.maxScore));
    }
    if (options.fromDate) {
      conditions.push(gte(whatsappLeads.createdAt, options.fromDate));
    }
    if (options.toDate) {
      conditions.push(lte(whatsappLeads.createdAt, options.toDate));
    }

    return db.query.whatsappLeads.findMany({
      where: and(...conditions),
      with: {
        assignedToUser: true,
      },
      orderBy: [desc(whatsappLeads.leadScore), desc(whatsappLeads.createdAt)],
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  // Get leads needing follow-up
  async getLeadsNeedingFollowUp(storeId: string, assignedTo?: string) {
    const conditions = [
      eq(whatsappLeads.storeId, storeId),
      isNotNull(whatsappLeads.nextFollowUpDate),
      lte(whatsappLeads.nextFollowUpDate, new Date()),
      or(
        eq(whatsappLeads.stage, 'new'),
        eq(whatsappLeads.stage, 'contacted'),
        eq(whatsappLeads.stage, 'interested'),
        eq(whatsappLeads.stage, 'negotiating')
      )!,
    ];

    if (assignedTo) {
      conditions.push(eq(whatsappLeads.assignedTo, assignedTo));
    }

    return db.query.whatsappLeads.findMany({
      where: and(...conditions),
      orderBy: [whatsappLeads.nextFollowUpDate],
    });
  }

  // Get lead pipeline stats
  async getPipelineStats(storeId: string) {
    const stats = await db
      .select({
        stage: whatsappLeads.stage,
        count: count(whatsappLeads.id),
        avgScore: sql<number>`AVG(${whatsappLeads.leadScore})::numeric(5,2)`,
      })
      .from(whatsappLeads)
      .where(eq(whatsappLeads.storeId, storeId))
      .groupBy(whatsappLeads.stage);

    // Map to object format expected by frontend
    const pipeline: Record<string, number> = {
      new: 0,
      contacted: 0,
      interested: 0,
      negotiating: 0,
      converted: 0,
      lost: 0,
    };

    for (const stat of stats) {
      if (stat.stage && pipeline.hasOwnProperty(stat.stage)) {
        pipeline[stat.stage] = Number(stat.count) || 0;
      }
    }

    return pipeline;
  }

  // Get lead statistics for a store
  async getLeadStats(storeId: string) {
    const [stats] = await db
      .select({
        totalLeads: count(whatsappLeads.id),
        newLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.stage} = 'new')::int`,
        convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.stage} = 'converted')::int`,
        lostLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.stage} = 'lost')::int`,
        avgScore: sql<number>`AVG(${whatsappLeads.leadScore})::numeric(5,2)`,
        hotLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.leadScore} >= 70)::int`,
        warmLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.leadScore} >= 40 AND ${whatsappLeads.leadScore} < 70)::int`,
        coldLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.leadScore} < 40)::int`,
      })
      .from(whatsappLeads)
      .where(eq(whatsappLeads.storeId, storeId));

    // Calculate conversion rate
    const conversionRate = stats.totalLeads > 0
      ? Number(((stats.convertedLeads / stats.totalLeads) * 100).toFixed(2))
      : 0;

    // Get today's follow-ups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [followUpStats] = await db
      .select({
        todayFollowUps: count(whatsappLeads.id),
      })
      .from(whatsappLeads)
      .where(
        and(
          eq(whatsappLeads.storeId, storeId),
          gte(whatsappLeads.nextFollowUpDate, today),
          lte(whatsappLeads.nextFollowUpDate, tomorrow)
        )
      );

    // Get leads by source
    const sourceStats = await db
      .select({
        source: whatsappLeads.source,
        count: count(whatsappLeads.id),
      })
      .from(whatsappLeads)
      .where(eq(whatsappLeads.storeId, storeId))
      .groupBy(whatsappLeads.source);

    return {
      totalLeads: Number(stats.totalLeads) || 0,
      conversionRate,
      avgTimeToConvert: 7, // Default 7 days - would need conversion tracking to calculate accurately
      todayFollowUps: Number(followUpStats?.todayFollowUps) || 0,
      newLeads: stats.newLeads || 0,
      convertedLeads: stats.convertedLeads || 0,
      lostLeads: stats.lostLeads || 0,
      avgScore: stats.avgScore || 0,
      hotLeads: stats.hotLeads || 0,
      warmLeads: stats.warmLeads || 0,
      coldLeads: stats.coldLeads || 0,
      sourceStats,
      stages: LEAD_STAGES,
      scoringConfig: LEAD_SCORING,
    };
  }

  // Get leads by assigned user
  async getLeadsByAssignee(storeId: string) {
    const assigneeStats = await db
      .select({
        assignedTo: whatsappLeads.assignedTo,
        totalLeads: count(whatsappLeads.id),
        convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${whatsappLeads.stage} = 'converted')::int`,
      })
      .from(whatsappLeads)
      .where(and(
        eq(whatsappLeads.storeId, storeId),
        isNotNull(whatsappLeads.assignedTo)
      ))
      .groupBy(whatsappLeads.assignedTo);

    return assigneeStats;
  }

  // Bulk assign leads
  async bulkAssign(leadIds: string[], assignedTo: string) {
    const results = await Promise.all(
      leadIds.map((id) =>
        db.update(whatsappLeads)
          .set({ assignedTo, updatedAt: new Date() })
          .where(eq(whatsappLeads.id, id))
          .returning()
      )
    );

    return results.flat();
  }

  // Get stage info
  getStages() {
    return LEAD_STAGES;
  }

  // Get scoring config
  getScoringConfig() {
    return LEAD_SCORING;
  }
}

export const leadService = new LeadService();
