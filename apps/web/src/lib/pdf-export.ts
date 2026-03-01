import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number }
  }
}

interface PDFExportOptions {
  title: string
  subtitle?: string
  dateRange?: { start: string; end: string }
  storeName?: string
  orientation?: 'portrait' | 'landscape'
}

interface TableColumn {
  header: string
  dataKey: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

// Format currency for PDF
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value)
}

// Format percentage
const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

// Format weight in grams
const formatWeight = (value: number): string => {
  return `${value.toFixed(3)}g`
}

// Create base PDF document with header
function createPDFDocument(options: PDFExportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(options.title, pageWidth / 2, 20, { align: 'center' })

  // Subtitle
  if (options.subtitle) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(options.subtitle, pageWidth / 2, 28, { align: 'center' })
  }

  // Date range
  if (options.dateRange) {
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(
      `Period: ${options.dateRange.start} to ${options.dateRange.end}`,
      pageWidth / 2,
      options.subtitle ? 35 : 28,
      { align: 'center' }
    )
  }

  // Store name
  if (options.storeName) {
    doc.setFontSize(10)
    doc.text(`Store: ${options.storeName}`, 14, 45)
  }

  // Generated date
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 45, { align: 'right' })

  doc.setTextColor(0)

  return doc
}

// Add table to PDF
function addTableToPDF(
  doc: jsPDF,
  columns: TableColumn[],
  data: Record<string, any>[],
  startY: number,
  title?: string
): number {
  if (title) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, startY)
    startY += 8
  }

  autoTable(doc, {
    startY,
    head: [columns.map(col => col.header)],
    body: data.map(row => columns.map(col => row[col.dataKey] ?? '-')),
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: columns.reduce((acc, col, index) => {
      acc[index] = {
        halign: col.align || 'left',
        cellWidth: col.width || 'auto',
      }
      return acc
    }, {} as Record<number, any>),
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
  })

  return doc.lastAutoTable.finalY + 10
}

// Add summary cards to PDF
function addSummaryCards(
  doc: jsPDF,
  cards: Array<{ label: string; value: string; subtext?: string }>,
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const cardWidth = (pageWidth - 28 - (cards.length - 1) * 5) / cards.length
  let maxY = startY

  cards.forEach((card, index) => {
    const x = 14 + index * (cardWidth + 5)

    // Card background
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(x, startY, cardWidth, 25, 2, 2, 'F')

    // Label
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(card.label, x + 5, startY + 8)

    // Value
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(card.value, x + 5, startY + 18)

    // Subtext
    if (card.subtext) {
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.setFont('helvetica', 'normal')
      doc.text(card.subtext, x + 5, startY + 23)
    }

    maxY = Math.max(maxY, startY + 25)
  })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)

  return maxY + 10
}

// ============================================================================
// EXPORT FUNCTIONS FOR SPECIFIC REPORTS
// ============================================================================

// Export Stock Aging Report
export function exportStockAgingPDF(report: {
  storeName: string
  totalItems: number
  totalValue: number
  averageAge: number
  oldestItemDays: number
  buckets: Array<{
    label: string
    itemCount: number
    totalValue: number
    percentageOfInventory: number
  }>
  deadStockItems: Array<{
    sku: string
    name: string
    category: string | null
    ageInDays: number
    netWeight: number
    calculatedCost: number
    currentMarketValue: number
    unrealizedGainLoss: number
  }>
}): void {
  const doc = createPDFDocument({
    title: 'Stock Aging Report',
    subtitle: report.storeName,
  })

  let y = 55

  // Summary cards
  y = addSummaryCards(doc, [
    { label: 'Total Items', value: report.totalItems.toLocaleString() },
    { label: 'Total Value', value: formatCurrency(report.totalValue) },
    { label: 'Average Age', value: `${Math.round(report.averageAge)} days` },
    { label: 'Dead Stock', value: report.deadStockItems.length.toString(), subtext: `items > 180 days` },
  ], y)

  // Aging Distribution
  y = addTableToPDF(
    doc,
    [
      { header: 'Age Bucket', dataKey: 'label' },
      { header: 'Items', dataKey: 'itemCount', align: 'right' },
      { header: 'Value', dataKey: 'totalValue', align: 'right' },
      { header: '% of Inventory', dataKey: 'percentageOfInventory', align: 'right' },
    ],
    report.buckets.map(b => ({
      ...b,
      totalValue: formatCurrency(b.totalValue),
      percentageOfInventory: formatPercent(b.percentageOfInventory),
    })),
    y,
    'Aging Distribution'
  )

  // Dead Stock Items (if any)
  if (report.deadStockItems.length > 0) {
    y = addTableToPDF(
      doc,
      [
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Name', dataKey: 'name' },
        { header: 'Age', dataKey: 'ageInDays', align: 'right' },
        { header: 'Weight', dataKey: 'netWeight', align: 'right' },
        { header: 'Cost', dataKey: 'calculatedCost', align: 'right' },
        { header: 'Market Value', dataKey: 'currentMarketValue', align: 'right' },
        { header: 'Gain/Loss', dataKey: 'unrealizedGainLoss', align: 'right' },
      ],
      report.deadStockItems.slice(0, 30).map(item => ({
        ...item,
        ageInDays: `${item.ageInDays} days`,
        netWeight: formatWeight(item.netWeight),
        calculatedCost: formatCurrency(item.calculatedCost),
        currentMarketValue: formatCurrency(item.currentMarketValue),
        unrealizedGainLoss: formatCurrency(item.unrealizedGainLoss),
      })),
      y,
      'Dead Stock Items (>180 days)'
    )
  }

  doc.save('stock-aging-report.pdf')
}

// Export Margin Analysis Report
export function exportMarginAnalysisPDF(data: {
  dateRange: { start: string; end: string }
  summary: {
    totalRevenue: number
    totalCost: number
    grossProfit: number
    avgMargin: number
    totalItems: number
  }
  categoryPerformance: Array<{
    categoryName: string
    itemsSold: number
    totalRevenue: number
    totalProfit: number
    avgMargin: number
  }>
  items: Array<{
    sku: string
    name: string
    salePrice: number
    cost: number
    margin: number
    marginPercent: number
    holdingDays: number
    roi: number
  }>
}): void {
  const doc = createPDFDocument({
    title: 'Margin Analysis Report',
    dateRange: data.dateRange,
    orientation: 'landscape',
  })

  let y = 55

  // Summary cards
  y = addSummaryCards(doc, [
    { label: 'Total Revenue', value: formatCurrency(data.summary.totalRevenue) },
    { label: 'Total Cost', value: formatCurrency(data.summary.totalCost) },
    { label: 'Gross Profit', value: formatCurrency(data.summary.grossProfit) },
    { label: 'Avg Margin', value: formatPercent(data.summary.avgMargin) },
    { label: 'Items Sold', value: data.summary.totalItems.toLocaleString() },
  ], y)

  // Category Performance
  if (data.categoryPerformance.length > 0) {
    y = addTableToPDF(
      doc,
      [
        { header: 'Category', dataKey: 'categoryName' },
        { header: 'Items Sold', dataKey: 'itemsSold', align: 'right' },
        { header: 'Revenue', dataKey: 'totalRevenue', align: 'right' },
        { header: 'Profit', dataKey: 'totalProfit', align: 'right' },
        { header: 'Avg Margin', dataKey: 'avgMargin', align: 'right' },
      ],
      data.categoryPerformance.map(cat => ({
        ...cat,
        totalRevenue: formatCurrency(cat.totalRevenue),
        totalProfit: formatCurrency(cat.totalProfit),
        avgMargin: formatPercent(cat.avgMargin),
      })),
      y,
      'Category Performance'
    )
  }

  // Item Details
  if (data.items.length > 0) {
    y = addTableToPDF(
      doc,
      [
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Name', dataKey: 'name' },
        { header: 'Sale Price', dataKey: 'salePrice', align: 'right' },
        { header: 'Cost', dataKey: 'cost', align: 'right' },
        { header: 'Margin', dataKey: 'margin', align: 'right' },
        { header: 'Margin %', dataKey: 'marginPercent', align: 'right' },
        { header: 'Holding Days', dataKey: 'holdingDays', align: 'right' },
        { header: 'ROI', dataKey: 'roi', align: 'right' },
      ],
      data.items.slice(0, 50).map(item => ({
        ...item,
        salePrice: formatCurrency(item.salePrice),
        cost: formatCurrency(item.cost),
        margin: formatCurrency(item.margin),
        marginPercent: formatPercent(item.marginPercent),
        roi: formatPercent(item.roi),
      })),
      y,
      'Item Analysis (Top 50)'
    )
  }

  doc.save('margin-analysis-report.pdf')
}

// Export Salesperson Performance Report
export function exportSalespersonPDF(data: {
  dateRange: { start: string; end: string }
  totals: {
    salespeople: number
    revenue: number
    profit: number
    commission: number
    transactions: number
  }
  salespeople: Array<{
    salespersonName: string
    salesCount: number
    totalRevenue: number
    grossProfit: number
    grossMarginPercent: number
    avgTransactionValue: number
    commissionEarned: number
  }>
}): void {
  const doc = createPDFDocument({
    title: 'Salesperson Performance Report',
    dateRange: data.dateRange,
    orientation: 'landscape',
  })

  let y = 55

  // Summary cards
  y = addSummaryCards(doc, [
    { label: 'Active Salespeople', value: data.totals.salespeople.toString() },
    { label: 'Total Revenue', value: formatCurrency(data.totals.revenue) },
    { label: 'Total Profit', value: formatCurrency(data.totals.profit) },
    { label: 'Total Commission', value: formatCurrency(data.totals.commission) },
    { label: 'Transactions', value: data.totals.transactions.toLocaleString() },
  ], y)

  // Salesperson Table
  y = addTableToPDF(
    doc,
    [
      { header: 'Salesperson', dataKey: 'salespersonName' },
      { header: 'Sales', dataKey: 'salesCount', align: 'right' },
      { header: 'Revenue', dataKey: 'totalRevenue', align: 'right' },
      { header: 'Profit', dataKey: 'grossProfit', align: 'right' },
      { header: 'Margin %', dataKey: 'grossMarginPercent', align: 'right' },
      { header: 'Avg Transaction', dataKey: 'avgTransactionValue', align: 'right' },
      { header: 'Commission', dataKey: 'commissionEarned', align: 'right' },
    ],
    data.salespeople.map(sp => ({
      ...sp,
      totalRevenue: formatCurrency(sp.totalRevenue),
      grossProfit: formatCurrency(sp.grossProfit),
      grossMarginPercent: formatPercent(sp.grossMarginPercent),
      avgTransactionValue: formatCurrency(sp.avgTransactionValue),
      commissionEarned: formatCurrency(sp.commissionEarned),
    })),
    y,
    'Performance Breakdown'
  )

  doc.save('salesperson-performance-report.pdf')
}

// Export Dashboard Summary PDF
export function exportDashboardPDF(data: {
  storeName: string
  metrics: {
    todaySales: number
    todayRevenue: number
    todayProfit: number
    weekRevenue: number
    weekProfit: number
    monthRevenue: number
    monthProfit: number
    inventoryValue: number
    inventoryCount: number
    deadStockCount: number
    avgInventoryAge: number
  }
  topCategories: Array<{
    category: string
    revenue: number
    profit: number
  }>
  recentActivity: Array<{
    type: string
    description: string
    time: string
  }>
}): void {
  const doc = createPDFDocument({
    title: 'Dashboard Summary',
    subtitle: data.storeName,
  })

  let y = 55

  // Today's Performance
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text("Today's Performance", 14, y)
  y += 8

  y = addSummaryCards(doc, [
    { label: 'Sales', value: data.metrics.todaySales.toString() },
    { label: 'Revenue', value: formatCurrency(data.metrics.todayRevenue) },
    { label: 'Profit', value: formatCurrency(data.metrics.todayProfit) },
  ], y)

  // Period Performance
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Period Performance', 14, y)
  y += 8

  y = addSummaryCards(doc, [
    { label: 'This Week', value: formatCurrency(data.metrics.weekRevenue), subtext: `Profit: ${formatCurrency(data.metrics.weekProfit)}` },
    { label: 'This Month', value: formatCurrency(data.metrics.monthRevenue), subtext: `Profit: ${formatCurrency(data.metrics.monthProfit)}` },
  ], y)

  // Inventory Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Inventory Summary', 14, y)
  y += 8

  y = addSummaryCards(doc, [
    { label: 'Total Value', value: formatCurrency(data.metrics.inventoryValue) },
    { label: 'Total Items', value: data.metrics.inventoryCount.toLocaleString() },
    { label: 'Dead Stock', value: data.metrics.deadStockCount.toString() },
    { label: 'Avg Age', value: `${Math.round(data.metrics.avgInventoryAge)} days` },
  ], y)

  // Top Categories
  if (data.topCategories.length > 0) {
    y = addTableToPDF(
      doc,
      [
        { header: 'Category', dataKey: 'category' },
        { header: 'Revenue', dataKey: 'revenue', align: 'right' },
        { header: 'Profit', dataKey: 'profit', align: 'right' },
      ],
      data.topCategories.map(cat => ({
        ...cat,
        revenue: formatCurrency(cat.revenue),
        profit: formatCurrency(cat.profit),
      })),
      y,
      'Top Performing Categories'
    )
  }

  doc.save('dashboard-summary.pdf')
}

// Export generic table data
export function exportTablePDF(
  title: string,
  columns: TableColumn[],
  data: Record<string, any>[],
  options?: Partial<PDFExportOptions>
): void {
  const doc = createPDFDocument({
    title,
    ...options,
  })

  addTableToPDF(doc, columns, data, 55)

  const filename = title.toLowerCase().replace(/\s+/g, '-') + '.pdf'
  doc.save(filename)
}
