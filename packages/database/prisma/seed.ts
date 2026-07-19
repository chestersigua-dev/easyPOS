import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load .env relative to packages/database/prisma/seed.ts
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

if (!process.env.DATABASE_URL) {
  const dbFile = path.resolve(__dirname, "dev.db");
  process.env.DATABASE_URL = `file:${dbFile}`;
  console.log(`[seed] No DATABASE_URL set — defaulting to SQLite at ${dbFile}`);
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // 1. Clean existing database
  await prisma.setting.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.repairStatusHistory.deleteMany();
  await prisma.repairTicket.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.storeInventory.deleteMany();
  await prisma.store.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.session.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.tenant.deleteMany();

  console.log("Cleaned database tables.");

  // 2. Create Default Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "PC Configure Computer Center",
      subdomain: "pcconfig",
      plan: "ENTERPRISE",
      status: "ACTIVE",
    },
  });

  // 3. Create Settings
  const defaultSettings = [
    { key: "APP_NAME", value: "PC Configure Computer Center" },
    { key: "TAX_RATE", value: "12" }, // 12% VAT (Philippine default)
    { key: "CURRENCY", value: "PHP" },
    { key: "TIMEZONE", value: "Asia/Manila" },
    { key: "RECEIPT_HEADER", value: "PC Configure Computer Center\n1271 MacArthur Hwy, Ninoy Aquino (Marisol), Angeles, 2009 Pampanga\nTel: (045) 436 3832" },
    { key: "RECEIPT_FOOTER", value: "Thank you for your purchase!\nWarranty claims require official receipt." },
    { key: "THEME_COLOR", value: "#0ea5e9" }, // Sky-500
  ];

  for (const s of defaultSettings) {
    await prisma.setting.create({
      data: {
        key: s.key,
        value: s.value,
        tenantId: tenant.id,
      },
    });
  }

  // 4. Create Permissions
  const permissionsList = [
    { action: "users:create", description: "Create new system users" },
    { action: "users:read", description: "View system users" },
    { action: "users:update", description: "Update system users" },
    { action: "users:delete", description: "Delete system users" },
    { action: "products:create", description: "Create products" },
    { action: "products:read", description: "View products list" },
    { action: "products:update", description: "Update product info" },
    { action: "products:delete", description: "Delete products" },
    { action: "customers:create", description: "Create customer profiles" },
    { action: "customers:read", description: "View customer lists and history" },
    { action: "customers:update", description: "Modify customer information" },
    { action: "customers:delete", description: "Delete customer records" },
    { action: "suppliers:create", description: "Create supplier entries" },
    { action: "suppliers:read", description: "View supplier database" },
    { action: "suppliers:update", description: "Modify supplier profiles" },
    { action: "suppliers:delete", description: "Remove suppliers" },
    { action: "sales:create", description: "Create sales / register sales" },
    { action: "sales:read", description: "View sales transaction history" },
    { action: "sales:void", description: "Void completed sales" },
    { action: "sales:hold", description: "Suspend or resume transactions" },
    { action: "sales:quote", description: "Generate sales quotes" },
    { action: "repairs:create", description: "Create repair tickets" },
    { action: "repairs:read", description: "View repair tickets and timelines" },
    { action: "repairs:update", description: "Update repair status and notes" },
    { action: "repairs:delete", description: "Delete repair records" },
    { action: "repairs:assign", description: "Assign technician to repair" },
    { action: "accounting:read", description: "Access profit/loss and expense logs" },
    { action: "accounting:adjust", description: "Approve stock adjustments and write-offs" },
    { action: "system:settings", description: "Modify system parameters and integrations" },
    { action: "system:reset", description: "Deployment/Factory reset action" },
    { action: "system:logs", description: "View and filter system audit logs" },
  ];

  const dbPermissions: { [key: string]: any } = {};
  for (const perm of permissionsList) {
    dbPermissions[perm.action] = await prisma.permission.create({
      data: perm,
    });
  }

  // 5. Create Roles and link Permissions
  const roleSuperAdmin = await prisma.role.create({
    data: {
      name: "SUPERADMIN",
      description: "Root Administrator with absolute control",
      permissions: {
        connect: permissionsList.map((p) => ({ id: dbPermissions[p.action].id })),
      },
    },
  });

  const roleAdmin = await prisma.role.create({
    data: {
      name: "ADMIN",
      description: "Store Manager / Administrator",
      permissions: {
        connect: permissionsList
          .filter((p) => p.action !== "system:reset")
          .map((p) => ({ id: dbPermissions[p.action].id })),
      },
    },
  });

  const roleAccounting = await prisma.role.create({
    data: {
      name: "ACCOUNTING",
      description: "Financial officer / Auditor",
      permissions: {
        connect: [
          dbPermissions["accounting:read"],
          dbPermissions["accounting:adjust"],
          dbPermissions["sales:read"],
          dbPermissions["products:read"],
          dbPermissions["system:logs"],
        ],
      },
    },
  });

  const roleSales = await prisma.role.create({
    data: {
      name: "SALES",
      description: "Front-desk Sales Cashier",
      permissions: {
        connect: [
          dbPermissions["sales:create"],
          dbPermissions["sales:read"],
          dbPermissions["sales:hold"],
          dbPermissions["sales:quote"],
          dbPermissions["products:read"],
          dbPermissions["customers:create"],
          dbPermissions["customers:read"],
          dbPermissions["customers:update"],
        ],
      },
    },
  });

  const roleRepairs = await prisma.role.create({
    data: {
      name: "REPAIRS",
      description: "Hardware Repair Technician",
      permissions: {
        connect: [
          dbPermissions["repairs:create"],
          dbPermissions["repairs:read"],
          dbPermissions["repairs:update"],
          dbPermissions["repairs:assign"],
          dbPermissions["products:read"],
          dbPermissions["customers:create"],
          dbPermissions["customers:read"],
        ],
      },
    },
  });

  // 6. Create Users (Default credentials)
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync("N4suaKDS!", salt);

  const superadmin = await prisma.user.create({
    data: {
      email: "chestersigua@gmail.com",
      passwordHash: passwordHash,
      firstName: "Chester",
      lastName: "Sigua",
      roleId: roleSuperAdmin.id,
      tenantId: tenant.id,
      status: "ACTIVE",
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "ian@pcconfig.com",
      passwordHash: bcrypt.hashSync("admin123", salt),
      firstName: "Iannel",
      lastName: "Bondoc",
      roleId: roleAdmin.id,
      tenantId: tenant.id,
      status: "ACTIVE",
    },
  });

  const accountant = await prisma.user.create({
    data: {
      email: "bebang@pcconfig.com",
      passwordHash: bcrypt.hashSync("accounting123", salt),
      firstName: "Ivylyn",
      lastName: "Bondoc",
      roleId: roleAccounting.id,
      tenantId: tenant.id,
      status: "ACTIVE",
    },
  });

  const salesperson = await prisma.user.create({
    data: {
      email: "sales@pcconfig.com",
      passwordHash: bcrypt.hashSync("sales123", salt),
      firstName: "Jay ANne",
      lastName: "Luna",
      roleId: roleSales.id,
      tenantId: tenant.id,
      status: "ACTIVE",
    },
  });

  const technician = await prisma.user.create({
    data: {
      email: "repairs@easypos.com",
      passwordHash: bcrypt.hashSync("repairs123", salt),
      firstName: "Cleo",
      lastName: "De Guzman",
      roleId: roleRepairs.id,
      tenantId: tenant.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeded Users.");

  // 6.5. Seed Stores
  const store1 = await prisma.store.create({
    data: {
      name: "PC Configure Angeles City",
      address: "DMC Bldg., 1271 MacArthur Hwy, Ninoy Aquino (Marisol), Angeles, Pampanga, 2009",
      tenantId: tenant.id,
    },
  });

  const store2 = await prisma.store.create({
    data: {
      name: "PC Configure Tarlac",
      address: "Unit 2, Felsenron Bldg., Block 6, San Roque, Tarlac City, Tarlac, 2300",
      tenantId: tenant.id,
    },
  });

  const store3 = await prisma.store.create({
    data: {
      name: "PC Configure Urdaneta",
      address: "#22 Josefa Bldg., San Vincente Centro, Urdaneta, Pangasinan, 2428",
      tenantId: tenant.id,
    },
  });

  const store4 = await prisma.store.create({
    data: {
      name: "PC Configure Bulacan",
      address: "2nd Flr Jesters Bldg., BS Aquino Ave, Bagong Nayon, Baliuag, Bulacan, 3006",
      tenantId: tenant.id,
    },
  });

  console.log("Seeded Stores.");

  // 7. Seed Suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      companyName: "TechSource Distributors Inc.",
      contactPerson: "David Lim",
      phone: "+639178881234",
      email: "david@techsource.com",
      address: "45 Pinaglabanan St, San Juan, Metro Manila",
      tin: "123-456-789-000",
      notes: "Primary distributor for ASUS and Corsair products.",
      balance: 15000.0,
      tenantId: tenant.id,
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      companyName: "Apex Silicon Corp",
      contactPerson: "Satoshi Nakamoto",
      phone: "+639189995678",
      email: "sales@apexsilicon.com",
      address: "12 TechZone, Bonifacio Global City, Taguig",
      tin: "987-654-321-000",
      notes: "NVIDIA/AMD importer.",
      balance: 0.0,
      tenantId: tenant.id,
    },
  });

  // 8. Seed Products
  const prod1 = await prisma.product.create({
    data: {
      sku: "PROD-I9-14900K",
      barcode: "5032037278850",
      name: "Intel Core i9-14900K Processor",
      brand: "Intel",
      category: "Processors",
      description: "24 Cores (8 P-cores + 16 E-cores) LGA1700 Socket Desktop CPU",
      purchaseCost: 28500.0,
      sellingPrice: 34500.0,
      wholesalePrice: 32000.0,
      quantity: 15,
      minStock: 5,
      maxStock: 50,
      reorderLevel: 8,
      warranty: "3 Years Local Supplier Warranty",
      location: "Shelf A-3",
      serialized: false,
      tenantId: tenant.id,
    },
  });

  const prod2 = await prisma.product.create({
    data: {
      sku: "PROD-RTX-4090-ROG",
      barcode: "4711081936992",
      name: "ASUS ROG Strix GeForce RTX 4090 OC Edition 24GB",
      brand: "ASUS",
      category: "Graphics Cards",
      description: "PCIe 4.0 DLSS 3 flagship graphics card with custom cooling.",
      purchaseCost: 95000.0,
      sellingPrice: 115000.0,
      wholesalePrice: 108000.0,
      quantity: 4,
      minStock: 2,
      maxStock: 10,
      reorderLevel: 3,
      warranty: "1 Year Store, 3 Years Manufacturer",
      location: "Display Cabinet B-1",
      serialized: true,
      serialNumbers: JSON.stringify(["ROG4090-001", "ROG4090-002", "ROG4090-003", "ROG4090-004"]),
      tenantId: tenant.id,
    },
  });

  const prod3 = await prisma.product.create({
    data: {
      sku: "PROD-SSD-990PRO-2TB",
      barcode: "8806094215038",
      name: "Samsung 990 Pro 2TB NVMe M.2 SSD",
      brand: "Samsung",
      category: "Storage",
      description: "PCIe Gen 4.0 x4, NVMe 2.0 with heatsink.",
      purchaseCost: 7500.0,
      sellingPrice: 9950.0,
      wholesalePrice: 9000.0,
      quantity: 40,
      minStock: 10,
      maxStock: 100,
      reorderLevel: 15,
      warranty: "5 Years Limited Warranty",
      location: "Shelf C-12",
      serialized: false,
      tenantId: tenant.id,
    },
  });

  const prod4 = await prisma.product.create({
    data: {
      sku: "PROD-RAM-DOM-64GB",
      barcode: "840006699318",
      name: "Corsair Dominator Platinum RGB 64GB (2x32GB) DDR5 6000MHz",
      brand: "Corsair",
      category: "RAM / Memory",
      description: "High-performance DDR5 RAM optimized for Intel systems.",
      purchaseCost: 14000.0,
      sellingPrice: 18500.0,
      wholesalePrice: 17000.0,
      quantity: 8,
      minStock: 3,
      maxStock: 20,
      reorderLevel: 5,
      warranty: "Lifetime Warranty",
      location: "Shelf C-5",
      serialized: false,
      tenantId: tenant.id,
    },
  });

  const prod5 = await prisma.product.create({
    data: {
      sku: "PROD-PSU-RM1000X",
      barcode: "840006637846",
      name: "Corsair RM1000x 1000W 80+ Gold Fully Modular Power Supply",
      brand: "Corsair",
      category: "Power Supplies",
      description: "Ultra-low noise modular power supply.",
      purchaseCost: 7500.0,
      sellingPrice: 9450.0,
      wholesalePrice: 8800.0,
      quantity: 2, // LOW STOCK TRIGGER FOR TESTING
      minStock: 5,
      maxStock: 25,
      reorderLevel: 5,
      warranty: "10 Years Warranty",
      location: "Shelf D-1",
      serialized: false,
      tenantId: tenant.id,
    },
  });

  console.log("Seeded Products.");

  // Seed Store Inventories programmatically
  const allProds = [prod1, prod2, prod3, prod4, prod5];
  for (const p of allProds) {
    const qty1 = Math.ceil(p.quantity * 0.6);
    const qty2 = Math.max(0, p.quantity - qty1);

    await prisma.storeInventory.create({
      data: {
        productId: p.id,
        storeId: store1.id,
        quantity: qty1,
      },
    });

    await prisma.storeInventory.create({
      data: {
        productId: p.id,
        storeId: store2.id,
        quantity: qty2,
      },
    });
  }

  // Mark prod5 as non-taxable
  await prisma.product.update({
    where: { id: prod5.id },
    data: { taxable: false },
  });

  console.log("Seeded Store Inventories.");

  // 9. Seed Customers
  const customer1 = await prisma.customer.create({
    data: {
      id: "CUST-2026-0001",
      firstName: "John",
      lastName: "Doe",
      middleName: "Smith",
      mobile: "+639171112222",
      email: "johndoe@gmail.com",
      address: "123 Oakwood Lane, Pasig City",
      city: "Pasig",
      province: "Metro Manila",
      birthday: new Date("1990-05-15"),
      gender: "Male",
      loyaltyPoints: 120,
      notes: "Prefers high-end watercooling parts.",
      status: "ACTIVE",
      tenantId: tenant.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      id: "CUST-2026-0002",
      firstName: "Jane",
      lastName: "Smith",
      middleName: "Rios",
      mobile: "+639183334444",
      email: "janesmith@yahoo.com",
      address: "456 Birch Boulevard, Quezon City",
      city: "Quezon City",
      province: "Metro Manila",
      birthday: new Date("1995-11-20"),
      gender: "Female",
      loyaltyPoints: 45,
      notes: "Regular client from IT Department of Acme Corp.",
      status: "ACTIVE",
      tenantId: tenant.id,
    },
  });

  console.log("Seeded Customers.");

  // 10. Seed Stock Movement History
  await prisma.stockMovement.create({
    data: {
      productId: prod1.id,
      type: "IN",
      quantity: 15,
      reason: "Initial deployment inventory load",
      oldQuantity: 0,
      newQuantity: 15,
      createdBy: superadmin.id,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prod2.id,
      type: "IN",
      quantity: 4,
      reason: "Initial import load",
      oldQuantity: 0,
      newQuantity: 4,
      createdBy: superadmin.id,
    },
  });

  // 11. Seed Sales & Payments
  const sale1 = await prisma.sale.create({
    data: {
      invoiceNo: "INV-20260714-0001",
      customerId: customer1.id,
      subtotal: 44450.0, // Core i9 + 990 Pro SSD
      tax: 5334.0, // 12% tax
      discount: 1000.0,
      total: 48784.0,
      status: "COMPLETED",
      paymentType: "SPLIT",
      tenantId: tenant.id,
      createdBy: salesperson.id,
      storeId: store1.id,
      items: {
        create: [
          { productId: prod1.id, quantity: 1, price: 34500.0 },
          { productId: prod3.id, quantity: 1, price: 9950.0 },
        ],
      },
      payments: {
        create: [
          { amount: 20000.0, type: "CASH", reference: "Cash in drawer" },
          { amount: 28784.0, type: "GCASH", reference: "REF-9993881" },
        ],
      },
    },
  });

  // Update product quantities
  await prisma.product.update({
    where: { id: prod1.id },
    data: { quantity: { decrement: 1 } },
  });
  await prisma.product.update({
    where: { id: prod3.id },
    data: { quantity: { decrement: 1 } },
  });

  await prisma.storeInventory.update({
    where: { productId_storeId: { productId: prod1.id, storeId: store1.id } },
    data: { quantity: { decrement: 1 } },
  });
  await prisma.storeInventory.update({
    where: { productId_storeId: { productId: prod3.id, storeId: store1.id } },
    data: { quantity: { decrement: 1 } },
  });

  // Seed expenses
  await prisma.expense.create({
    data: {
      category: "RENT",
      amount: 25000.0,
      description: "Monthly store rental fee",
      tenantId: tenant.id,
    },
  });

  await prisma.expense.create({
    data: {
      category: "UTILITIES",
      amount: 8200.0,
      description: "Electricity bill Meralco",
      tenantId: tenant.id,
    },
  });

  console.log("Seeded Sales, Payments and Expenses.");

  // 12. Seed Repairs
  const repair1 = await prisma.repairTicket.create({
    data: {
      ticketNo: "REP-2026-0001",
      customerId: customer1.id,
      brand: "ASUS",
      model: "ROG Crosshair X670E",
      serialNumber: "SN-CROSSHAIR-9992",
      accessories: "SATA cables, antenna, original box",
      issueDescription: "Will not post, BIOS Q-Code '00' shown on boot.",
      internalNotes: "Suspecting bios corruption or faulty socket pins.",
      repairNotes: "Diagnosed. Pins are normal. Re-flashed BIOS via USB Flashback and motherboard posted successfully. Testing stability.",
      cost: 2500.0,
      status: "REPAIRING",
      technicianId: technician.id,
      expirationDate: new Date("2026-08-14"),
      tenantId: tenant.id,
      statusHistory: {
        create: [
          { status: "PENDING", notes: "Ticket submitted by sales desk.", updatedBy: salesperson.id },
          { status: "DIAGNOSING", notes: "Checking socket pins and flashing tools.", updatedBy: technician.id },
          { status: "REPAIRING", notes: "Successfully posted. Running overnight stress tests.", updatedBy: technician.id },
        ],
      },
    },
  });

  console.log("Seeded Repairs.");

  // --- SECOND TENANT SEEDING ---
  console.log("Seeding second tenant: Techsyapo...");
  const tenant2 = await prisma.tenant.create({
    data: {
      name: "Techsyapo",
      subdomain: "techsyapo",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    },
  });

  const tenant2Settings = [
    { key: "APP_NAME", value: "Techsyapo" },
    { key: "TAX_RATE", value: "12" },
    { key: "CURRENCY", value: "USD" },
    { key: "TIMEZONE", value: "Asia/Manila" },
    { key: "RECEIPT_HEADER", value: "Techsyapo\nMacArthur Hwy, San Fernando, 2000 Pampanga\nTel: 0456494678" },
    { key: "RECEIPT_FOOTER", value: "Thank you for shopping with us!" },
    { key: "THEME_COLOR", value: "#0ea5e9" },
  ];

  for (const s of tenant2Settings) {
    await prisma.setting.create({
      data: {
        key: s.key,
        value: s.value,
        tenantId: tenant2.id,
      },
    });
  }

  const tenant2Admin = await prisma.user.create({
    data: {
      email: "kit@techsyapo.com",
      passwordHash: passwordHash,
      firstName: "Keithvin",
      lastName: "Nicolas",
      roleId: roleAdmin.id,
      tenantId: tenant2.id,
      status: "ACTIVE",
    },
  });

  const tenant2Sales = await prisma.user.create({
    data: {
      email: "aimee@techsyapo.com",
      passwordHash: bcrypt.hashSync("sales123", salt),
      firstName: "Aimee",
      lastName: "Ang",
      roleId: roleSales.id,
      tenantId: tenant2.id,
      status: "ACTIVE",
    },
  });

  const tenant2Store1 = await prisma.store.create({
    data: {
      name: "Techsyapo San Fernando",
      address: "MacArthur Hwy, City of San Fernando, Pampanga, 2000",
      tenantId: tenant2.id,
    },
  });

  const tenant2Store2 = await prisma.store.create({
    data: {
      name: "Techsyapo Angeles",
      address: "MacArthur Hwy, Balibago, Angeles City, Pampanga, 2009",
      tenantId: tenant2.id,
    },
  });

  const tenant2Store3 = await prisma.store.create({
    data: {
      name: "Techsyapo Olongapo",
      address: "#510 Rizal Avenue, Brgy. East Tapinac, Olongapo City, Zambales, 2200",
      tenantId: tenant2.id,
    },
  });

  const tenant2Supplier = await prisma.supplier.create({
    data: {
      companyName: "Global Chips Logistics",
      contactPerson: "Jane Chen",
      phone: "+639151234567",
      email: "jane@globalchips.com",
      address: "BGC Taguig City",
      tin: "111-222-333-000",
      notes: "Logistics and microcontrollers",
      balance: 5000.0,
      tenantId: tenant2.id,
    },
  });

  const t2Prod1 = await prisma.product.create({
    data: {
      sku: "BC-ESP32-WROOM",
      barcode: "ESP32WROOM32D",
      name: "ESP32-WROOM-32D Development Board",
      brand: "Espressif",
      category: "Microcontrollers",
      description: "Wi-Fi + BT + BLE MCU module",
      purchaseCost: 150.0,
      sellingPrice: 250.0,
      wholesalePrice: 220.0,
      quantity: 100,
      minStock: 20,
      maxStock: 500,
      reorderLevel: 30,
      warranty: "7 Days Replacement Warranty",
      location: "Bin 4",
      serialized: false,
      tenantId: tenant2.id,
    },
  });

  const t2Prod2 = await prisma.product.create({
    data: {
      sku: "BC-RASP-PI-4",
      barcode: "RASPPI4-4GB",
      name: "Raspberry Pi 4 Model B (4GB RAM)",
      brand: "Raspberry Pi",
      category: "Single Board Computers",
      description: "Broadcom BCM2711 quad-core Cortex-A72",
      purchaseCost: 3500.0,
      sellingPrice: 4800.0,
      wholesalePrice: 4500.0,
      quantity: 20,
      minStock: 5,
      maxStock: 50,
      reorderLevel: 8,
      warranty: "1 Year Warranty",
      location: "Shelf B-2",
      serialized: true,
      serialNumbers: JSON.stringify(["PI4-001", "PI4-002", "PI4-003", "PI4-004"]),
      tenantId: tenant2.id,
    },
  });

  const allT2Prods = [t2Prod1, t2Prod2];
  for (const p of allT2Prods) {
    const qty1 = Math.ceil(p.quantity * 0.7);
    const qty2 = Math.max(0, p.quantity - qty1);

    await prisma.storeInventory.create({
      data: {
        productId: p.id,
        storeId: tenant2Store1.id,
        quantity: qty1,
      },
    });

    await prisma.storeInventory.create({
      data: {
        productId: p.id,
        storeId: tenant2Store2.id,
        quantity: qty2,
      },
    });
  }

  const t2Customer = await prisma.customer.create({
    data: {
      id: "CUST-T2-0001",
      firstName: "Alice",
      lastName: "Wonderland",
      mobile: "+639198889999",
      email: "alice@wonder.com",
      address: "Pasig Green Village",
      city: "Pasig",
      province: "Metro Manila",
      loyaltyPoints: 10,
      status: "ACTIVE",
      tenantId: tenant2.id,
    },
  });

  const t2Sale = await prisma.sale.create({
    data: {
      invoiceNo: "INV-BC-20260719-0001",
      customerId: t2Customer.id,
      subtotal: 5300.0,
      tax: 636.0,
      discount: 0.0,
      total: 5936.0,
      status: "COMPLETED",
      paymentType: "CASH",
      tenantId: tenant2.id,
      createdBy: tenant2Sales.id,
      storeId: tenant2Store1.id,
      items: {
        create: [
          { productId: t2Prod1.id, quantity: 2, price: 250.0 },
          { productId: t2Prod2.id, quantity: 1, price: 4800.0 },
        ],
      },
      payments: {
        create: [
          { amount: 5936.0, type: "CASH", reference: "Cash payment" },
        ],
      },
    },
  });

  await prisma.product.update({
    where: { id: t2Prod1.id },
    data: { quantity: { decrement: 2 } },
  });
  await prisma.product.update({
    where: { id: t2Prod2.id },
    data: { quantity: { decrement: 1 } },
  });

  await prisma.storeInventory.update({
    where: { productId_storeId: { productId: t2Prod1.id, storeId: tenant2Store1.id } },
    data: { quantity: { decrement: 2 } },
  });
  await prisma.storeInventory.update({
    where: { productId_storeId: { productId: t2Prod2.id, storeId: tenant2Store1.id } },
    data: { quantity: { decrement: 1 } },
  });

  await prisma.expense.create({
    data: {
      category: "UTILITIES",
      amount: 4500.0,
      description: "Internet and Power",
      tenantId: tenant2.id,
    },
  });

  console.log("Seeded second tenant details.");
  console.log("Seed completely successful!");

  // Copy to nontaxable.db if using SQLite
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("file:")) {
    const mainDbFile = path.resolve(__dirname, "dev.db");
    const nontaxableDbFile = path.resolve(__dirname, "nontaxable.db");
    try {
      if (fs.existsSync(nontaxableDbFile)) {
        fs.unlinkSync(nontaxableDbFile); // Delete old file
      }
      fs.copyFileSync(mainDbFile, nontaxableDbFile);
      console.log("[seed] Synced nontaxable.db with fresh dev.db seed data.");

      const tempClient = new PrismaClient({
        datasources: { db: { url: `file:${nontaxableDbFile}` } },
      });
      await tempClient.$connect();
      await tempClient.payment.deleteMany();
      await tempClient.saleItem.deleteMany();
      await tempClient.sale.deleteMany();
      await tempClient.$disconnect();
      console.log("[seed] Cleaned transaction tables in nontaxable.db.");
    } catch (e) {
      console.error("[seed] Failed to sync nontaxable.db during seed:", e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
