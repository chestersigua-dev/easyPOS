import PDFDocument from "pdfkit";

export function generateReceiptPdf(sale: any, tenantSettings: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 15, size: [220, 600] }); // Increased height to support detailed BIR columns
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

    // Header Info
    doc.fontSize(8).font("Helvetica-Bold").text(appName.toUpperCase(), { align: "center" });
    doc.fontSize(6).font("Helvetica");
    doc.text(`Business Style: ${busStyle}`, { align: "center" });
    doc.text(address, { align: "center" });
    doc.text(`TIN: ${tin}`, { align: "center" });
    doc.text(serialNo, { align: "center" });
    doc.text(min, { align: "center" });
    doc.text(`${ptuNo} (Issued: ${ptuIssued})`, { align: "center" });
    doc.moveDown(0.4);

    doc.text("-------------------------------------------------", { align: "center" });
    doc.fontSize(7).font("Helvetica-Bold").text("SALES INVOICE", { align: "center" });
    doc.font("Helvetica").fontSize(6);
    doc.text("-------------------------------------------------", { align: "center" });

    // Meta details
    doc.text(`Invoice No: ${sale.invoiceNo}`);
    doc.text(`Date & Time: ${new Date(sale.createdAt).toLocaleString()}`);
    doc.text(`Cashier: ${sale.createdBy || "Sales Desk"}`);
    if (sale.customer) {
      doc.text(`Customer: ${sale.customer.firstName} ${sale.customer.lastName}`);
    }
    doc.moveDown(0.4);

    // Items Header
    doc.text("-------------------------------------------------", { align: "center" });
    doc.font("Helvetica-Bold");
    doc.text("ITEM DESCRIPTION       QTY      PRICE      TOTAL");
    doc.font("Helvetica");
    doc.text("-------------------------------------------------", { align: "center" });

    // Items list
    sale.items.forEach((item: any) => {
      const lineTotal = item.quantity * item.price;
      const prodName = item.product.name.substring(0, 18);
      doc.text(
        `${prodName.padEnd(20)} ${item.quantity.toString().padStart(3)}   P${item.price.toFixed(2).padStart(8)}  P${lineTotal.toFixed(2).padStart(8)}`
      );
      if (item.serialNo) {
        doc.fontSize(5.5).text(`  S/N: ${item.serialNo}`);
        doc.fontSize(6);
      }
    });

    doc.text("-------------------------------------------------", { align: "center" });

    // Math Breakdowns
    doc.fontSize(6.5);
    doc.text(`Gross Subtotal: P${sale.subtotal.toFixed(2)}`, { align: "right" });
    if (sale.discount > 0) {
      doc.text(`Discount / Deduction: -P${sale.discount.toFixed(2)}`, { align: "right" });
    }
    doc.font("Helvetica-Bold");
    doc.text(`TOTAL AMOUNT DUE: P${sale.total.toFixed(2)}`, { align: "right" });
    doc.font("Helvetica").fontSize(6);
    doc.moveDown(0.4);

    // Tax Details Breakdown (BIR Compliance Table)
    const vatableSales = sale.vatableSales ?? (sale.tax > 0 ? sale.total / 1.12 : 0);
    const vatAmount = sale.vatAmount ?? (sale.tax > 0 ? vatableSales * 0.12 : 0);
    const vatExemptSales = sale.vatExemptSales ?? (sale.tax === 0 ? sale.total : 0);
    const zeroRatedSales = sale.zeroRatedSales ?? 0;

    doc.text("--- VAT BREAKDOWN COMPLIANCE ---", { align: "center" });
    doc.text(`VATable Sales: P${vatableSales.toFixed(2)}`, { align: "right" });
    doc.text(`VAT Amount (12%): P${vatAmount.toFixed(2)}`, { align: "right" });
    doc.text(`VAT Exempt Sales: P${vatExemptSales.toFixed(2)}`, { align: "right" });
    doc.text(`Zero-Rated Sales: P${zeroRatedSales.toFixed(2)}`, { align: "right" });
    doc.text("-------------------------------------------------", { align: "center" });
    doc.moveDown(0.4);

    // Senior Citizen / PWD details if applied
    if (sale.scPwdId || sale.scPwdName) {
      doc.font("Helvetica-Bold").text("SC/PWD DISCOUNT APPLIED", { align: "center" });
      doc.font("Helvetica");
      doc.text(`Name: ${sale.scPwdName || "N/A"}`);
      doc.text(`ID No: ${sale.scPwdId || "N/A"}`);
      doc.text(`TIN: ${sale.scPwdTin || "N/A"}`);
      doc.text(`Calculated Discount: P${sale.discount.toFixed(2)}`);
      doc.text("-------------------------------------------------", { align: "center" });
      doc.moveDown(0.4);
    }

    doc.text(`Payment Method: ${sale.paymentType}`, { align: "left" });
    doc.moveDown(0.5);

    // BIR Footers (System and PTU Details)
    doc.fontSize(5.5);
    doc.text("POS Developer: EasyPOS Hub Philippines Inc.", { align: "center" });
    doc.text("Address: 123 Tech Tower, Makati City, Metro Manila", { align: "center" });
    doc.text("Developer TIN: 987-654-321-000", { align: "center" });
    doc.text("Accreditation No: ACC-98765-43210 (Issued: 07/16/2026)", { align: "center" });
    doc.text("PTU validity statement: Infinite / Lifetime PTU", { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(6.5).font("Helvetica-Bold");
    doc.text("THIS SERVES AS AN OFFICIAL RECEIPT.", { align: "center" });
    doc.fontSize(5.5).font("Helvetica");
    doc.text(tenantSettings.receiptFooter || "Thank you for your business!", { align: "center" });

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
