import { db } from '../../config/database.js';
import {
  goldRates,
  invoices,
  invoiceItems,
  payments,
  quotations,
  customers,
  inventoryItems,
  stockLevels,
  stockLevel,
  stockMovements,
  salesReturns,
  salesReturnItems,
} from '../../db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type {
  UpdateGoldRateInput,
  CreateInvoiceInput,
  AddPaymentInput,
  AddPaymentInput,
  CreateQuotationInput,
  CreateReturnInput,
  ProcessReturnInput,
} from './sales.validation.js';
import { loyaltyService } from '../../services/loyalty.service.js';
import { buyingHabitsService } from '../../services/buying-habits.service.js';
import { wishlistService } from '../../services/wishlist.service.js';
import { referralService } from '../../services/referral.service.js';
import { whatsappService } from '../../services/whatsapp.service.js';
import { whatsappService } from '../../services/whatsapp.service.js';
import { activityLogger } from '../../services/activity-logger.service.js';
import { logger } from '../../utils/logger.js';

export class SalesService {
  // ============================================================================
  // GOLD RATES
  // ============================================================================

  async updateGoldRate(input: UpdateGoldRateInput, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [rate] = await db
      .insert(goldRates)
      .values({
        date: today,
        goldType: input.goldType,
        purity: input.purity,
        ratePerGram: input.ratePerGram.toString(),
        createdBy: userId,
      })
      .onConflictDoUpdate({
        target: [goldRates.date, goldRates.goldType, goldRates.purity],
        set: {
          ratePerGram: input.ratePerGram.toString(),
          createdBy: userId,
        },
      })
      .returning();

    return rate;
  }

  async getCurrentGoldRate(goldType: string, purity: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [rate] = await db
      .select()
      .from(goldRates)
      .where(
        and(
          eq(goldRates.goldType, goldType),
          eq(goldRates.purity, purity),
          lte(goldRates.date, today)
        )
      )
      .orderBy(desc(goldRates.date))
      .limit(1);

    return rate;
  }

  async listGoldRates(startDate?: Date, endDate?: Date) {
    let query = db.select().from(goldRates);

    const conditions = [];
    if (startDate) {
      conditions.push(gte(goldRates.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(goldRates.date, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const rates = await query.orderBy(desc(goldRates.date));
    return rates;
  }

  // ============================================================================
  // INVOICES
  // ============================================================================

  async generateInvoiceNumber(storeId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const prefix = `INV-${year}${month}-`;

    const lastInvoice = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let sequence = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = lastInvoice[0].invoiceNumber.split('-').pop();
      sequence = parseInt(lastNumber || '0', 10) + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  async createInvoice(input: CreateInvoiceInput, storeId: string, userId: string) {
    const invoice = await db.transaction(async (tx) => {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(storeId);

      // Calculate totals
      let totalAmount = 0;
      const itemsWithTotals = input.items.map((item) => {
        const subtotal = item.unitPrice * item.quantity;
        const total = subtotal + item.makingCharges + item.wastageCharges - item.discount;
        const taxAmount = (total * item.taxRate) / 100;
        const lineTotal = total + taxAmount;
        totalAmount += lineTotal;

        return {
          ...item,
          lineTotal: lineTotal.toFixed(2),
        };
      });

      const finalAmount = totalAmount - input.discountAmount + input.taxAmount;

      // Create invoice with CRM fields
      const [createdInvoice] = await tx
        .insert(invoices)
        .values({
          storeId,
          invoiceNumber,
          customerId: input.customerId,
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
          totalAmount: totalAmount.toFixed(2),
          discountAmount: input.discountAmount.toFixed(2),
          taxAmount: input.taxAmount.toFixed(2),
          finalAmount: finalAmount.toFixed(2),
          goldRateId: input.goldRateId,
          paymentStatus: 'pending',
          notes: input.notes,
          createdBy: userId,
          // CRM fields
          purchaseOccasion: input.purchaseOccasion,
          loyaltyPointsRedeemed: input.loyaltyPointsRedeemed?.toString() || '0',
          redemptionId: input.redemptionId,
        })
        .returning();

      // Create invoice items and update stock
      for (const item of itemsWithTotals) {
        // Prepare ROI and margin data if inventory item is linked
        let roiData: {
          unitCost?: string;
          metalCostAtSale?: string;
          metalMarginGrams?: string;
          holdingPeriodDays?: number;
          effectiveROI?: string;
          grossMargin?: string;
          grossMarginPercent?: string;
        } = {};

        // Pre-fetch inventory item if linked (needed for both invoice item and stock update)
        let inventoryItem: typeof inventoryItems.$inferSelect | undefined;
        if (item.inventoryItemId) {
          const [fetchedItem] = await tx
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.id, item.inventoryItemId));
          inventoryItem = fetchedItem;

          if (inventoryItem) {
            const soldPrice = parseFloat(item.lineTotal);
            const originalCost = inventoryItem.calculatedCost ? parseFloat(inventoryItem.calculatedCost) : 0;
            const mtmCost = inventoryItem.currentMarketValue
              ? parseFloat(inventoryItem.currentMarketValue)
              : originalCost;

            // Calculate holding period in days
            const createdDate = inventoryItem.createdAt ? new Date(inventoryItem.createdAt) : new Date();
            const holdingPeriodDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            // Calculate gross margin (sale price - MTM cost)
            const grossMargin = soldPrice - mtmCost;
            const grossMarginPercent = mtmCost > 0 ? (grossMargin / mtmCost) * 100 : 0;

            // Calculate ROI based on original cost
            const effectiveROI = originalCost > 0 ? ((soldPrice - originalCost) / originalCost) * 100 : 0;

            // Calculate metal margin in grams if gold weight available
            let metalMarginGrams = 0;
            if (item.goldWeight && inventoryItem.goldWeight) {
              // Get current gold rate for this purity
              const [currentRate] = await tx
                .select()
                .from(goldRates)
                .where(eq(goldRates.purity, item.goldPurity || '22K'))
                .orderBy(desc(goldRates.date))
                .limit(1);

              if (currentRate) {
                const ratePerGram = parseFloat(currentRate.ratePerGram);
                // Metal margin = profit / rate per gram (how many grams of gold the profit represents)
                metalMarginGrams = ratePerGram > 0 ? grossMargin / ratePerGram : 0;
              }
            }

            roiData = {
              unitCost: originalCost.toFixed(2),
              metalCostAtSale: mtmCost.toFixed(2),
              metalMarginGrams: metalMarginGrams.toFixed(4),
              holdingPeriodDays,
              effectiveROI: effectiveROI.toFixed(4),
              grossMargin: grossMargin.toFixed(2),
              grossMarginPercent: grossMarginPercent.toFixed(4),
            };
          }
        }

        await tx.insert(invoiceItems).values({
          invoiceId: createdInvoice.id,
          inventoryItemId: item.inventoryItemId,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          makingCharges: item.makingCharges.toString(),
          wastageCharges: item.wastageCharges.toString(),
          discount: item.discount.toString(),
          taxRate: item.taxRate.toString(),
          lineTotal: item.lineTotal,
          goldWeight: item.goldWeight?.toString(),
          goldPurity: item.goldPurity,
          // ROI and margin fields
          ...roiData,
        });

        // Update stock if inventory item is linked
        if (item.inventoryItemId && inventoryItem) {
          // Calculate profit: soldPrice - costPrice
          const soldPrice = parseFloat(item.lineTotal);
          const costPrice = inventoryItem.calculatedCost
            ? parseFloat(inventoryItem.calculatedCost)
            : 0;
          const profit = soldPrice - costPrice;

          // Mark inventory item as sold with profit tracking
          await tx
            .update(inventoryItems)
            .set({
              status: 'sold',
              soldAt: new Date(),
              soldPrice: soldPrice.toFixed(2),
              soldInvoiceId: createdInvoice.id,
              profit: profit.toFixed(2),
              dailyGoldRate: item.goldWeight ? (soldPrice / parseFloat(item.goldWeight.toString()) * 8).toFixed(2) : null,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, item.inventoryItemId));

          // Reduce stock level
          await tx
            .update(stockLevels)
            .set({
              quantity: sql`${stockLevels.quantity} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockLevels.inventoryItemId, item.inventoryItemId),
                eq(stockLevels.storeId, storeId)
              )
            );

          // Record stock movement
          await tx.insert(stockMovements).values({
            inventoryItemId: item.inventoryItemId,
            storeId,
            movementType: 'sale',
            quantity: -item.quantity,
            referenceType: 'invoice',
            referenceId: createdInvoice.id,
            performedBy: userId,
          });
        }
      }

      return createdInvoice;
    });

    // Process CRM features after successful invoice creation (outside transaction)
    if (input.customerId) {
      await this.processCrmAfterSale(
        input.customerId,
        invoice.id,
        storeId,
        parseFloat(invoice.finalAmount),
        input.purchaseOccasion,
        input.items.map(i => i.inventoryItemId).filter(Boolean) as string[],
        userId
      );
    }

    return invoice;
  }

  /**
   * Process CRM integrations after a sale
   * - Award loyalty points
   * - Update buying habits
   * - Check wishlist fulfillment
   * - Qualify referrals
   * - Send notifications
   */
  private async processCrmAfterSale(
    customerId: string,
    invoiceId: string,
    storeId: string,
    finalAmount: number,
    purchaseOccasion?: string,
    inventoryItemIds?: string[],
    processedBy?: string
  ) {
    try {
      // 1. Award loyalty points
      const pointsResult = await loyaltyService.awardPurchasePoints(
        customerId,
        storeId,
        finalAmount,
        purchaseOccasion,
        invoiceId,
        processedBy
      );

      if (pointsResult.pointsAwarded > 0) {
        logger.info(`Awarded ${pointsResult.pointsAwarded} loyalty points to customer ${customerId}`);

        // Update invoice with points earned
        await db.update(invoices)
          .set({
            loyaltyPointsEarned: pointsResult.pointsAwarded.toString(),
            updatedAt: new Date()
          })
          .where(eq(invoices.id, invoiceId));
      }

      // 2. Update buying habits
      await buyingHabitsService.updateAfterPurchase(customerId, storeId);
      logger.info(`Updated buying habits for customer ${customerId}`);

      // 3. Check wishlist fulfillment
      if (inventoryItemIds && inventoryItemIds.length > 0) {
        const fulfilledWishlists = await wishlistService.checkAndFulfillWishlists(
          customerId,
          inventoryItemIds,
          invoiceId
        );
        if (fulfilledWishlists.length > 0) {
          logger.info(`Fulfilled ${fulfilledWishlists.length} wishlist items for customer ${customerId}`);
        }
      }

      // 4. Qualify pending referrals
      await referralService.qualifyReferral(customerId, invoiceId, finalAmount, processedBy);

      // 5. Check for loyalty tier upgrade
      if (pointsResult.tierUpgrade) {
        logger.info(`Customer ${customerId} upgraded to ${pointsResult.tierUpgrade.newTier} tier`);

        // Send tier upgrade notification
        const customer = await db.query.customers.findFirst({
          where: eq(customers.id, customerId),
        });

        if (customer && customer.whatsappOptIn && whatsappService.isConfigured()) {
          await whatsappService.sendLoyaltyMilestone(
            storeId,
            customerId,
            customer.whatsapp || customer.phone,
            customer.firstName,
            'tier_upgrade',
            pointsResult.currentPoints,
            pointsResult.tierUpgrade.newTier,
            processedBy
          );
        }
      }

      // 6. Send receipt notification if customer opted in
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      if (customer && customer.whatsappOptIn && whatsappService.isConfigured()) {
        await whatsappService.sendReceipt(
          storeId,
          customerId,
          customer.whatsapp || customer.phone,
          invoiceId,
          processedBy
        );
      }

    } catch (error) {
      // Log error but don't fail the sale - CRM features are secondary
      logger.error('Error processing CRM after sale:', error);
    }
  }

  async getInvoice(invoiceId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get invoice items
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    // Get payments
    const invoicePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));

    // Get customer if exists
    let customer = null;
    if (invoice.customerId) {
      const [customerData] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .limit(1);
      customer = customerData;
    }

    return {
      ...invoice,
      items,
      payments: invoicePayments,
      customer,
    };
  }

  async listInvoices(
    storeId: string,
    filters?: {
      paymentStatus?: string;
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
    }
  ) {
    const conditions = [eq(invoices.storeId, storeId)];

    if (filters?.paymentStatus) {
      conditions.push(eq(invoices.paymentStatus, filters.paymentStatus));
    }
    if (filters?.customerId) {
      conditions.push(eq(invoices.customerId, filters.customerId));
    }
    if (filters?.startDate) {
      conditions.push(gte(invoices.invoiceDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoices.invoiceDate, filters.endDate));
    }

    const invoiceList = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.invoiceDate));

    return invoiceList;
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async addPayment(invoiceId: string, input: AddPaymentInput, userId: string) {
    return await db.transaction(async (tx) => {
      // Get invoice
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get existing payments
      const existingPayments = await tx
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId));

      const totalPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );

      // Create payment
      const [payment] = await tx
        .insert(payments)
        .values({
          invoiceId,
          paymentMethod: input.paymentMethod,
          amount: input.amount.toString(),
          transactionReference: input.transactionReference,
          notes: input.notes,
          createdBy: userId,
        })
        .returning();

      // Update invoice payment status
      const newTotalPaid = totalPaid + input.amount;
      const finalAmount = parseFloat(invoice.finalAmount);

      let paymentStatus = 'pending';
      if (newTotalPaid >= finalAmount) {
        paymentStatus = 'paid';
      } else if (newTotalPaid > 0) {
        paymentStatus = 'partial';
      }

      await tx
        .update(invoices)
        .set({ paymentStatus, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));

      return payment;
    });
  }

  // ============================================================================
  // QUOTATIONS
  // ============================================================================

  async generateQuotationNumber(storeId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const prefix = `QUO-${year}${month}-`;

    const lastQuotation = await db
      .select()
      .from(quotations)
      .where(
        and(
          eq(quotations.storeId, storeId),
          sql`${quotations.quotationNumber} LIKE ${prefix + '%'}`
        )
      )
      .orderBy(desc(quotations.createdAt))
      .limit(1);

    let sequence = 1;
    if (lastQuotation.length > 0) {
      const lastNumber = lastQuotation[0].quotationNumber.split('-').pop();
      sequence = parseInt(lastNumber || '0', 10) + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  async createQuotation(input: CreateQuotationInput, storeId: string, userId: string) {
    const quotationNumber = await this.generateQuotationNumber(storeId);

    // Calculate total
    let totalAmount = 0;
    input.items.forEach((item) => {
      const subtotal = item.unitPrice * item.quantity;
      const total = subtotal + item.makingCharges + item.wastageCharges - item.discount;
      const taxAmount = (total * item.taxRate) / 100;
      totalAmount += total + taxAmount;
    });

    const [quotation] = await db
      .insert(quotations)
      .values({
        storeId,
        quotationNumber,
        customerId: input.customerId,
        validUntil: new Date(input.validUntil),
        totalAmount: totalAmount.toFixed(2),
        notes: input.notes,
        createdBy: userId,
      })
      .returning();

    return quotation;
  }

  async listQuotations(storeId: string, status?: string) {
    const conditions = [eq(quotations.storeId, storeId)];

    if (status) {
      conditions.push(eq(quotations.status, status));
    }

    const quotationList = await db
      .select()
      .from(quotations)
      .where(and(...conditions))
      .orderBy(desc(quotations.quotationDate));

    return quotationList;
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getSalesStats(storeId: string, startDate: Date, endDate: Date) {
    const stats = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${invoices.finalAmount} AS DECIMAL)), 0)`,
        totalInvoices: sql<number>`COUNT(*)`,
        paidInvoices: sql<number>`COUNT(CASE WHEN ${invoices.paymentStatus} = 'paid' THEN 1 END)`,
        pendingInvoices: sql<number>`COUNT(CASE WHEN ${invoices.paymentStatus} = 'pending' THEN 1 END)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          gte(invoices.invoiceDate, startDate),
          lte(invoices.invoiceDate, endDate)
        )
      );

    return stats[0];
  }
  // ============================================================================
  // SALES RETURNS
  // ============================================================================

  async createReturn(input: CreateReturnInput, userId: string, storeId: string) {
    return db.transaction(async (tx) => {
      // 1. Verify Invoice
      const invoice = await tx.query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
        with: {
          invoiceItems: true
        }
      });

      if (!invoice) throw new Error('Invoice not found');
      if (invoice.storeId !== storeId) throw new Error('Invoice does not belong to this store');

      // 2. Prepare Return Data
      let totalRefund = 0;
      const returnItemsData = [];

      for (const itemInput of input.items) {
        const invoiceItem = invoice.invoiceItems.find(ii => ii.id === itemInput.invoiceItemId);
        if (!invoiceItem) throw new Error(`Invoice item ${itemInput.invoiceItemId} not found`);
        if (invoiceItem.inventoryItemId !== itemInput.inventoryItemId) throw new Error('Item mismatch');

        totalRefund += itemInput.refundAmount;
        returnItemsData.push({
          inventoryItemId: itemInput.inventoryItemId,
          invoiceItemId: itemInput.invoiceItemId,
          quantity: itemInput.quantity,
          refundAmount: itemInput.refundAmount.toString(),
          condition: itemInput.condition
        });
      }

      // 3. Create Return Record
      const [returnRecord] = await tx.insert(salesReturns).values({
        returnNumber: `RET-${Date.now()}`,
        invoiceId: input.invoiceId,
        storeId,
        customerId: invoice.customerId,
        status: 'requested',
        totalRefundAmount: totalRefund.toString(),
        refundMethod: input.refundMethod,
        reason: input.reason,
        notes: input.notes,
        createdBy: userId,
      }).returning();

      // 4. Create Return Items
      for (const item of returnItemsData) {
        await tx.insert(salesReturnItems).values({
          returnId: returnRecord.id,
          ...item
        });
      }

      await activityLogger.logAudit({
        userId,
        storeId,
        action: 'return_requested',
        entityType: 'sales_return',
        entityId: returnRecord.id,
        newValues: input as any
      });

      return returnRecord;
    });
  }

  async processReturn(input: ProcessReturnInput, userId: string, storeId: string) {
    return db.transaction(async (tx) => {
      const returnRecord = await tx.query.salesReturns.findFirst({
        where: eq(salesReturns.id, input.returnId),
        with: { items: true }
      });

      if (!returnRecord) throw new Error('Return not found');
      if (returnRecord.storeId !== storeId) throw new Error('Return does not belong to this store');
      if (returnRecord.status !== 'requested') throw new Error('Return already processed');

      if (input.action === 'reject') {
        await tx.update(salesReturns)
          .set({ status: 'rejected', approvedBy: userId, updatedAt: new Date() })
          .where(eq(salesReturns.id, input.returnId));

        await activityLogger.logAudit({
          userId,
          storeId,
          action: 'return_rejected',
          entityType: 'sales_return',
          entityId: returnRecord.id
        });

        return { message: 'Return rejected' };
      }

      // Approve
      await tx.update(salesReturns)
        .set({ status: 'completed', approvedBy: userId, updatedAt: new Date() })
        .where(eq(salesReturns.id, input.returnId));

      // Update Inventory & Stock
      for (const item of returnRecord.items) {
        // Update Inventory Item Status
        await tx.update(inventoryItems)
          .set({ status: 'returned', updatedAt: new Date() })
          .where(eq(inventoryItems.id, item.inventoryItemId));

        // Add Stock (Returned Location)
        await tx.insert(stockMovements).values({
          inventoryItemId: item.inventoryItemId,
          storeId,
          movementType: 'return',
          quantity: item.quantity,
          toLocation: 'Returned (Vault)',
          referenceType: 'sales_return',
          referenceId: returnRecord.id,
          performedBy: userId,
          notes: `Return: ${returnRecord.returnNumber}`
        });

        await tx.insert(stockLevels)
          .values({
            inventoryItemId: item.inventoryItemId,
            storeId,
            quantity: item.quantity,
            location: 'Returned (Vault)',
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: [stockLevels.inventoryItemId, stockLevels.storeId],
            set: {
              quantity: sql`${stockLevels.quantity} + ${item.quantity}`,
              updatedAt: new Date()
            }
          });
      }

      await activityLogger.logAudit({
        userId,
        storeId,
        action: 'return_approved',
        entityType: 'sales_return',
        entityId: returnRecord.id,
        newValues: { status: 'completed' }
      });

      return { message: 'Return processed successfully' };
    });
  }
}

export const salesService = new SalesService();
