import PDFDocument from "pdfkit";

export function generateReceiptPdf(sale: any, tenantSettings: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: [612, 950] }); 
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Retrieve BIR metadata settings or use compliant default fallbacks
    const appName = tenantSettings.APP_NAME || "EasyPOS Computer Parts Hub";
    const busStyle = tenantSettings.BIR_BUSINESS_STYLE || "Retail POS & Services";
    const address = tenantSettings.BIR_ADDRESS || "123 Tech Street, Cyberzone, Quezon City";
    const tin = tenantSettings.BIR_TIN || "123-456-789-00000";
    const serialNo = tenantSettings.BIR_SERIAL_NUMBER || "SN: EP-2026-POS-001";
    const min = tenantSettings.BIR_MIN || "MIN: 202607160001";
    const ptuNo = tenantSettings.BIR_PTU_NO || "PTU No: PTU-12345-6789";
    const ptuIssued = tenantSettings.BIR_PTU_ISSUED || "07/16/2026";

    // Helper for lines
    const drawLine = (yVal: number, color = "#e2e8f0", width = 0.5) => {
      doc.moveTo(30, yVal).lineTo(582, yVal).lineWidth(width).strokeColor(color).stroke();
    };

    // Header Info
    doc.fontSize(14).font("Helvetica-Bold").text(appName.toUpperCase(), { align: "center" });
    doc.fontSize(8).font("Helvetica").fillColor("#475569");
    doc.text(`Business Style: ${busStyle}`, { align: "center" });
    doc.text(address, { align: "center" });
    doc.text(`TIN: ${tin}  |  ${serialNo}  |  ${min}`, { align: "center" });
    doc.text(`${ptuNo} (Issued: ${ptuIssued})`, { align: "center" });
    doc.moveDown(0.8);

    const afterHeaderY = doc.y;
    drawLine(afterHeaderY);
    doc.y = afterHeaderY + 8;

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("SALES INVOICE", { align: "center" });
    doc.moveDown(0.2);
    
    const afterInvoiceTitleY = doc.y;
    drawLine(afterInvoiceTitleY);
    doc.y = afterInvoiceTitleY + 10;

    // Meta details (2 columns)
    const metaY = doc.y;
    doc.fontSize(8.5).font("Helvetica").fillColor("#0f172a");
    doc.text(`Invoice No: ${sale.invoiceNo}`, 30, metaY, { width: 260 });
    doc.text(`Date & Time: ${new Date(sale.createdAt).toLocaleString()}`, 30, metaY + 14, { width: 260 });
    doc.text(`Cashier: ${sale.createdBy || "Sales Desk"}`, 320, metaY, { width: 262 });
    if (sale.customer) {
      doc.text(`Customer: ${sale.customer.firstName} ${sale.customer.lastName}`, 320, metaY + 14, { width: 262 });
    }
    
    doc.y = metaY + 36;
    drawLine(doc.y);
    doc.y += 10;

    // Items Header
    const itemHeaderY = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e293b");
    doc.text("ITEM DESCRIPTION", 30, itemHeaderY, { width: 280 });
    doc.text("QTY", 320, itemHeaderY, { width: 50, align: "center" });
    doc.text("UNIT PRICE", 380, itemHeaderY, { width: 90, align: "right" });
    doc.text("TOTAL AMOUNT", 480, itemHeaderY, { width: 102, align: "right" });
    
    doc.y = itemHeaderY + 14;
    drawLine(doc.y, "#94a3b8", 1);
    doc.y += 10;

    // Items list
    let currentY = doc.y;
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a");
    
    sale.items.forEach((item: any) => {
      const lineTotal = item.quantity * item.price;
      const prodName = item.product.name;
      
      doc.text(prodName, 30, currentY, { width: 280 });
      doc.text(item.quantity.toString(), 320, currentY, { width: 50, align: "center" });
      doc.text(`P${item.price.toFixed(2)}`, 380, currentY, { width: 90, align: "right" });
      doc.text(`P${lineTotal.toFixed(2)}`, 480, currentY, { width: 102, align: "right" });
      
      const nameHeight = doc.heightOfString(prodName, { width: 280 });
      currentY += Math.max(14, nameHeight);
      
      if (item.serialNo) {
        doc.fontSize(7).fillColor("#64748b").text(`S/N: ${item.serialNo}`, 40, currentY);
        doc.fontSize(8.5).fillColor("#0f172a");
        currentY += 10;
      }
      currentY += 8; // Row gap
    });
    
    doc.y = currentY;
    drawLine(doc.y);
    doc.y += 10;

    // Math Breakdowns & VAT Columns side-by-side
    const summaryY = doc.y;
    
    // Left side: VAT Breakdown
    const vatableSales = sale.vatableSales ?? (sale.tax > 0 ? sale.total / 1.12 : 0);
    const vatAmount = sale.vatAmount ?? (sale.tax > 0 ? vatableSales * 0.12 : 0);
    const vatExemptSales = sale.vatExemptSales ?? (sale.tax === 0 ? sale.total : 0);
    const zeroRatedSales = sale.zeroRatedSales ?? 0;

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#475569").text("VAT COMPLIANCE SUMMARY", 30, summaryY);
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    doc.text(`VATable Sales:`, 30, summaryY + 14);
    doc.text(`P${vatableSales.toFixed(2)}`, 180, summaryY + 14, { align: "right", width: 80 });
    doc.text(`VAT Amount (12%):`, 30, summaryY + 26);
    doc.text(`P${vatAmount.toFixed(2)}`, 180, summaryY + 26, { align: "right", width: 80 });
    doc.text(`VAT Exempt Sales:`, 30, summaryY + 38);
    doc.text(`P${vatExemptSales.toFixed(2)}`, 180, summaryY + 38, { align: "right", width: 80 });
    doc.text(`Zero-Rated Sales:`, 30, summaryY + 50);
    doc.text(`P${zeroRatedSales.toFixed(2)}`, 180, summaryY + 50, { align: "right", width: 80 });

    // Right side: Totals
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a");
    doc.text("Gross Subtotal:", 350, summaryY);
    doc.text(`P${sale.subtotal.toFixed(2)}`, 480, summaryY, { align: "right", width: 102 });
    
    let offset = 14;
    if (sale.discount > 0) {
      doc.text("Discount / Deduction:", 350, summaryY + offset);
      doc.text(`-P${sale.discount.toFixed(2)}`, 480, summaryY + offset, { align: "right", width: 102 });
      offset += 14;
    }
    
    drawLine(summaryY + offset - 4, "#94a3b8", 1);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a");
    doc.text("TOTAL AMOUNT DUE:", 350, summaryY + offset + 2);
    doc.text(`P${sale.total.toFixed(2)}`, 480, summaryY + offset + 2, { align: "right", width: 102 });
    
    doc.y = summaryY + 68;
    drawLine(doc.y);
    doc.y += 10;

    // Senior Citizen / PWD details if applied
    if (sale.scPwdId || sale.scPwdName) {
      const scY = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text("SC/PWD DISCOUNT DETAILS", 30, scY);
      doc.font("Helvetica").fontSize(8);
      doc.text(`Name: ${sale.scPwdName || "N/A"}`, 30, scY + 12);
      doc.text(`ID No: ${sale.scPwdId || "N/A"}`, 200, scY + 12);
      doc.text(`TIN: ${sale.scPwdTin || "N/A"}`, 370, scY + 12);
      doc.text(`Calculated Discount: P${sale.discount.toFixed(2)}`, 480, scY + 12, { align: "right", width: 102 });
      doc.y = scY + 28;
      drawLine(doc.y);
      doc.y += 10;
    }

    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a");
    doc.text(`Payment Method: ${sale.paymentType}`, 30, doc.y);
    doc.moveDown(1);

    // DTI Compliant Warranty Policy Box
    const warrantyY = doc.y;
    doc.rect(30, warrantyY, 552, 110).fillColor("#f8fafc").strokeColor("#e2e8f0").lineWidth(1).fillAndStroke();
    
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#1e293b").text("WARRANTY TERMS & CONDITIONS (DTI COMPLIANT)", 40, warrantyY + 8);
    doc.font("Helvetica").fontSize(6.5).fillColor("#334155");
    
    const terms = [
      "1. Factory Defects replacement is valid within 7 days from purchase, subject to inspection, complete original packaging, and accessories.",
      "2. Motherboards, CPUs, RAM, GPUs, and SSDs carry a 1-year store/manufacturer warranty from purchase date. Accessories have 3 months warranty.",
      "3. Physical damage, burns, corrosion, unauthorized modification, serial number removal, or tampered warranty stickers immediately void this warranty.",
      "4. Customers must present this original Sales Invoice and complete packaging box (with product serial matching this invoice) to claim warranty.",
      "5. Under R.A. 7394 (Consumer Act of the Philippines), refund or replacement applies only if the item is proven to have an irreparable factory defect."
    ];
    
    let termY = warrantyY + 22;
    terms.forEach((term) => {
      doc.text(term, 40, termY, { width: 532 });
      termY += doc.heightOfString(term, { width: 532 }) + 2;
    });

    doc.y = warrantyY + 120;

    // Signatures
    const sigY = doc.y + 20;
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    
    doc.text("__________________________________", 30, sigY);
    doc.text("Authorized Representative", 30, sigY + 12);
    
    doc.text("__________________________________", 350, sigY);
    doc.text("Customer's Signature Over Printed Name", 350, sigY + 12);
    doc.fontSize(7).fillColor("#64748b").text("(I accept the warranty terms & received items in good condition)", 350, sigY + 24, { width: 202 });

    // BIR Footers (System and PTU Details)
    doc.y = sigY + 50;
    doc.fontSize(5.5).font("Helvetica").fillColor("#64748b");
    doc.text("POS Developer: EasyPOS Hub Philippines Inc.  |  Address: 123 Tech Tower, Makati City, Metro Manila  |  TIN: 987-654-321-000", { align: "center" });
    doc.text("Accreditation No: ACC-98765-43210 (Issued: 07/16/2026)  |  PTU validity statement: Infinite / Lifetime PTU", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#475569").text("THIS SERVES AS AN OFFICIAL RECEIPT.", { align: "center" });
    doc.fontSize(6).font("Helvetica").text(tenantSettings.receiptFooter || "Thank you for your business!", { align: "center" });

    doc.end();
  });
}

export function generateRepairTicketPdf(ticket: any, tenantSettings: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Page Header
    doc.fontSize(18).text("REPAIR WORK TICKET", { align: "center" });
    doc.fontSize(10).text(tenantSettings.appName || "EasyPOS Store", { align: "center" });
    doc.moveDown(2);

    // Ticket Details
    doc.fontSize(12).text(`Ticket No: ${ticket.ticketNo}`, { underline: true });
    doc.text(`Date Opened: ${new Date(ticket.createdAt).toLocaleDateString()}`);
    doc.text(`Status: ${ticket.status}`);
    doc.text(`Technician: ${ticket.technician ? `${ticket.technician.firstName} ${ticket.technician.lastName}` : "Unassigned"}`);
    doc.moveDown(1);

    // Customer Details
    doc.fontSize(12).text("Customer Details:", { underline: true });
    doc.fontSize(10).text(`Name: ${ticket.customer.firstName} ${ticket.customer.lastName}`);
    doc.text(`Mobile: ${ticket.customer.mobile}`);
    doc.text(`Email: ${ticket.customer.email || "N/A"}`);
    doc.moveDown(1);

    // Device Details
    doc.fontSize(12).text("Device Details:", { underline: true });
    doc.fontSize(10).text(`Brand/Model: ${ticket.brand} ${ticket.model}`);
    doc.text(`Serial Number: ${ticket.serialNumber}`);
    doc.text(`Accessories Included: ${ticket.accessories || "None"}`);
    doc.moveDown(1);

    // Issue Details
    doc.fontSize(12).text("Issue Reported:", { underline: true });
    doc.fontSize(10).text(ticket.issueDescription);
    doc.moveDown(1);

    if (ticket.repairNotes) {
      doc.fontSize(12).text("Repair Action Notes:", { underline: true });
      doc.fontSize(10).text(ticket.repairNotes);
      doc.moveDown(1);
    }

    doc.fontSize(12).text(`Estimated Cost: P${ticket.cost.toFixed(2)}`);
    doc.moveDown(2);

    // Signatures
    doc.fontSize(10);
    doc.text("_________________________", 40, doc.y);
    doc.text("Customer Signature", 40, doc.y + 15);

    doc.text("_________________________", 350, doc.y - 15);
    doc.text("Technician Signature", 350, doc.y + 15);

    doc.end();
  });
}
