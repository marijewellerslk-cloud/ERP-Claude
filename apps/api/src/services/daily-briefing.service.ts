import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users, userRoles, stores, inventoryBatches, activitySummaries } from '../db/schema.js';
import { dailySummaryService } from './daily-summary.service.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';

interface DailyBriefingData {
  storeName: string;
  date: string;
  salesSummary: {
    totalSales: number;
    totalInvoices: number;
    totalCustomers: number;
    averageInvoiceValue: number;
  };
  inventorySummary: {
    itemsAdded: number;
    batchesCreated: number;
    batchesCompleted: number;
    totalGrossWeightAdded: number;
  };
  financialSummary: {
    totalPaymentsReceived: number;
    totalPaymentsMade: number;
    outstandingReceivables: number;
    outstandingPayables: number;
  };
  activitySummary: {
    totalActivities: number;
    activeUsers: number;
  };
  topCustomers: Array<{
    name: string;
    totalPurchase: number;
    invoiceCount: number;
  }>;
  creditorList: Array<{
    batchNumber: string;
    supplierName: string;
    totalAmount: number;
    outstandingBalance: number;
    dueDate: string | null;
  }>;
  inventoryChanges: Array<{
    batchNumber: string;
    status: string;
    itemsAdded: number;
    totalWeight: number;
  }>;
  userActivities: Array<{
    userName: string;
    activityCount: number;
    recentActivities: string[];
  }>;
}

export class DailyBriefingService {
  /**
   * Generate and send daily briefing emails for a store
   */
  async sendDailyBriefing(storeId: string, date: Date = new Date()): Promise<void> {
    try {
      logger.info('Generating daily briefing', { storeId, date });

      // Generate daily summary first
      await dailySummaryService.generateDailySummary(storeId, date);

      // Get the summary
      const summary = await dailySummaryService.getDailySummary(storeId, date);
      if (!summary) {
        throw new Error('Failed to generate daily summary');
      }

      // Get store details
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });

      if (!store) {
        throw new Error('Store not found');
      }

      // Get additional data for briefing
      const creditorList = await this.getCreditorList(storeId);
      const userActivities = await this.getUserActivities(storeId, date);

      // Prepare briefing data
      const briefingData: DailyBriefingData = {
        storeName: store.name,
        date: date.toLocaleDateString('en-LK', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        salesSummary: {
          totalSales: parseFloat(summary.totalSales),
          totalInvoices: summary.totalInvoices,
          totalCustomers: summary.totalCustomers,
          averageInvoiceValue: parseFloat(summary.averageInvoiceValue || '0'),
        },
        inventorySummary: {
          itemsAdded: summary.itemsAdded,
          batchesCreated: summary.batchesCreated,
          batchesCompleted: summary.batchesCompleted,
          totalGrossWeightAdded: parseFloat(summary.totalGrossWeightAdded),
        },
        financialSummary: {
          totalPaymentsReceived: parseFloat(summary.totalPaymentsReceived),
          totalPaymentsMade: parseFloat(summary.totalPaymentsMade),
          outstandingReceivables: parseFloat(summary.outstandingReceivables || '0'),
          outstandingPayables: parseFloat(summary.outstandingPayables || '0'),
        },
        activitySummary: {
          totalActivities: summary.totalActivities,
          activeUsers: summary.activeUsers,
        },
        topCustomers: (summary.topCustomers as any) || [],
        creditorList,
        inventoryChanges: (summary.inventoryChanges as any) || [],
        userActivities,
      };

      // Generate HTML email
      const htmlContent = this.generateBriefingHTML(briefingData);

      // Get recipients (all active users in the store)
      const recipients = await this.getRecipients(storeId);

      if (recipients.length === 0) {
        logger.warn('No recipients found for daily briefing', { storeId });
        return;
      }

      // Send email
      await emailService.sendEmail({
        storeId,
        recipients,
        subject: `Daily Briefing - ${briefingData.storeName} - ${briefingData.date}`,
        htmlContent,
        notificationType: 'daily_briefing',
        templateData: briefingData,
      });

      logger.info('Daily briefing sent successfully', {
        storeId,
        recipientCount: recipients.length,
      });
    } catch (error) {
      logger.error('Failed to send daily briefing', { error, storeId, date });
      throw error;
    }
  }

  private async getCreditorList(storeId: string) {
    const outstandingBatches = await db.query.inventoryBatches.findMany({
      where: and(
        eq(inventoryBatches.storeId, storeId),
        eq(inventoryBatches.paymentStatus, 'partial')
      ),
      with: {
        supplier: true,
      },
      orderBy: [desc(inventoryBatches.dueDate)],
      limit: 10,
    });

    return outstandingBatches.map((batch) => ({
      batchNumber: batch.batchNumber,
      supplierName: batch.supplier?.businessName || 'Unknown',
      totalAmount: parseFloat(batch.totalCost),
      outstandingBalance: parseFloat(batch.outstandingBalance || '0'),
      dueDate: batch.dueDate ? batch.dueDate.toLocaleDateString('en-LK') : null,
    }));
  }

  private async getUserActivities(storeId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all users who had activity today
    const activities = await db.query.activitySummaries.findMany({
      where: and(
        eq(activitySummaries.storeId, storeId),
        gte(activitySummaries.activityDate, startOfDay),
        lte(activitySummaries.activityDate, endOfDay)
      ),
      with: {
        user: true,
      },
      orderBy: [desc(activitySummaries.activityDate)],
    });

    // Group by user
    const userActivityMap = new Map<
      string,
      { userName: string; activities: string[] }
    >();

    activities.forEach((activity) => {
      const userId = activity.userId;
      const userName = activity.user.fullName;

      if (!userActivityMap.has(userId)) {
        userActivityMap.set(userId, { userName, activities: [] });
      }

      const userActivity = userActivityMap.get(userId)!;
      if (userActivity.activities.length < 5) {
        // Only include top 5 activities per user
        userActivity.activities.push(activity.description);
      }
    });

    return Array.from(userActivityMap.values()).map((ua) => ({
      userName: ua.userName,
      activityCount: ua.activities.length,
      recentActivities: ua.activities,
    }));
  }

  private async getRecipients(storeId: string): Promise<string[]> {
    const storeUsers = await db.query.userRoles.findMany({
      where: eq(userRoles.storeId, storeId),
      with: {
        user: true,
      },
    });

    return storeUsers
      .filter((ur) => ur.user.isActive && ur.user.email)
      .map((ur) => ur.user.email);
  }

  private generateBriefingHTML(data: DailyBriefingData): string {
    const formatCurrency = (amount: number) => {
      return `Rs ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatWeight = (weight: number) => {
      const sovereigns = weight / 8;
      return `${weight.toFixed(3)}g (${sovereigns.toFixed(3)} sovereigns)`;
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Briefing</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 16px;
      margin: 0;
    }
    .section {
      margin-bottom: 30px;
    }
    h2 {
      color: #1f2937;
      font-size: 20px;
      border-left: 4px solid #2563eb;
      padding-left: 12px;
      margin-bottom: 15px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .metric-card {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .metric-label {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    .metric-value.positive {
      color: #059669;
    }
    .metric-value.negative {
      color: #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #f3f4f6;
      padding: 10px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .user-activity {
      background-color: #fef3c7;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      border-left: 3px solid #f59e0b;
    }
    .activity-list {
      margin: 5px 0 0 20px;
      font-size: 13px;
      color: #6b7280;
    }
    .activity-list li {
      margin-bottom: 3px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
    }
    .highlight {
      background-color: #dbeafe;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏪 ${data.storeName}</h1>
      <p class="subtitle">Daily Briefing for ${data.date}</p>
    </div>

    <!-- Sales Summary -->
    <div class="section">
      <h2>💰 Sales Summary</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Sales</div>
          <div class="metric-value positive">${formatCurrency(data.salesSummary.totalSales)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Invoices</div>
          <div class="metric-value">${data.salesSummary.totalInvoices}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Customers Served</div>
          <div class="metric-value">${data.salesSummary.totalCustomers}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Invoice Value</div>
          <div class="metric-value">${formatCurrency(data.salesSummary.averageInvoiceValue)}</div>
        </div>
      </div>
      ${
        data.topCustomers.length > 0
          ? `
      <h3 style="font-size: 16px; margin-top: 20px; color: #4b5563;">Top Customers Today</h3>
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Invoices</th>
            <th>Total Purchase</th>
          </tr>
        </thead>
        <tbody>
          ${data.topCustomers
            .map(
              (customer) => `
          <tr>
            <td>${customer.name}</td>
            <td>${customer.invoiceCount}</td>
            <td>${formatCurrency(customer.totalPurchase)}</td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      `
          : ''
      }
    </div>

    <!-- Inventory Summary -->
    <div class="section">
      <h2>📦 Inventory Summary</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Items Added</div>
          <div class="metric-value">${data.inventorySummary.itemsAdded}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Batches Created</div>
          <div class="metric-value">${data.inventorySummary.batchesCreated}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Batches Completed</div>
          <div class="metric-value">${data.inventorySummary.batchesCompleted}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Weight Added</div>
          <div class="metric-value">${formatWeight(data.inventorySummary.totalGrossWeightAdded)}</div>
        </div>
      </div>
    </div>

    <!-- Financial Summary -->
    <div class="section">
      <h2>💵 Financial Summary</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Payments Received</div>
          <div class="metric-value positive">${formatCurrency(data.financialSummary.totalPaymentsReceived)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Payments Made</div>
          <div class="metric-value negative">${formatCurrency(data.financialSummary.totalPaymentsMade)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Outstanding Receivables</div>
          <div class="metric-value">${formatCurrency(data.financialSummary.outstandingReceivables)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Outstanding Payables</div>
          <div class="metric-value">${formatCurrency(data.financialSummary.outstandingPayables)}</div>
        </div>
      </div>
    </div>

    <!-- Creditor List -->
    ${
      data.creditorList.length > 0
        ? `
    <div class="section">
      <h2>📋 Outstanding Payments to Suppliers</h2>
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Supplier</th>
            <th>Total Amount</th>
            <th>Outstanding</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.creditorList
            .map(
              (creditor) => `
          <tr>
            <td>${creditor.batchNumber}</td>
            <td>${creditor.supplierName}</td>
            <td>${formatCurrency(creditor.totalAmount)}</td>
            <td><span class="highlight">${formatCurrency(creditor.outstandingBalance)}</span></td>
            <td>${creditor.dueDate || 'Not set'}</td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <!-- User Activities -->
    ${
      data.userActivities.length > 0
        ? `
    <div class="section">
      <h2>👥 Team Activity Summary</h2>
      <p style="margin-bottom: 15px;">
        <strong>${data.activitySummary.activeUsers}</strong> team members recorded
        <strong>${data.activitySummary.totalActivities}</strong> activities today.
      </p>
      ${data.userActivities
        .map(
          (ua) => `
      <div class="user-activity">
        <strong>${ua.userName}</strong> - ${ua.activityCount} activities
        <ul class="activity-list">
          ${ua.recentActivities.map((activity) => `<li>${activity}</li>`).join('')}
        </ul>
      </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>This is an automated daily briefing from MARI Jewellers ERP System</p>
      <p>Generated on ${new Date().toLocaleString('en-LK')}</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export const dailyBriefingService = new DailyBriefingService();
