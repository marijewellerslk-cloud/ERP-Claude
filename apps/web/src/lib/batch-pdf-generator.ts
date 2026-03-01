import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BatchItem {
  sequenceNumber: number;
  inventoryItem: {
    sku: string;
    name: string;
    grossWeight: string;
    netWeight: string;
    stoneWeight?: string;
    purity?: string;
    makingCharges?: string;
    itemCost?: string;
    category?: {
      name: string;
    };
  };
}

interface Batch {
  batchNumber: string;
  purchaseDate: string;
  purchaseType: string;
  expectedTotalItems: number;
  actualTotalItems: number;
  expectedTotalWeight: string;
  actualTotalWeight: string;
  status: string;
  paymentStatus: string;
  // Monetary purchase fields
  totalCost?: string;
  goldRatePerGram?: string;
  totalPaid?: string;
  outstandingBalance?: string;
  // Gold exchange fields
  goldGivenWeight?: string;
  goldGivenPurity?: string;
  goldGivenValue?: string;
  goldBalancePaid?: string;
  goldBalanceReceived?: string;
  goldExchangeStatus?: string;
  // Common fields
  notes?: string;
  createdAt: string;
  completedAt?: string;
  supplier?: {
    businessName: string;
    contactPerson?: string;
    phone?: string;
  };
  store?: {
    name: string;
  };
  createdByUser?: {
    fullName: string;
  };
  batchItems?: BatchItem[];
}

export function generateBatchPDF(batch: Batch) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Inventory Batch Summary', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Batch Number
  doc.setFontSize(14);
  doc.text(batch.batchNumber, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Header Information
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Left column
  const leftCol = 20;
  const rightCol = pageWidth / 2 + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Date:', leftCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(batch.purchaseDate).toLocaleDateString(), leftCol + 35, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Type:', rightCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(batch.purchaseType === 'monetary' ? 'Monetary' : 'Gold Exchange', rightCol + 35, yPos);
  yPos += 7;

  if (batch.supplier) {
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(batch.supplier.businessName, leftCol + 35, yPos);
    yPos += 7;
  }

  if (batch.store) {
    doc.setFont('helvetica', 'bold');
    doc.text('Store:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(batch.store.name, leftCol + 35, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Created By:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(batch.createdByUser?.fullName || 'N/A', rightCol + 35, yPos);
    yPos += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Status:', leftCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(batch.status.replace('_', ' ').toUpperCase(), leftCol + 35, yPos);

  if (batch.purchaseType === 'monetary') {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Status:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(batch.paymentStatus.toUpperCase(), rightCol + 35, yPos);
    yPos += 7;
  }

  yPos += 5;

  // Progress Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Progress Summary', leftCol, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Items: ${batch.actualTotalItems} / ${batch.expectedTotalItems}`, leftCol, yPos);
  doc.text(`Weight: ${parseFloat(batch.actualTotalWeight).toFixed(3)}g / ${parseFloat(batch.expectedTotalWeight).toFixed(3)}g`, rightCol, yPos);
  yPos += 10;

  // Financial/Gold Exchange Summary
  if (batch.purchaseType === 'monetary' && batch.totalCost) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', leftCol, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (batch.goldRatePerGram) {
      doc.text(`Gold Rate/gram: Rs.${parseFloat(batch.goldRatePerGram).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    doc.text(`Total Cost: Rs.${parseFloat(batch.totalCost).toLocaleString()}`, leftCol, yPos);
    yPos += 6;

    if (batch.totalPaid) {
      doc.text(`Total Paid: Rs.${parseFloat(batch.totalPaid).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    if (batch.outstandingBalance && parseFloat(batch.outstandingBalance) > 0) {
      doc.text(`Outstanding Balance: Rs.${parseFloat(batch.outstandingBalance).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    yPos += 5;
  } else if (batch.purchaseType === 'gold_exchange') {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Gold Exchange Summary', leftCol, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (batch.goldGivenWeight) {
      const goldGiven = parseFloat(batch.goldGivenWeight).toFixed(3);
      const purity = batch.goldGivenPurity ? `${batch.goldGivenPurity}K` : '';
      doc.text(`Gold Given: ${goldGiven}g ${purity}`, leftCol, yPos);
      yPos += 6;
    }

    if (batch.goldGivenValue) {
      doc.text(`Gold Given Value: Rs.${parseFloat(batch.goldGivenValue).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    const netWeight = parseFloat(batch.actualTotalWeight);
    doc.text(`Gold Received: ${netWeight.toFixed(3)}g`, leftCol, yPos);
    yPos += 6;

    if (batch.goldBalancePaid && parseFloat(batch.goldBalancePaid) > 0) {
      doc.text(`Balance Paid: Rs.${parseFloat(batch.goldBalancePaid).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    if (batch.goldBalanceReceived && parseFloat(batch.goldBalanceReceived) > 0) {
      doc.text(`Balance Received: Rs.${parseFloat(batch.goldBalanceReceived).toLocaleString()}`, leftCol, yPos);
      yPos += 6;
    }

    if (batch.goldExchangeStatus) {
      doc.text(`Exchange Status: ${batch.goldExchangeStatus.replace('_', ' ').toUpperCase()}`, leftCol, yPos);
      yPos += 6;
    }

    yPos += 5;
  }

  // Items Table
  if (batch.batchItems && batch.batchItems.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Batch Items', leftCol, yPos);
    yPos += 5;

    const tableData = batch.batchItems.map((item) => [
      item.sequenceNumber.toString(),
      item.inventoryItem.sku,
      item.inventoryItem.name,
      item.inventoryItem.category?.name || '-',
      parseFloat(item.inventoryItem.grossWeight).toFixed(3) + 'g',
      parseFloat(item.inventoryItem.netWeight).toFixed(3) + 'g',
      item.inventoryItem.stoneWeight ? parseFloat(item.inventoryItem.stoneWeight).toFixed(3) + 'g' : '-',
      item.inventoryItem.purity || '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'SKU', 'Item Name', 'Category', 'Gross Wt', 'Net Wt', 'Stone Wt', 'Purity']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 15 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Notes
  if (batch.notes) {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', leftCol, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(batch.notes, pageWidth - 40);
    doc.text(splitNotes, leftCol, yPos);
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `${batch.batchNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
