import PDFDocument from "pdfkit";

export function generateReceiptPdf(sale: any, tenantSettings: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 20, size: [220, 400] }); // Thermal printer dimensions
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Receipt Header
    doc.fontSize(8).text(tenantSettings.appName || "EasyPOS Store", { align: "center" });
    doc.text(tenantSettings.receiptHeader || "", { align: "center" });
    doc.moveDown(1);

    doc.text(`Invoice: ${sale.invoiceNo}`);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`);
    doc.text(`Cashier: ${sale.createdBy || "Sales Desk"}`);
    doc.moveDown(0.5);

    // Items
    doc.text("--------------------------------------");
    doc.fontSize(7);
    sale.items.forEach((item: any) => {
      const lineTotal = item.quantity * item.price;
      doc.text(`${item.product.name.substring(0, 20)}...`);
      doc.text(`${item.quantity} x P${item.price.toFixed(2)} = P${lineTotal.toFixed(2)}`, { align: "right" });
    });
    doc.fontSize(8);
    doc.text("--------------------------------------");

    // Totals
    doc.text(`Subtotal: P${sale.subtotal.toFixed(2)}`, { align: "right" });
    doc.text(`VAT (12%): P${sale.tax.toFixed(2)}`, { align: "right" });
    if (sale.discount > 0) {
      doc.text(`Discount: -P${sale.discount.toFixed(2)}`, { align: "right" });
    }
    doc.text(`TOTAL: P${sale.total.toFixed(2)}`, { align: "right" });
    doc.moveDown(0.5);

    doc.text(`Payment: ${sale.paymentType}`, { align: "left" });
    doc.moveDown(1);

    // Footer
    doc.fontSize(7).text(tenantSettings.receiptFooter || "Thank you!", { align: "center" });

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
