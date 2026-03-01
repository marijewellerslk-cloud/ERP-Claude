import { db } from '../config/database.js';
import { customerKyc, customers, goldLoans } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// KYC data input type for create/update operations
interface KycData {
  aadhaarNumber?: string;
  panNumber?: string;
  voterId?: string;
  passportNumber?: string;
  drivingLicense?: string;
  aadhaarFrontUrl?: string;
  aadhaarBackUrl?: string;
  panUrl?: string;
  photoUrl?: string;
  signatureUrl?: string;
  addressProofUrl?: string;
  addressProofType?: string;
  verificationLevel?: string;
}

// KYC record type returned from the database
interface KycRecord {
  id: string;
  customerId: string;
  storeId: string;
  aadhaarNumber: string | null;
  aadhaarVerified: boolean | null;
  aadhaarVerifiedAt: Date | null;
  panNumber: string | null;
  panVerified: boolean | null;
  panVerifiedAt: Date | null;
  voterId: string | null;
  passportNumber: string | null;
  drivingLicense: string | null;
  aadhaarFrontUrl: string | null;
  aadhaarBackUrl: string | null;
  panUrl: string | null;
  photoUrl: string | null;
  signatureUrl: string | null;
  addressProofUrl: string | null;
  addressProofType: string | null;
  kycStatus: string;
  verificationLevel: string | null;
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class KycService {
  /**
   * Get the KYC record for a customer.
   * Returns the record with the associated customer relation, or null if not found.
   */
  async getCustomerKyc(customerId: string): Promise<KycRecord | null> {
    try {
      const record = await db.query.customerKyc.findFirst({
        where: eq(customerKyc.customerId, customerId),
        with: {
          customer: true,
          verifiedByUser: true,
        },
      });

      if (!record) {
        logger.debug(`No KYC record found for customer ${customerId}`);
        return null;
      }

      return record as unknown as KycRecord;
    } catch (error) {
      logger.error(`Error fetching KYC for customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new KYC record or update an existing one for the given customer.
   * Automatically calculates the KYC status based on which documents are present.
   */
  async createOrUpdateKyc(
    customerId: string,
    storeId: string,
    data: KycData
  ): Promise<KycRecord> {
    try {
      // Verify the customer exists
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check if a KYC record already exists for this customer
      const existing = await db.query.customerKyc.findFirst({
        where: eq(customerKyc.customerId, customerId),
      });

      // Determine KYC status based on documents provided
      const kycStatus = this.calculateKycStatus(data, existing);

      if (existing) {
        // Update existing record
        const [updated] = await db
          .update(customerKyc)
          .set({
            ...data,
            kycStatus,
            updatedAt: new Date(),
          })
          .where(eq(customerKyc.id, existing.id))
          .returning();

        logger.info(`Updated KYC record for customer ${customerId}, status: ${kycStatus}`);
        return updated as unknown as KycRecord;
      }

      // Create new record
      const [created] = await db
        .insert(customerKyc)
        .values({
          customerId,
          storeId,
          ...data,
          kycStatus,
        })
        .returning();

      logger.info(`Created KYC record for customer ${customerId}, status: ${kycStatus}`);
      return created as unknown as KycRecord;
    } catch (error) {
      logger.error(`Error creating/updating KYC for customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Mark a specific document (aadhaar or PAN) as verified by a staff member.
   * Updates the verified flag and timestamp for the given document field.
   */
  async verifyDocument(
    kycId: string,
    field: 'aadhaar' | 'pan',
    verifiedBy: string
  ): Promise<KycRecord> {
    try {
      const existing = await db.query.customerKyc.findFirst({
        where: eq(customerKyc.id, kycId),
      });

      if (!existing) {
        throw new Error('KYC record not found');
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      };

      if (field === 'aadhaar') {
        if (!existing.aadhaarNumber) {
          throw new Error('Aadhaar number not provided — cannot verify');
        }
        updateData.aadhaarVerified = true;
        updateData.aadhaarVerifiedAt = now;
      } else if (field === 'pan') {
        if (!existing.panNumber) {
          throw new Error('PAN number not provided — cannot verify');
        }
        updateData.panVerified = true;
        updateData.panVerifiedAt = now;
      }

      // Recalculate overall status after verification
      const aadhaarVerified = field === 'aadhaar' ? true : (existing.aadhaarVerified ?? false);
      const panVerified = field === 'pan' ? true : (existing.panVerified ?? false);

      if (aadhaarVerified && panVerified) {
        updateData.kycStatus = 'verified';
        updateData.lastVerifiedAt = now;
        updateData.verifiedBy = verifiedBy;
        // Set expiry to 1 year from verification
        const expiresAt = new Date(now);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        updateData.expiresAt = expiresAt;
      } else if (aadhaarVerified || panVerified) {
        updateData.kycStatus = 'partial';
      }

      const [updated] = await db
        .update(customerKyc)
        .set(updateData)
        .where(eq(customerKyc.id, kycId))
        .returning();

      logger.info(
        `Verified ${field} document for KYC ${kycId} by user ${verifiedBy}`
      );
      return updated as unknown as KycRecord;
    } catch (error) {
      logger.error(`Error verifying document for KYC ${kycId}:`, error);
      throw error;
    }
  }

  /**
   * Update the overall KYC status manually (e.g., verified, rejected, expired).
   * When setting to 'rejected', call with a rejectionReason via a separate update if needed.
   */
  async updateKycStatus(
    kycId: string,
    status: string,
    verifiedBy: string
  ): Promise<KycRecord> {
    try {
      const existing = await db.query.customerKyc.findFirst({
        where: eq(customerKyc.id, kycId),
      });

      if (!existing) {
        throw new Error('KYC record not found');
      }

      const validStatuses = ['pending', 'partial', 'verified', 'rejected', 'expired'];
      if (!validStatuses.includes(status)) {
        throw new Error(
          `Invalid KYC status: ${status}. Must be one of: ${validStatuses.join(', ')}`
        );
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        kycStatus: status,
        updatedAt: now,
      };

      if (status === 'verified') {
        updateData.lastVerifiedAt = now;
        updateData.verifiedBy = verifiedBy;
        // Set expiry to 1 year from verification
        const expiresAt = new Date(now);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        updateData.expiresAt = expiresAt;

        // Also update the kycVerified flag on any active loans for this customer
        await db
          .update(goldLoans)
          .set({ kycVerified: true, updatedAt: now })
          .where(
            and(
              eq(goldLoans.customerId, existing.customerId),
              eq(goldLoans.kycVerified, false)
            )
          );
      }

      if (status === 'rejected') {
        updateData.verifiedBy = verifiedBy;
      }

      const [updated] = await db
        .update(customerKyc)
        .set(updateData)
        .where(eq(customerKyc.id, kycId))
        .returning();

      logger.info(
        `Updated KYC status for record ${kycId} to '${status}' by user ${verifiedBy}`
      );
      return updated as unknown as KycRecord;
    } catch (error) {
      logger.error(`Error updating KYC status for ${kycId}:`, error);
      throw error;
    }
  }

  /**
   * Get all loans in a store where the customer's KYC is not yet complete (not 'verified').
   * Useful for compliance dashboards and audit reports.
   */
  async getKycPendingLoans(storeId: string) {
    try {
      const results = await db
        .select({
          loanId: goldLoans.id,
          loanNumber: goldLoans.loanNumber,
          loanAmount: goldLoans.loanAmount,
          loanStatus: goldLoans.status,
          customerId: goldLoans.customerId,
          customerName: sql<string>`${customers.firstName} || ' ' || COALESCE(${customers.lastName}, '')`,
          customerPhone: customers.phone,
          kycId: customerKyc.id,
          kycStatus: customerKyc.kycStatus,
          aadhaarVerified: customerKyc.aadhaarVerified,
          panVerified: customerKyc.panVerified,
          applicationDate: goldLoans.applicationDate,
        })
        .from(goldLoans)
        .innerJoin(customers, eq(goldLoans.customerId, customers.id))
        .leftJoin(customerKyc, eq(customers.id, customerKyc.customerId))
        .where(
          and(
            eq(goldLoans.storeId, storeId),
            sql`(${customerKyc.kycStatus} IS NULL OR ${customerKyc.kycStatus} != 'verified')`,
            sql`${goldLoans.status} IN ('pending', 'approved', 'active')`
          )
        );

      logger.debug(
        `Found ${results.length} loans with pending KYC in store ${storeId}`
      );
      return results;
    } catch (error) {
      logger.error(`Error fetching KYC-pending loans for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Check whether a customer has a fully verified KYC record that has not expired.
   * Returns true only if KYC status is 'verified' and the expiry date is in the future.
   */
  async isKycComplete(customerId: string): Promise<boolean> {
    try {
      const record = await db.query.customerKyc.findFirst({
        where: eq(customerKyc.customerId, customerId),
      });

      if (!record) {
        return false;
      }

      if (record.kycStatus !== 'verified') {
        return false;
      }

      // Check if KYC has expired
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
        // Auto-update status to expired
        await db
          .update(customerKyc)
          .set({
            kycStatus: 'expired',
            updatedAt: new Date(),
          })
          .where(eq(customerKyc.id, record.id));

        logger.info(`KYC for customer ${customerId} has expired, status updated`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error checking KYC completion for customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate the KYC status based on the documents provided and their verification state.
   * Used internally when creating or updating a KYC record.
   */
  private calculateKycStatus(
    data: KycData,
    existing?: {
      aadhaarNumber?: string | null;
      aadhaarVerified?: boolean | null;
      panNumber?: string | null;
      panVerified?: boolean | null;
    } | null
  ): string {
    const aadhaarNumber = data.aadhaarNumber ?? existing?.aadhaarNumber;
    const panNumber = data.panNumber ?? existing?.panNumber;
    const aadhaarVerified = existing?.aadhaarVerified ?? false;
    const panVerified = existing?.panVerified ?? false;

    // If both documents are verified, status is verified
    if (aadhaarVerified && panVerified) {
      return 'verified';
    }

    // If at least one document is verified, or both numbers are provided, status is partial
    if (aadhaarVerified || panVerified || (aadhaarNumber && panNumber)) {
      return 'partial';
    }

    // If at least one document number is provided, still pending
    if (aadhaarNumber || panNumber) {
      return 'pending';
    }

    return 'pending';
  }
}

export const kycService = new KycService();
