import { db } from '../../config/database.js';
import {
  customers,
  customerAddresses,
  loyaltyTransactions,
  invoices,
} from '../../db/schema.js';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  LoyaltyTransactionInput,
} from './customers.validation.js';

export class CustomersService {
  // ============================================================================
  // CUSTOMER MANAGEMENT
  // ============================================================================

  async generateCustomerCode(storeId: string): Promise<string> {
    const prefix = 'CUST-';

    const lastCustomer = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.storeId, storeId),
          sql`${customers.customerCode} LIKE ${prefix + '%'}`
        )
      )
      .orderBy(desc(customers.createdAt))
      .limit(1);

    let sequence = 1;
    if (lastCustomer.length > 0) {
      const lastNumber = lastCustomer[0].customerCode.split('-').pop();
      sequence = parseInt(lastNumber || '0', 10) + 1;
    }

    return `${prefix}${String(sequence).padStart(5, '0')}`;
  }

  async createCustomer(input: CreateCustomerInput, storeId: string) {
    return await db.transaction(async (tx) => {
      const customerCode = await this.generateCustomerCode(storeId);

      const [customer] = await tx
        .insert(customers)
        .values({
          storeId,
          customerCode,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          whatsapp: input.whatsapp,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          address: input.address,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          gstNumber: input.gstNumber,
          notes: input.notes,
          whatsappOptIn: input.whatsappOptIn,
          emailOptIn: input.emailOptIn,
        })
        .returning();

      // Create addresses if provided
      if (input.addresses && input.addresses.length > 0) {
        await tx.insert(customerAddresses).values(
          input.addresses.map((addr) => ({
            customerId: customer.id,
            addressType: addr.addressType,
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2,
            city: addr.city,
            state: addr.state || '',
            pincode: addr.pincode,
            isDefault: addr.isDefault,
          }))
        );
      }

      return customer;
    });
  }

  async getCustomer(customerId: string) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get addresses
    const addresses = await db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId));

    // Get loyalty transactions
    const loyalty = await db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customerId))
      .orderBy(desc(loyaltyTransactions.transactionDate))
      .limit(10);

    return {
      ...customer,
      addresses,
      recentLoyaltyTransactions: loyalty,
    };
  }

  async updateCustomer(customerId: string, input: UpdateCustomerInput) {
    const updateData: any = {};

    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.whatsapp !== undefined) updateData.whatsapp = input.whatsapp;
    if (input.dateOfBirth !== undefined)
      updateData.dateOfBirth = new Date(input.dateOfBirth);
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.pincode !== undefined) updateData.pincode = input.pincode;
    if (input.gstNumber !== undefined) updateData.gstNumber = input.gstNumber;
    if (input.tier !== undefined) updateData.tier = input.tier;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.whatsappOptIn !== undefined) updateData.whatsappOptIn = input.whatsappOptIn;
    if (input.emailOptIn !== undefined) updateData.emailOptIn = input.emailOptIn;

    updateData.updatedAt = new Date();

    const [customer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, customerId))
      .returning();

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  async listCustomers(storeId: string, search?: string) {
    let conditions = [eq(customers.storeId, storeId)];

    if (search) {
      conditions.push(
        or(
          ilike(customers.firstName, `%${search}%`),
          ilike(customers.lastName, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.email, `%${search}%`),
          ilike(customers.customerCode, `%${search}%`)
        ) as any
      );
    }

    const customerList = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.createdAt));

    // Enrich with purchase stats
    const enrichedCustomers = await Promise.all(
      customerList.map(async (customer) => {
        const stats = await db
          .select({
            totalPurchases: sql<number>`COUNT(*)`,
            lifetimeValue: sql<string>`COALESCE(SUM(CAST(${invoices.finalAmount} AS DECIMAL)), 0)`,
          })
          .from(invoices)
          .where(eq(invoices.customerId, customer.id));

        return {
          ...customer,
          totalPurchases: Number(stats[0]?.totalPurchases || 0),
          lifetimeValue: Number(stats[0]?.lifetimeValue || 0).toFixed(2),
        };
      })
    );

    return enrichedCustomers;
  }

  async getCustomerPurchaseHistory(customerId: string) {
    const purchaseHistory = await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.invoiceDate));

    const stats = await db
      .select({
        totalPurchases: sql<number>`COALESCE(SUM(CAST(${invoices.finalAmount} AS DECIMAL)), 0)`,
        totalInvoices: sql<number>`COUNT(*)`,
      })
      .from(invoices)
      .where(eq(invoices.customerId, customerId));

    return {
      purchases: purchaseHistory,
      stats: stats[0],
    };
  }

  // ============================================================================
  // LOYALTY MANAGEMENT
  // ============================================================================

  async addLoyaltyPoints(
    customerId: string,
    input: LoyaltyTransactionInput,
    userId: string,
    referenceType?: string,
    referenceId?: string
  ) {
    return await db.transaction(async (tx) => {
      // Create loyalty transaction
      const [transaction] = await tx
        .insert(loyaltyTransactions)
        .values({
          customerId,
          points: input.points,
          type: input.type,
          notes: input.notes,
          referenceType,
          referenceId,
          createdBy: userId,
        })
        .returning();

      // Update customer loyalty points
      await tx
        .update(customers)
        .set({
          loyaltyPoints: sql`${customers.loyaltyPoints} + ${input.points}`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));

      // Check for tier upgrade
      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (customer) {
        let newTier = customer.tier;
        const totalPoints = customer.loyaltyPoints + input.points;

        if (totalPoints >= 10000) {
          newTier = 'platinum';
        } else if (totalPoints >= 5000) {
          newTier = 'gold';
        } else if (totalPoints >= 2000) {
          newTier = 'silver';
        } else {
          newTier = 'bronze';
        }

        if (newTier !== customer.tier) {
          await tx
            .update(customers)
            .set({ tier: newTier })
            .where(eq(customers.id, customerId));
        }
      }

      return transaction;
    });
  }

  async getLoyaltyTransactions(customerId: string) {
    const transactions = await db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customerId))
      .orderBy(desc(loyaltyTransactions.transactionDate));

    return transactions;
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getCustomerStats(storeId: string) {
    const stats = await db
      .select({
        totalCustomers: sql<number>`COUNT(*)`,
        activeCustomers: sql<number>`COUNT(CASE WHEN ${customers.isActive} = true THEN 1 END)`,
        bronzeTier: sql<number>`COUNT(CASE WHEN ${customers.tier} = 'bronze' THEN 1 END)`,
        silverTier: sql<number>`COUNT(CASE WHEN ${customers.tier} = 'silver' THEN 1 END)`,
        goldTier: sql<number>`COUNT(CASE WHEN ${customers.tier} = 'gold' THEN 1 END)`,
        platinumTier: sql<number>`COUNT(CASE WHEN ${customers.tier} = 'platinum' THEN 1 END)`,
      })
      .from(customers)
      .where(eq(customers.storeId, storeId));

    return stats[0];
  }
}

export const customersService = new CustomersService();
