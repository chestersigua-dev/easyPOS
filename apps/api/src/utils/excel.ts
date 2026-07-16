import * as XLSX from "xlsx";

export function exportToExcel(data: any[], sheetName: string = "Sheet1"): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

export function parseExcelProducts(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Map sheet columns to match db schema fields
  return data.map((row: any) => ({
    sku: String(row.SKU || row.sku || "").trim(),
    barcode: row.Barcode || row.barcode ? String(row.Barcode || row.barcode).trim() : null,
    name: String(row.Name || row.name || "").trim(),
    brand: String(row.Brand || row.brand || "").trim(),
    category: String(row.Category || row.category || "").trim(),
    description: row.Description || row.description ? String(row.Description || row.description).trim() : null,
    purchaseCost: parseFloat(row.PurchaseCost || row.purchase_cost || row.Purchase_Cost || "0"),
    sellingPrice: parseFloat(row.SellingPrice || row.selling_price || row.Selling_Price || "0"),
    wholesalePrice: parseFloat(row.WholesalePrice || row.wholesale_price || row.Wholesale_Price || "0"),
    quantity: parseInt(row.Quantity || row.quantity || "0", 10),
    minStock: parseInt(row.MinStock || row.min_stock || "5", 10),
    maxStock: parseInt(row.MaxStock || row.max_stock || "100", 10),
    reorderLevel: parseInt(row.ReorderLevel || row.reorder_level || "10", 10),
    warranty: row.Warranty || row.warranty ? String(row.Warranty || row.warranty).trim() : null,
    location: row.Location || row.location ? String(row.Location || row.location).trim() : null,
    serialized: row.Serialized || row.serialized === "true" || row.serialized === true,
  }));
}
