import { eq, and, desc, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  customOrders,
  customOrderItems,
  customOrderStages,
  customOrderDesignVersions,
  customers,
  users,
} from '../../db/schema.js';
import { logger } from '../../utils/logger.js';

// Stage definitions for custom orders
const CUSTOM_ORDER_STAGES = [
  'consultation',
  'design',
  'quoted',
  'approved',
  'production',
  'quality_check',
  'ready',
  'delivered',
] as const;

interface CreateCustomOrderInput {
  customerId: string;
  orderType: string;
  designTitle: string;
  designDescription?: string;
  customerRequirements?: string;
  metalType?: string;
  purity?: string;
  estimatedWeight?: number;
  ringSize?: string;
  bangleSize?: string;
  chainLength?: string;
  hasStones?: boolean;
  stoneDetails?: any;
  priority?: string;
  notes?: string;
}

interface UpdateCustomOrderInput {
  designTitle?: string;
  designDescription?: string;
  customerRequirements?: string;
  metalType?: string;
  purity?: string;
  estimatedWeight?: number;
  ringSize?: string;
  bangleSize?: string;
  chainLength?: string;
  hasStones?: boolean;
  stoneDetails?: any;
  priority?: string;
  notes?: string;
  internalNotes?: string;
  craftsman?: string;
  workshopNotes?: string;
}

interface QuoteCustomOrderInput {
  goldRateAtQuote: number;
  estimatedGoldCost: number;
  estimatedStoneCost?: number;
  makingCharges: number;
  designCharges?: number;
  wastagePercentage?: number;
  additionalCharges?: number;
  discountAmount?: number;
  expectedCompletionDate?: string;
  quoteValidUntil?: string;
}

interface ApproveOrderInput {
  approvalMethod: string;
  advanceAmount?: number;
  signedDocumentUrl?: string;
}

interface ListCustomOrdersFilters {
  status?: string;
  orderType?: string;
  priority?: string;
  customerId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface AddDesignVersionInput {
  versionName?: string;
  sketchUrls?: string[];
  cadModelUrls?: string[];
  renderUrls?: string[];
  designNotes?: string;
  estimatedCost?: number;
  costBreakdown?: any;
}

class CustomOrdersService {
  // Generate unique order number
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    // Count existing orders for today
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customOrders)
      .where(ilike(customOrders.orderNumber, `CO-${dateStr}%`));

    const count = (result[0]?.count || 0) + 1;
    return `CO-${dateStr}-${count.toString().padStart(3, '0')}`;
  }

  // Initialize stages for a new order
  private async initializeStages(orderId: string): Promise<void> {
    const now = new Date();
    const stageRecords = CUSTOM_ORDER_STAGES.map((stageName, idx) => ({
      customOrderId: orderId,
      stageName,
      stageOrder: idx + 1,
      status: idx === 0 ? 'current' : 'pending',
      startedAt: idx === 0 ? now : null,
    }));

    await db.insert(customOrderStages).values(stageRecords);
  }

  // Move to next stage
  private async progressToStage(orderId: string, targetStage: string, userId: string): Promise<void> {
    const now = new Date();

    // Complete current stage
    await db
      .update(customOrderStages)
      .set({
        status: 'completed',
        completedAt: now,
        processedBy: userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(customOrderStages.customOrderId, orderId),
          eq(customOrderStages.status, 'current')
        )
      );

    // Set new stage as current
    await db
      .update(customOrderStages)
      .set({
        status: 'current',
        startedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(customOrderStages.customOrderId, orderId),
          eq(customOrderStages.stageName, targetStage)
        )
      );

    // Update order status
    await db
      .update(customOrders)
      .set({
        status: targetStage,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));
  }

  // Create a new custom order
  async createCustomOrder(
    storeId: string,
    userId: string,
    input: CreateCustomOrderInput
  ) {
    const orderNumber = await this.generateOrderNumber();
    const now = new Date();

    const [order] = await db
      .insert(customOrders)
      .values({
        storeId,
        customerId: input.customerId,
        orderNumber,
        orderType: input.orderType,
        status: 'consultation',
        priority: input.priority || 'normal',
        designTitle: input.designTitle,
        designDescription: input.designDescription,
        customerRequirements: input.customerRequirements,
        metalType: input.metalType,
        purity: input.purity,
        estimatedWeight: input.estimatedWeight?.toString(),
        ringSize: input.ringSize,
        bangleSize: input.bangleSize,
        chainLength: input.chainLength,
        hasStones: input.hasStones || false,
        stoneDetails: input.stoneDetails,
        consultedBy: userId,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Initialize stages
    await this.initializeStages(order.id);

    logger.info(`Custom order created: ${orderNumber}`, { orderId: order.id, storeId });
    return this.getOrderById(order.id, storeId);
  }

  // Get order by ID
  async getOrderById(orderId: string, storeId: string) {
    const [order] = await db
      .select()
      .from(customOrders)
      .where(and(eq(customOrders.id, orderId), eq(customOrders.storeId, storeId)));

    if (!order) return null;

    // Get customer details
    const [customer] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        email: customers.email,
        customerCode: customers.customerCode,
      })
      .from(customers)
      .where(eq(customers.id, order.customerId));

    // Get stages
    const stages = await db
      .select()
      .from(customOrderStages)
      .where(eq(customOrderStages.customOrderId, orderId))
      .orderBy(customOrderStages.stageOrder);

    // Get items
    const items = await db
      .select()
      .from(customOrderItems)
      .where(eq(customOrderItems.customOrderId, orderId));

    // Get design versions
    const designVersions = await db
      .select()
      .from(customOrderDesignVersions)
      .where(eq(customOrderDesignVersions.customOrderId, orderId))
      .orderBy(desc(customOrderDesignVersions.versionNumber));

    // Get user details
    const userIds = [
      order.consultedBy,
      order.designedBy,
      order.quotedBy,
      order.assignedTo,
      order.deliveredBy,
    ].filter(Boolean) as string[];

    const userDetails: Record<string, { fullName: string }> = {};
    if (userIds.length > 0) {
      const usersData = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(sql`${users.id} IN ${userIds}`);

      usersData.forEach((u) => {
        userDetails[u.id] = { fullName: u.fullName };
      });
    }

    return {
      ...order,
      customer,
      stages,
      items,
      designVersions,
      consultedByUser: order.consultedBy ? userDetails[order.consultedBy] : null,
      designedByUser: order.designedBy ? userDetails[order.designedBy] : null,
      quotedByUser: order.quotedBy ? userDetails[order.quotedBy] : null,
      assignedToUser: order.assignedTo ? userDetails[order.assignedTo] : null,
      deliveredByUser: order.deliveredBy ? userDetails[order.deliveredBy] : null,
    };
  }

  // List orders with filters
  async listOrders(
    storeId: string,
    filters: ListCustomOrdersFilters,
    limit: number = 50,
    offset: number = 0
  ) {
    let conditions = [eq(customOrders.storeId, storeId)];

    if (filters.status) {
      conditions.push(eq(customOrders.status, filters.status));
    }
    if (filters.orderType) {
      conditions.push(eq(customOrders.orderType, filters.orderType));
    }
    if (filters.priority) {
      conditions.push(eq(customOrders.priority, filters.priority));
    }
    if (filters.customerId) {
      conditions.push(eq(customOrders.customerId, filters.customerId));
    }
    if (filters.assignedTo) {
      conditions.push(eq(customOrders.assignedTo, filters.assignedTo));
    }
    if (filters.dateFrom) {
      conditions.push(gte(customOrders.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(customOrders.createdAt, new Date(filters.dateTo)));
    }

    // Build query
    let query = db
      .select({
        order: customOrders,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
        },
      })
      .from(customOrders)
      .leftJoin(customers, eq(customOrders.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(customOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply search filter if present
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(customOrders.orderNumber, searchPattern),
          ilike(customOrders.designTitle, searchPattern)
        )!
      );
    }

    const results = await query;

    // Get stages for each order
    const orderIds = results.map((r) => r.order.id);
    const allStages = orderIds.length > 0
      ? await db
          .select()
          .from(customOrderStages)
          .where(sql`${customOrderStages.customOrderId} IN ${orderIds}`)
          .orderBy(customOrderStages.stageOrder)
      : [];

    // Map stages to orders
    const stagesByOrder = allStages.reduce((acc, stage) => {
      if (!acc[stage.customOrderId]) acc[stage.customOrderId] = [];
      acc[stage.customOrderId].push(stage);
      return acc;
    }, {} as Record<string, typeof allStages>);

    const orders = results.map((r) => ({
      ...r.order,
      customer: r.customer,
      stages: stagesByOrder[r.order.id] || [],
    }));

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customOrders)
      .where(and(...conditions));

    return {
      orders,
      total: countResult?.count || 0,
      limit,
      offset,
    };
  }

  // Update order
  async updateOrder(orderId: string, storeId: string, input: UpdateCustomOrderInput) {
    const now = new Date();

    await db
      .update(customOrders)
      .set({
        ...input,
        estimatedWeight: input.estimatedWeight?.toString(),
        updatedAt: now,
      })
      .where(and(eq(customOrders.id, orderId), eq(customOrders.storeId, storeId)));

    return this.getOrderById(orderId, storeId);
  }

  // Add design version
  async addDesignVersion(
    orderId: string,
    storeId: string,
    userId: string,
    input: AddDesignVersionInput
  ) {
    // Verify order exists
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');

    // Get next version number
    const currentVersionCount = order.designVersions?.length || 0;
    const versionNumber = currentVersionCount + 1;
    const now = new Date();

    const [version] = await db
      .insert(customOrderDesignVersions)
      .values({
        customOrderId: orderId,
        versionNumber,
        versionName: input.versionName || `Design v${versionNumber}`,
        sketchUrls: input.sketchUrls,
        cadModelUrls: input.cadModelUrls,
        renderUrls: input.renderUrls,
        designNotes: input.designNotes,
        estimatedCost: input.estimatedCost?.toString(),
        costBreakdown: input.costBreakdown,
        status: 'draft',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Update revision count
    await db
      .update(customOrders)
      .set({
        revisionCount: versionNumber,
        designedBy: userId,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    // If first design, move to design stage
    if (versionNumber === 1 && order.status === 'consultation') {
      await this.progressToStage(orderId, 'design', userId);
    }

    return version;
  }

  // Present design to customer
  async presentDesign(orderId: string, storeId: string, versionId: string) {
    const now = new Date();

    await db
      .update(customOrderDesignVersions)
      .set({
        status: 'presented',
        presentedAt: now,
        updatedAt: now,
      })
      .where(eq(customOrderDesignVersions.id, versionId));

    return this.getOrderById(orderId, storeId);
  }

  // Add customer feedback to design
  async addDesignFeedback(
    orderId: string,
    storeId: string,
    versionId: string,
    feedback: string
  ) {
    const now = new Date();

    await db
      .update(customOrderDesignVersions)
      .set({
        customerFeedback: feedback,
        feedbackReceivedAt: now,
        updatedAt: now,
      })
      .where(eq(customOrderDesignVersions.id, versionId));

    return this.getOrderById(orderId, storeId);
  }

  // Create quotation
  async createQuotation(
    orderId: string,
    storeId: string,
    userId: string,
    input: QuoteCustomOrderInput
  ) {
    // Calculate totals
    const goldCost = input.estimatedGoldCost || 0;
    const stoneCost = input.estimatedStoneCost || 0;
    const makingCharges = input.makingCharges || 0;
    const designCharges = input.designCharges || 0;
    const additionalCharges = input.additionalCharges || 0;
    const wastagePercentage = input.wastagePercentage || 0;
    const wastageAmount = goldCost * (wastagePercentage / 100);
    const discountAmount = input.discountAmount || 0;

    const estimatedTotal =
      goldCost +
      stoneCost +
      makingCharges +
      designCharges +
      wastageAmount +
      additionalCharges -
      discountAmount;

    const advancePercentage = 50; // Default 50% advance
    const advanceRequired = estimatedTotal * (advancePercentage / 100);

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        goldRateAtQuote: input.goldRateAtQuote.toString(),
        estimatedGoldCost: goldCost.toString(),
        estimatedStoneCost: stoneCost.toString(),
        makingCharges: makingCharges.toString(),
        designCharges: designCharges.toString(),
        wastagePercentage: wastagePercentage.toString(),
        wastageAmount: wastageAmount.toString(),
        additionalCharges: additionalCharges.toString(),
        discountAmount: discountAmount.toString(),
        estimatedTotal: estimatedTotal.toString(),
        advancePercentage: advancePercentage.toString(),
        expectedCompletionDate: input.expectedCompletionDate
          ? new Date(input.expectedCompletionDate)
          : null,
        quoteValidUntil: input.quoteValidUntil
          ? new Date(input.quoteValidUntil)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        quotedAt: now,
        quotedBy: userId,
        updatedAt: now,
      })
      .where(and(eq(customOrders.id, orderId), eq(customOrders.storeId, storeId)));

    // Move to quoted stage
    await this.progressToStage(orderId, 'quoted', userId);

    logger.info(`Quotation created for order ${orderId}`, { estimatedTotal, storeId });
    return this.getOrderById(orderId, storeId);
  }

  // Approve order
  async approveOrder(
    orderId: string,
    storeId: string,
    userId: string,
    input: ApproveOrderInput
  ) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'quoted') throw new Error('Order must be quoted before approval');

    const estimatedTotal = parseFloat(order.estimatedTotal?.toString() || '0');
    const advanceAmount = input.advanceAmount || 0;
    const balanceAmount = estimatedTotal - advanceAmount;

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        designApproved: true,
        approvedAt: now,
        approvalMethod: input.approvalMethod,
        signedDocumentUrl: input.signedDocumentUrl,
        advanceAmount: advanceAmount.toString(),
        advancePaidAt: advanceAmount > 0 ? now : null,
        paymentStatus: advanceAmount > 0 ? 'advance_paid' : 'pending',
        balanceAmount: balanceAmount.toString(),
        finalTotal: estimatedTotal.toString(),
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    // Move to approved stage
    await this.progressToStage(orderId, 'approved', userId);

    logger.info(`Order approved: ${order.orderNumber}`, { orderId, advanceAmount });
    return this.getOrderById(orderId, storeId);
  }

  // Start production
  async startProduction(
    orderId: string,
    storeId: string,
    userId: string,
    craftsman?: string,
    workshopNotes?: string
  ) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'approved') throw new Error('Order must be approved before production');

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        productionStartedAt: now,
        assignedTo: userId,
        craftsman,
        workshopNotes,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    // Move to production stage
    await this.progressToStage(orderId, 'production', userId);

    logger.info(`Production started for order ${order.orderNumber}`, { orderId });
    return this.getOrderById(orderId, storeId);
  }

  // Complete production
  async completeProduction(
    orderId: string,
    storeId: string,
    userId: string,
    actualWeight?: number,
    completionPhotos?: string[]
  ) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'production') throw new Error('Order must be in production');

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        actualWeight: actualWeight?.toString(),
        completionPhotos,
        actualCompletionDate: now,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    // Move to quality check stage
    await this.progressToStage(orderId, 'quality_check', userId);

    logger.info(`Production completed for order ${order.orderNumber}`, { orderId });
    return this.getOrderById(orderId, storeId);
  }

  // Quality check
  async qualityCheck(
    orderId: string,
    storeId: string,
    userId: string,
    passed: boolean,
    notes?: string
  ) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'quality_check') throw new Error('Order must be in quality check');

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        qualityCheckDate: now,
        qualityCheckPassed: passed,
        qualityCheckNotes: notes,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    if (passed) {
      // Move to ready stage
      await this.progressToStage(orderId, 'ready', userId);

      await db
        .update(customOrders)
        .set({
          readyForPickupAt: now,
          updatedAt: now,
        })
        .where(eq(customOrders.id, orderId));
    } else {
      // Revert to production for rework
      await this.progressToStage(orderId, 'production', userId);
    }

    logger.info(`Quality check ${passed ? 'passed' : 'failed'} for order ${order.orderNumber}`, {
      orderId,
    });
    return this.getOrderById(orderId, storeId);
  }

  // Deliver order
  async deliverOrder(
    orderId: string,
    storeId: string,
    userId: string,
    paymentReceived?: number,
    packagingPhotos?: string[]
  ) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'ready') throw new Error('Order must be ready for delivery');

    const finalTotal = parseFloat(order.finalTotal?.toString() || '0');
    const advanceAmount = parseFloat(order.advanceAmount?.toString() || '0');
    const balanceAmount = finalTotal - advanceAmount - (paymentReceived || 0);

    const now = new Date();
    const warrantyMonths = order.warrantyMonths || 6;
    const warrantyExpires = new Date(now);
    warrantyExpires.setMonth(warrantyExpires.getMonth() + warrantyMonths);

    await db
      .update(customOrders)
      .set({
        deliveredAt: now,
        deliveredBy: userId,
        packagingPhotos,
        balanceAmount: balanceAmount.toString(),
        paymentStatus: balanceAmount <= 0 ? 'paid' : 'partial',
        warrantyExpiresAt: warrantyExpires,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    // Move to delivered stage
    await this.progressToStage(orderId, 'delivered', userId);

    logger.info(`Order delivered: ${order.orderNumber}`, { orderId });
    return this.getOrderById(orderId, storeId);
  }

  // Cancel order
  async cancelOrder(orderId: string, storeId: string, userId: string, reason: string) {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'delivered') throw new Error('Cannot cancel delivered order');

    const now = new Date();

    await db
      .update(customOrders)
      .set({
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: now,
        cancelledBy: userId,
        updatedAt: now,
      })
      .where(eq(customOrders.id, orderId));

    logger.info(`Order cancelled: ${order.orderNumber}`, { orderId, reason });
    return this.getOrderById(orderId, storeId);
  }

  // Add item to order
  async addOrderItem(orderId: string, input: any) {
    const now = new Date();

    const [item] = await db
      .insert(customOrderItems)
      .values({
        customOrderId: orderId,
        itemName: input.itemName,
        itemType: input.itemType,
        quantity: input.quantity || 1,
        metalType: input.metalType,
        purity: input.purity,
        estimatedWeight: input.estimatedWeight?.toString(),
        stoneType: input.stoneType,
        stoneCount: input.stoneCount,
        stoneTotalWeight: input.stoneTotalWeight?.toString(),
        stoneQuality: input.stoneQuality,
        stoneSource: input.stoneSource,
        size: input.size,
        length: input.length?.toString(),
        width: input.width?.toString(),
        thickness: input.thickness?.toString(),
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return item;
  }

  // Get statistics
  async getStatistics(storeId: string) {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        consultation: sql<number>`count(*) filter (where ${customOrders.status} = 'consultation')::int`,
        design: sql<number>`count(*) filter (where ${customOrders.status} = 'design')::int`,
        quoted: sql<number>`count(*) filter (where ${customOrders.status} = 'quoted')::int`,
        approved: sql<number>`count(*) filter (where ${customOrders.status} = 'approved')::int`,
        production: sql<number>`count(*) filter (where ${customOrders.status} = 'production')::int`,
        qualityCheck: sql<number>`count(*) filter (where ${customOrders.status} = 'quality_check')::int`,
        ready: sql<number>`count(*) filter (where ${customOrders.status} = 'ready')::int`,
        delivered: sql<number>`count(*) filter (where ${customOrders.status} = 'delivered')::int`,
        cancelled: sql<number>`count(*) filter (where ${customOrders.status} = 'cancelled')::int`,
        pending: sql<number>`count(*) filter (where ${customOrders.status} IN ('consultation', 'design', 'quoted'))::int`,
        inProgress: sql<number>`count(*) filter (where ${customOrders.status} IN ('approved', 'production', 'quality_check'))::int`,
      })
      .from(customOrders)
      .where(eq(customOrders.storeId, storeId));

    // Get overdue orders (past expected completion date but not delivered)
    const [overdueResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customOrders)
      .where(
        and(
          eq(customOrders.storeId, storeId),
          lte(customOrders.expectedCompletionDate, new Date()),
          sql`${customOrders.status} NOT IN ('delivered', 'cancelled', 'ready')`
        )
      );

    return {
      ...stats,
      overdue: overdueResult?.count || 0,
    };
  }

  // Notify customer
  async notifyCustomer(
    orderId: string,
    stageName: string,
    method: string
  ) {
    const now = new Date();

    await db
      .update(customOrderStages)
      .set({
        customerNotified: true,
        notificationMethod: method,
        notifiedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(customOrderStages.customOrderId, orderId),
          eq(customOrderStages.stageName, stageName)
        )
      );

    logger.info(`Customer notified for order ${orderId}, stage: ${stageName}`, { method });
  }
}

export const customOrdersService = new CustomOrdersService();
