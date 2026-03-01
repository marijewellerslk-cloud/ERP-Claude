import { db } from '../../config/database.js';
import { repairs, repairItems, repairStages, customers } from '../../db/schema.js';
import { eq, and, desc, asc, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

// Repair stages in order
const REPAIR_STAGES = [
  { name: 'received', order: 1, label: 'Received' },
  { name: 'assessment', order: 2, label: 'Assessment' },
  { name: 'quoted', order: 3, label: 'Quoted' },
  { name: 'approved', order: 4, label: 'Approved' },
  { name: 'in_progress', order: 5, label: 'In Progress' },
  { name: 'quality_check', order: 6, label: 'Quality Check' },
  { name: 'ready', order: 7, label: 'Ready for Pickup' },
  { name: 'delivered', order: 8, label: 'Delivered' },
];

// Input types
interface CreateRepairInput {
  customerId: string;
  repairType: string;
  priority?: string;
  itemDescription: string;
  metalType?: string;
  purity?: string;
  estimatedWeight?: number;
  problemDescription: string;
  customerInstructions?: string;
  expectedCompletionDate?: Date;
  notes?: string;
  intakePhotos?: string[];
}

interface UpdateRepairInput {
  repairType?: string;
  priority?: string;
  itemDescription?: string;
  metalType?: string;
  purity?: string;
  estimatedWeight?: number;
  problemDescription?: string;
  customerInstructions?: string;
  assessmentNotes?: string;
  estimatedCost?: number;
  laborCharges?: number;
  materialCost?: number;
  additionalCharges?: number;
  discountAmount?: number;
  expectedCompletionDate?: Date;
  assignedTo?: string;
  notes?: string;
  internalNotes?: string;
  intakePhotos?: string[];
  completionPhotos?: string[];
}

interface AssessRepairInput {
  assessmentNotes: string;
  laborCharges: number;
  materialCost?: number;
  additionalCharges?: number;
  estimatedCost: number;
  expectedCompletionDate?: Date;
}

interface ApproveQuotationInput {
  approvalMethod: string; // 'in_person', 'phone', 'whatsapp', 'email'
  advanceAmount?: number;
}

interface ListRepairsFilters {
  status?: string;
  repairType?: string;
  priority?: string;
  customerId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

class RepairsService {
  // Generate repair number: REP-YYYYMMDD-NNN
  private async generateRepairNumber(storeId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `REP-${dateStr}`;

    // Count existing repairs for today
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(repairs)
      .where(
        and(
          eq(repairs.storeId, storeId),
          sql`${repairs.repairNumber} LIKE ${prefix + '%'}`
        )
      );

    const nextNum = (result?.count || 0) + 1;
    return `${prefix}-${nextNum.toString().padStart(3, '0')}`;
  }

  // Create initial stages for a repair
  private async createInitialStages(repairId: string, userId: string) {
    const stageInserts = REPAIR_STAGES.map((stage, index) => ({
      repairId,
      stageName: stage.name,
      stageOrder: stage.order,
      status: index === 0 ? 'current' : 'pending',
      startedAt: index === 0 ? new Date() : null,
      processedBy: index === 0 ? userId : null,
    }));

    await db.insert(repairStages).values(stageInserts);
  }

  // Create a new repair order
  async createRepair(storeId: string, userId: string, input: CreateRepairInput) {
    const repairNumber = await this.generateRepairNumber(storeId);

    const [repair] = await db
      .insert(repairs)
      .values({
        storeId,
        customerId: input.customerId,
        repairNumber,
        repairType: input.repairType,
        status: 'received',
        priority: input.priority || 'normal',
        itemDescription: input.itemDescription,
        metalType: input.metalType,
        purity: input.purity,
        estimatedWeight: input.estimatedWeight?.toString(),
        problemDescription: input.problemDescription,
        customerInstructions: input.customerInstructions,
        expectedCompletionDate: input.expectedCompletionDate,
        intakePhotos: input.intakePhotos,
        receivedBy: userId,
        notes: input.notes,
      })
      .returning();

    // Create initial stages
    await this.createInitialStages(repair.id, userId);

    logger.info('Repair created', { repairId: repair.id, repairNumber });

    return this.getRepairById(repair.id, storeId);
  }

  // Get repair by ID with all related data
  async getRepairById(repairId: string, storeId: string) {
    const repair = await db.query.repairs.findFirst({
      where: and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)),
      with: {
        customer: true,
        items: true,
        stages: {
          orderBy: [asc(repairStages.stageOrder)],
        },
        receivedByUser: true,
        assignedToUser: true,
        assessedByUser: true,
      },
    });

    return repair;
  }

  // List repairs with filters and pagination
  async listRepairs(
    storeId: string,
    filters: ListRepairsFilters = {},
    limit = 50,
    offset = 0
  ) {
    const conditions = [eq(repairs.storeId, storeId)];

    if (filters.status) {
      conditions.push(eq(repairs.status, filters.status));
    }

    if (filters.repairType) {
      conditions.push(eq(repairs.repairType, filters.repairType));
    }

    if (filters.priority) {
      conditions.push(eq(repairs.priority, filters.priority));
    }

    if (filters.customerId) {
      conditions.push(eq(repairs.customerId, filters.customerId));
    }

    if (filters.assignedTo) {
      conditions.push(eq(repairs.assignedTo, filters.assignedTo));
    }

    if (filters.dateFrom) {
      conditions.push(gte(repairs.createdAt, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      conditions.push(lte(repairs.createdAt, new Date(filters.dateTo)));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(repairs.repairNumber, `%${filters.search}%`),
          ilike(repairs.itemDescription, `%${filters.search}%`)
        )!
      );
    }

    const repairsList = await db.query.repairs.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        stages: {
          orderBy: [asc(repairStages.stageOrder)],
        },
      },
      orderBy: [desc(repairs.createdAt)],
      limit,
      offset,
    });

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(repairs)
      .where(and(...conditions));

    return {
      repairs: repairsList,
      total: countResult?.count || 0,
      limit,
      offset,
    };
  }

  // Update repair details
  async updateRepair(repairId: string, storeId: string, input: UpdateRepairInput) {
    const [updated] = await db
      .update(repairs)
      .set({
        ...input,
        estimatedWeight: input.estimatedWeight?.toString(),
        estimatedCost: input.estimatedCost?.toString(),
        laborCharges: input.laborCharges?.toString(),
        materialCost: input.materialCost?.toString(),
        additionalCharges: input.additionalCharges?.toString(),
        discountAmount: input.discountAmount?.toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)))
      .returning();

    return this.getRepairById(repairId, storeId);
  }

  // Assess repair and provide quotation
  async assessRepair(
    repairId: string,
    storeId: string,
    userId: string,
    input: AssessRepairInput
  ) {
    const finalCost =
      input.laborCharges +
      (input.materialCost || 0) +
      (input.additionalCharges || 0);

    const [updated] = await db
      .update(repairs)
      .set({
        assessmentNotes: input.assessmentNotes,
        assessmentDate: new Date(),
        assessedBy: userId,
        laborCharges: input.laborCharges.toString(),
        materialCost: input.materialCost?.toString(),
        additionalCharges: input.additionalCharges?.toString(),
        estimatedCost: input.estimatedCost.toString(),
        finalCost: finalCost.toString(),
        balanceAmount: finalCost.toString(),
        expectedCompletionDate: input.expectedCompletionDate,
        status: 'quoted',
        updatedAt: new Date(),
      })
      .where(and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)))
      .returning();

    // Update stages
    await this.advanceToStage(repairId, 'quoted', userId);

    logger.info('Repair assessed', { repairId, finalCost });

    return this.getRepairById(repairId, storeId);
  }

  // Customer approves quotation
  async approveQuotation(
    repairId: string,
    storeId: string,
    userId: string,
    input: ApproveQuotationInput
  ) {
    const repair = await this.getRepairById(repairId, storeId);
    if (!repair) throw new Error('Repair not found');

    const finalCost = parseFloat(repair.finalCost || '0');
    const advanceAmount = input.advanceAmount || 0;
    const balanceAmount = finalCost - advanceAmount;

    const [updated] = await db
      .update(repairs)
      .set({
        quotationApproved: true,
        approvedAt: new Date(),
        approvalMethod: input.approvalMethod,
        advanceAmount: advanceAmount.toString(),
        advancePaidAt: advanceAmount > 0 ? new Date() : null,
        balanceAmount: balanceAmount.toString(),
        paymentStatus: advanceAmount >= finalCost ? 'paid' : advanceAmount > 0 ? 'partial' : 'pending',
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(repairs.id, repairId))
      .returning();

    // Update stages
    await this.advanceToStage(repairId, 'approved', userId);

    logger.info('Quotation approved', { repairId, advanceAmount });

    return this.getRepairById(repairId, storeId);
  }

  // Start repair work
  async startRepair(repairId: string, storeId: string, userId: string, assignedTo?: string) {
    const [updated] = await db
      .update(repairs)
      .set({
        status: 'in_progress',
        assignedTo: assignedTo || userId,
        updatedAt: new Date(),
      })
      .where(and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)))
      .returning();

    await this.advanceToStage(repairId, 'in_progress', userId);

    logger.info('Repair started', { repairId, assignedTo: assignedTo || userId });

    return this.getRepairById(repairId, storeId);
  }

  // Complete repair (move to quality check)
  async completeRepair(
    repairId: string,
    storeId: string,
    userId: string,
    completionPhotos?: string[]
  ) {
    const [updated] = await db
      .update(repairs)
      .set({
        status: 'quality_check',
        actualCompletionDate: new Date(),
        completionPhotos: completionPhotos,
        updatedAt: new Date(),
      })
      .where(and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)))
      .returning();

    await this.advanceToStage(repairId, 'quality_check', userId);

    logger.info('Repair completed, moved to QC', { repairId });

    return this.getRepairById(repairId, storeId);
  }

  // Mark repair as ready for pickup
  async markReady(repairId: string, storeId: string, userId: string) {
    const repair = await this.getRepairById(repairId, storeId);
    if (!repair) throw new Error('Repair not found');

    // Calculate warranty expiration
    const warrantyDays = repair.warrantyDays || 30;
    const warrantyExpiresAt = new Date();
    warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + warrantyDays);

    const [updated] = await db
      .update(repairs)
      .set({
        status: 'ready',
        warrantyExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(repairs.id, repairId))
      .returning();

    await this.advanceToStage(repairId, 'ready', userId);

    logger.info('Repair ready for pickup', { repairId });

    return this.getRepairById(repairId, storeId);
  }

  // Deliver repair to customer
  async deliverRepair(
    repairId: string,
    storeId: string,
    userId: string,
    paymentReceived?: number
  ) {
    const repair = await this.getRepairById(repairId, storeId);
    if (!repair) throw new Error('Repair not found');

    const currentBalance = parseFloat(repair.balanceAmount || '0');
    const payment = paymentReceived || currentBalance;
    const newBalance = currentBalance - payment;

    if (newBalance > 0) {
      throw new Error(`Outstanding balance of Rs.${newBalance.toFixed(2)} must be paid before delivery`);
    }

    const [updated] = await db
      .update(repairs)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        deliveredBy: userId,
        balanceAmount: '0',
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(repairs.id, repairId))
      .returning();

    await this.advanceToStage(repairId, 'delivered', userId);

    logger.info('Repair delivered', { repairId });

    return this.getRepairById(repairId, storeId);
  }

  // Cancel repair
  async cancelRepair(repairId: string, storeId: string, reason: string) {
    const [updated] = await db
      .update(repairs)
      .set({
        status: 'cancelled',
        internalNotes: sql`COALESCE(${repairs.internalNotes}, '') || '\n[CANCELLED] ' || ${reason}`,
        updatedAt: new Date(),
      })
      .where(and(eq(repairs.id, repairId), eq(repairs.storeId, storeId)))
      .returning();

    logger.info('Repair cancelled', { repairId, reason });

    return this.getRepairById(repairId, storeId);
  }

  // Advance to a specific stage
  private async advanceToStage(repairId: string, stageName: string, userId: string) {
    // Mark previous stages as completed
    await db
      .update(repairStages)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(repairStages.repairId, repairId),
          eq(repairStages.status, 'current')
        )
      );

    // Mark new stage as current
    await db
      .update(repairStages)
      .set({
        status: 'current',
        startedAt: new Date(),
        processedBy: userId,
      })
      .where(
        and(
          eq(repairStages.repairId, repairId),
          eq(repairStages.stageName, stageName)
        )
      );
  }

  // Get repair statistics
  async getStatistics(storeId: string) {
    const stats = await db
      .select({
        status: repairs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(repairs)
      .where(eq(repairs.storeId, storeId))
      .groupBy(repairs.status);

    const statusCounts: Record<string, number> = {};
    stats.forEach((s) => {
      statusCounts[s.status] = s.count;
    });

    // Get overdue repairs
    const [overdueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(repairs)
      .where(
        and(
          eq(repairs.storeId, storeId),
          sql`${repairs.status} NOT IN ('delivered', 'cancelled')`,
          sql`${repairs.expectedCompletionDate} < NOW()`
        )
      );

    return {
      byStatus: statusCounts,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      overdue: overdueCount?.count || 0,
      pending: (statusCounts['received'] || 0) + (statusCounts['assessment'] || 0) + (statusCounts['quoted'] || 0),
      inProgress: (statusCounts['approved'] || 0) + (statusCounts['in_progress'] || 0) + (statusCounts['quality_check'] || 0),
      ready: statusCounts['ready'] || 0,
      completed: statusCounts['delivered'] || 0,
    };
  }

  // Add item to repair
  async addRepairItem(repairId: string, item: {
    itemName: string;
    itemType?: string;
    metalType?: string;
    purity?: string;
    weight?: number;
    issueDescription?: string;
    laborCost?: number;
    materialCost?: number;
  }) {
    const [inserted] = await db
      .insert(repairItems)
      .values({
        repairId,
        itemName: item.itemName,
        itemType: item.itemType,
        metalType: item.metalType,
        purity: item.purity,
        weight: item.weight?.toString(),
        issueDescription: item.issueDescription,
        laborCost: item.laborCost?.toString(),
        materialCost: item.materialCost?.toString(),
      })
      .returning();

    return inserted;
  }

  // Update stage notification
  async notifyCustomer(
    repairId: string,
    stageName: string,
    method: string
  ) {
    await db
      .update(repairStages)
      .set({
        customerNotified: true,
        notifiedAt: new Date(),
        notificationMethod: method,
      })
      .where(
        and(
          eq(repairStages.repairId, repairId),
          eq(repairStages.stageName, stageName)
        )
      );
  }
}

export const repairsService = new RepairsService();
