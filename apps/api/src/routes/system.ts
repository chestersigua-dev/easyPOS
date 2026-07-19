import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma, nontaxablePrisma } from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { comparePassword, hashPassword, generateAccessToken } from "../utils/auth";
import { verifyMfaToken } from "../utils/totp";
import { logAudit } from "../utils/audit";
import { createDatabaseBackup, restoreDatabaseFromBackup, listAvailableBackups } from "../utils/backup";

export async function systemRoutes(fastify: FastifyInstance) {
  // Get all settings
  fastify.get("/settings", { preHandler: requirePermission("products:read") }, async (request) => {
    const settings = await prisma.setting.findMany({
      where: { tenantId: request.user!.tenantId },
    });
    const map: any = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return map;
  });

  // Save settings
  fastify.post("/settings", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    const body = request.body as { [key: string]: string };
    const tenantId = request.user!.tenantId;

    const oldSettings = await prisma.setting.findMany({ where: { tenantId } });

    for (const key of Object.keys(body)) {
      await prisma.setting.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key,
          },
        },
        create: {
          key,
          value: String(body[key]),
          tenantId,
        },
        update: {
          value: String(body[key]),
        },
      });
    }

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_SYSTEM_SETTINGS",
      entity: "Setting",
      oldValue: oldSettings,
      newValue: body,
      tenantId,
    });

    return { success: true };
  });

  // Get backup list
  fastify.get("/backups", { preHandler: requirePermission("system:reset") }, async () => {
    return listAvailableBackups();
  });

  // Create manual backup
  fastify.post("/backups/create", { preHandler: requirePermission("system:reset") }, async (request) => {
    const backup = createDatabaseBackup();

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_BACKUP_MANUAL",
      entity: "System",
      newValue: { filename: backup.filename, checksum: backup.checksum },
      tenantId: request.user!.tenantId,
    });

    return backup;
  });

  // Restore backup
  fastify.post("/backups/restore", { preHandler: requirePermission("system:reset") }, async (request, reply) => {
    const { filename, checksum, password } = request.body as any;

    if (!filename || !checksum || !password) {
      return reply.status(400).send({ error: "Missing filename, checksum or password" });
    }

    // Verify password of current user
    const superAdmin = await prisma.user.findUnique({
      where: { id: request.user!.id },
    });

    if (!superAdmin || !comparePassword(password, superAdmin.passwordHash)) {
      return reply.status(401).send({ error: "Re-authentication failed: invalid password" });
    }

    try {
      restoreDatabaseFromBackup(filename, checksum);

      // Re-write audit log after restore
      await logAudit({
        userId: request.user!.id,
        action: "RESTORE_BACKUP_SUCCESS",
        entity: "System",
        newValue: { filename },
        tenantId: request.user!.tenantId,
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to restore backup" });
    }
  });

  // DEPLOYMENT RESET (SuperAdmin only)
  fastify.post("/reset", { preHandler: requirePermission("system:reset") }, async (request, reply) => {
    const { password, totpCode, confirmPhrase, confirmAppName, options } = request.body as any;

    // 1. Password verification
    const superAdmin = await prisma.user.findUnique({
      where: { id: request.user!.id },
    });

    if (!superAdmin || !comparePassword(password, superAdmin.passwordHash)) {
      return reply.status(401).send({ error: "Invalid password" });
    }

    // 2. MFA confirmation if active
    if (superAdmin.mfaEnabled) {
      if (!totpCode || !superAdmin.mfaSecret || !verifyMfaToken(totpCode, superAdmin.mfaSecret)) {
        return reply.status(401).send({ error: "Invalid MFA code" });
      }
    }

    // 3. Confirm phrase check
    if (confirmPhrase !== "RESET APPLICATION") {
      return reply.status(400).send({ error: "Confirm phrase must be exactly 'RESET APPLICATION'" });
    }

    // 4. Confirm app name check
    const appNameSetting = await prisma.setting.findUnique({
      where: { tenantId_key: { tenantId: request.user!.tenantId, key: "APP_NAME" } },
    });

    if (confirmAppName !== (appNameSetting?.value || "csERP Hub")) {
      return reply.status(400).send({ error: "Confirm app name does not match current app name" });
    }

    // 5. Automatic safety backup before destructive operations
    let backupFile;
    try {
      backupFile = createDatabaseBackup();
    } catch (backupError) {
      return reply.status(500).send({ error: "Backup creation failed. Reset aborted for safety." });
    }

    // 6. Destructive transactional changes based on options
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Option dataReset: Clean transaction files
        if (options.dataReset) {
          await tx.payment.deleteMany();
          await tx.saleItem.deleteMany();
          await tx.sale.deleteMany();
          await tx.repairStatusHistory.deleteMany();
          await tx.repairTicket.deleteMany();
          await tx.stockMovement.deleteMany();
          await tx.expense.deleteMany();
          // Clear active user sessions/tokens (excluding current superadmin)
          await tx.session.deleteMany({ where: { userId: { not: superAdmin.id } } });
          await tx.refreshToken.deleteMany({ where: { userId: { not: superAdmin.id } } });
        }

        // Option productReset
        if (options.productReset === "DELETE_ALL") {
          await tx.product.deleteMany();
        }

        // Option inventoryReset
        if (options.inventoryReset === "RESET_QUANTITIES_ZERO") {
          await tx.product.updateMany({ data: { quantity: 0 } });
        }

        // Option customerReset
        if (options.customerReset === "DELETE_ALL") {
          await tx.customer.deleteMany();
        } else if (options.customerReset === "DELETE_ALL_KEEP_LOYALTY") {
          await tx.customer.updateMany({ data: { status: "INACTIVE" } });
        }

        // Option supplierReset
        if (options.supplierReset) {
          await tx.supplier.deleteMany();
        }

        // Option userReset
        if (options.userReset === "REMOVE_ALL_EXCEPT_SUPERADMIN") {
          await tx.user.deleteMany({
            where: { id: { not: superAdmin.id } },
          });
        }

        // Option settingsReset
        if (options.settingsReset) {
          await tx.setting.deleteMany({
            where: { key: { notIn: ["APP_NAME", "CURRENCY", "TIMEZONE"] } },
          });
        }
      });

      // Clean up equivalent tables in nontaxable.db
      try {
        if (options.dataReset) {
          await nontaxablePrisma.payment.deleteMany();
          await nontaxablePrisma.saleItem.deleteMany();
          await nontaxablePrisma.sale.deleteMany();
          await nontaxablePrisma.repairStatusHistory.deleteMany();
          await nontaxablePrisma.repairTicket.deleteMany();
          await nontaxablePrisma.stockMovement.deleteMany();
          await nontaxablePrisma.expense.deleteMany();
        }

        if (options.productReset === "DELETE_ALL") {
          await nontaxablePrisma.product.deleteMany();
        }

        if (options.customerReset === "DELETE_ALL") {
          await nontaxablePrisma.customer.deleteMany();
        }

        if (options.supplierReset) {
          await nontaxablePrisma.supplier.deleteMany();
        }

        if (options.userReset === "REMOVE_ALL_EXCEPT_SUPERADMIN") {
          await nontaxablePrisma.user.deleteMany({
            where: { id: { not: superAdmin.id } },
          });
        }

        if (options.settingsReset) {
          await nontaxablePrisma.setting.deleteMany({
            where: { key: { notIn: ["APP_NAME", "CURRENCY", "TIMEZONE"] } },
          });
        }
      } catch (err) {
        console.error("Failed to clean up nontaxable.db during reset:", err);
      }

      // 7. Write immutable audit record of reset
      await logAudit({
        userId: superAdmin.id,
        action: "SYSTEM_DEPLOYMENT_RESET",
        entity: "System",
        newValue: {
          backupFile: backupFile.filename,
          backupChecksum: backupFile.checksum,
          options,
        },
        tenantId: request.user!.tenantId,
      });

      return { success: true, backup: backupFile };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to execute database reset commands" });
    }
  });

  // FACTORY RESET (SuperAdmin only)
  fastify.post("/factory-reset", { preHandler: requirePermission("system:reset") }, async (request, reply) => {
    const { password } = request.body as any;

    const superAdmin = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!superAdmin || !comparePassword(password, superAdmin.passwordHash)) {
      return reply.status(401).send({ error: "Invalid password confirmation" });
    }

    try {
      // 1. Safety Backup
      const backup = createDatabaseBackup();

      // 2. Full purge inside a transaction
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.setting.deleteMany();
        await tx.expense.deleteMany();
        await tx.payment.deleteMany();
        await tx.saleItem.deleteMany();
        await tx.sale.deleteMany();
        await tx.repairStatusHistory.deleteMany();
        await tx.repairTicket.deleteMany();
        await tx.stockMovement.deleteMany();
        await tx.product.deleteMany();
        await tx.customer.deleteMany();
        await tx.supplier.deleteMany();
        await tx.session.deleteMany();
        await tx.refreshToken.deleteMany();
        // Delete users EXCEPT current SuperAdmin
        await tx.user.deleteMany({ where: { id: { not: superAdmin.id } } });
      });

      try {
        await nontaxablePrisma.setting.deleteMany();
        await nontaxablePrisma.expense.deleteMany();
        await nontaxablePrisma.payment.deleteMany();
        await nontaxablePrisma.saleItem.deleteMany();
        await nontaxablePrisma.sale.deleteMany();
        await nontaxablePrisma.repairStatusHistory.deleteMany();
        await nontaxablePrisma.repairTicket.deleteMany();
        await nontaxablePrisma.stockMovement.deleteMany();
        await nontaxablePrisma.product.deleteMany();
        await nontaxablePrisma.customer.deleteMany();
        await nontaxablePrisma.supplier.deleteMany();
        await nontaxablePrisma.session.deleteMany();
        await nontaxablePrisma.refreshToken.deleteMany();
        await nontaxablePrisma.user.deleteMany({ where: { id: { not: superAdmin.id } } });

        const defaultSettings = [
          { key: "APP_NAME", value: "csERP Store" },
          { key: "TAX_RATE", value: "12" },
          { key: "CURRENCY", value: "PHP" },
          { key: "TIMEZONE", value: "Asia/Manila" },
        ];
        for (const s of defaultSettings) {
          await nontaxablePrisma.setting.create({
            data: { key: s.key, value: s.value, tenantId: request.user!.tenantId },
          });
        }
      } catch (err) {
        console.error("Failed to factory reset nontaxable.db:", err);
      }

      // 3. Setup default settings
      const defaultSettings = [
        { key: "APP_NAME", value: "csERP Store" },
        { key: "TAX_RATE", value: "12" },
        { key: "CURRENCY", value: "PHP" },
        { key: "TIMEZONE", value: "Asia/Manila" },
      ];
      for (const s of defaultSettings) {
        await prisma.setting.create({
          data: { key: s.key, value: s.value, tenantId: request.user!.tenantId },
        });
      }

      await logAudit({
        userId: superAdmin.id,
        action: "SYSTEM_FACTORY_RESET",
        entity: "System",
        newValue: { backupFile: backup.filename },
        tenantId: request.user!.tenantId,
      });

      return { success: true, backup };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to complete Factory Reset" });
    }
  });

  // PREPARE FOR DEPLOYMENT / PRODUCTION INITIALIZATION
  fastify.post("/initialize-production", { preHandler: requirePermission("system:reset") }, async (request, reply) => {
    const tenantId = request.user!.tenantId;

    try {
      // 1. Perform database backup
      const backup = createDatabaseBackup();

      // 2. Remove all demo/sample records
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete transactional logs
        await tx.payment.deleteMany();
        await tx.saleItem.deleteMany();
        await tx.sale.deleteMany();
        await tx.repairStatusHistory.deleteMany();
        await tx.repairTicket.deleteMany();
        await tx.stockMovement.deleteMany();
        await tx.expense.deleteMany();

        // Delete sample customers & suppliers
        await tx.customer.deleteMany();
        await tx.supplier.deleteMany();

        // Reset inventory quantities to zero
        await tx.product.updateMany({
          data: { quantity: 0, serialNumbers: null },
        });

        // Clear active user sessions/tokens
        await tx.session.deleteMany({ where: { userId: { not: request.user!.id } } });
        await tx.refreshToken.deleteMany({ where: { userId: { not: request.user!.id } } });
      });

      // 3. Optimize the SQLite database
      await prisma.$executeRawUnsafe("VACUUM");

      await logAudit({
        userId: request.user!.id,
        action: "PREPARE_FOR_DEPLOYMENT_COMPLETE",
        entity: "System",
        newValue: { backupFile: backup.filename },
        tenantId,
      });

      return {
        success: true,
        report: {
          message: "Production environment initialization complete.",
          tasks: [
            "Demo sales purged",
            "Demo repairs purged",
            "Sample customer database cleared",
            "Sample supplier records deleted",
            "Stock counts reset to zero",
            "Database optimized (VACUUM)",
            "Safety backup created successfully",
          ],
          backupFile: backup.filename,
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to prepare production setup" });
    }
  });

  // --- TENANT SUBSCRIPTION MANAGEMENT ---

  // Get all tenants (businesses)
  fastify.get("/tenants", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        users: {
          select: { id: true, email: true, role: { select: { name: true } } }
        },
        settings: true,
        stores: true
      },
      orderBy: { name: "asc" }
    });

    return tenants.map(t => {
      const settingsMap: any = {};
      t.settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });

      const adminUser = t.users.find(u => u.role.name === "ADMIN");

      return {
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        plan: t.plan,
        status: t.status,
        ownerName: t.ownerName,
        tinNumber: t.tinNumber,
        phoneNumber: t.phoneNumber,
        email: t.email,
        licenseExpiresAt: t.licenseExpiresAt,
        sla: t.sla,
        createdAt: t.createdAt,
        usersCount: t.users.length,
        settings: settingsMap,
        stores: t.stores,
        adminEmail: adminUser?.email || null,
        hasAdmin: !!adminUser
      };
    });
  });

  // Create new tenant (business)
  fastify.post("/tenants", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }

    const data = request.body as any;
    const {
      name,
      subdomain,
      plan,
      status,
      ownerName,
      tinNumber,
      phoneNumber,
      email,
      licenseExpiresAt,
      sla = "STANDARD",
      // Admin details
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      // Localization defaults
      currency = "PHP",
      taxRate = "12",
      timezone = "Asia/Manila",
      receiptHeader = "",
      receiptFooter = ""
    } = data;

    if (!name) {
      return reply.status(400).send({ error: "Business name is required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create Tenant
        const tenant = await tx.tenant.create({
          data: {
            name,
            subdomain: subdomain || null,
            plan: plan || "ENTERPRISE",
            status: status || "ACTIVE",
            ownerName: ownerName || null,
            tinNumber: tinNumber || null,
            phoneNumber: phoneNumber || null,
            email: email || null,
            licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : null,
            sla: sla || "STANDARD",
          }
        });

        // 2. Create Default settings
        const settingsToCreate = [
          { key: "APP_NAME", value: name },
          { key: "TAX_RATE", value: taxRate },
          { key: "CURRENCY", value: currency },
          { key: "TIMEZONE", value: timezone },
          { key: "RECEIPT_HEADER", value: receiptHeader || `${name.toUpperCase()}\nAddress: N/A` },
          { key: "RECEIPT_FOOTER", value: receiptFooter || "Thank you for your business!" },
          { key: "ENABLED_MODULES", value: "DASHBOARD,POS,PRODUCTS,REPAIRS,CUSTOMERS,SUPPLIERS,ACCOUNTING" }
        ];

        for (const s of settingsToCreate) {
          await tx.setting.create({
            data: {
              key: s.key,
              value: s.value,
              tenantId: tenant.id
            }
          });
        }

        // 3. Create Admin user if details provided
        if (adminEmail && adminPassword) {
          const roleAdmin = await tx.role.findUnique({
            where: { name: "ADMIN" }
          });
          if (!roleAdmin) {
            throw new Error("ADMIN role not found in database");
          }

          const passHash = hashPassword(adminPassword);

          await tx.user.create({
            data: {
              email: adminEmail,
              passwordHash: passHash,
              firstName: adminFirstName || "Store",
              lastName: adminLastName || "Admin",
              roleId: roleAdmin.id,
              tenantId: tenant.id,
              status: "ACTIVE"
            }
          });
        }

        // 4. Create default store/branch
        const defaultStore = await tx.store.create({
          data: {
            name: `${name} Main Branch`,
            address: "Default Branch Location Address",
            tenantId: tenant.id
          }
        });

        // Sync default store to nontaxable.db
        try {
          await nontaxablePrisma.store.create({
            data: {
              id: defaultStore.id,
              name: `${name} Main Branch`,
              address: "Default Branch Location Address",
              tenantId: tenant.id
            }
          });
        } catch (err) {
          console.error("Failed to sync new tenant store to nontaxable db:", err);
        }

        // 5. Seed default products and assign store inventories
        const defaultProducts = [
          {
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
            taxable: true
          },
          {
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
            taxable: true
          },
          {
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
            taxable: true
          },
          {
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
            taxable: true
          },
          {
            sku: "PROD-PSU-RM1000X",
            barcode: "840006637846",
            name: "Corsair RM1000x 1000W 80+ Gold Fully Modular Power Supply",
            brand: "Corsair",
            category: "Power Supplies",
            description: "Ultra-low noise modular power supply.",
            purchaseCost: 7500.0,
            sellingPrice: 9450.0,
            wholesalePrice: 8800.0,
            quantity: 2,
            minStock: 5,
            maxStock: 25,
            reorderLevel: 5,
            warranty: "10 Years Warranty",
            location: "Shelf D-1",
            serialized: false,
            taxable: false
          }
        ];

        for (const p of defaultProducts) {
          const prod = await tx.product.create({
            data: {
              ...p,
              tenantId: tenant.id
            }
          });

          // Sync product to nontaxable db
          try {
            await nontaxablePrisma.product.create({
              data: {
                ...p,
                id: prod.id,
                tenantId: tenant.id
              }
            });
          } catch (err) {
            console.error("Failed to sync default product to nontaxable db:", err);
          }

          // Create store inventory record
          await tx.storeInventory.create({
            data: {
              productId: prod.id,
              storeId: defaultStore.id,
              quantity: prod.quantity
            }
          });

          // Sync store inventory record to nontaxable db
          try {
            await nontaxablePrisma.storeInventory.create({
              data: {
                productId: prod.id,
                storeId: defaultStore.id,
                quantity: prod.quantity
              }
            });
          } catch (err) {
            console.error("Failed to sync default store inventory to nontaxable db:", err);
          }
        }

        return tenant;
      });

      await logAudit({
        userId: request.user!.id,
        action: "CREATE_BUSINESS_SUBSCRIPTION",
        entity: "Tenant",
        newValue: result,
        tenantId: request.user!.tenantId
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to create business subscription" });
    }
  });

  // Update tenant (business)
  fastify.put("/tenants/:id", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }

    const { id } = request.params as { id: string };
    const data = request.body as any;
    const {
      name,
      plan,
      status,
      ownerName,
      tinNumber,
      phoneNumber,
      email,
      licenseExpiresAt,
      sla,
      // Localization defaults
      currency,
      taxRate,
      timezone,
      receiptHeader,
      receiptFooter,
      // Admin details to update/create
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName
    } = data;

    try {
      const oldTenant = await prisma.tenant.findUnique({ where: { id } });
      if (!oldTenant) {
        return reply.status(404).send({ error: "Business not found" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update Tenant details
        const tenant = await tx.tenant.update({
          where: { id },
          data: {
            name,
            plan,
            status,
            ownerName,
            tinNumber,
            phoneNumber,
            email,
            licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : null,
            sla,
          }
        });

        // 2. Update Settings if provided
        const settingsToUpdate = [];
        if (currency) settingsToUpdate.push({ key: "CURRENCY", value: currency });
        if (taxRate) settingsToUpdate.push({ key: "TAX_RATE", value: taxRate });
        if (timezone) settingsToUpdate.push({ key: "TIMEZONE", value: timezone });
        if (receiptHeader !== undefined) settingsToUpdate.push({ key: "RECEIPT_HEADER", value: receiptHeader });
        if (receiptFooter !== undefined) settingsToUpdate.push({ key: "RECEIPT_FOOTER", value: receiptFooter });
        if (name) settingsToUpdate.push({ key: "APP_NAME", value: name });

        for (const s of settingsToUpdate) {
          await tx.setting.upsert({
            where: { tenantId_key: { tenantId: id, key: s.key } },
            create: { key: s.key, value: String(s.value), tenantId: id },
            update: { value: String(s.value) }
          });
        }

        // 3. Create or Reset admin user credentials if details provided
        if (adminEmail && adminPassword) {
          const roleAdmin = await tx.role.findUnique({ where: { name: "ADMIN" } });
          if (!roleAdmin) {
            throw new Error("ADMIN role not found in database");
          }

          const passHash = hashPassword(adminPassword);
          
          const existingAdmin = await tx.user.findFirst({
            where: { tenantId: id, role: { name: "ADMIN" } }
          });

          if (existingAdmin) {
            await tx.user.update({
              where: { id: existingAdmin.id },
              data: {
                email: adminEmail,
                passwordHash: passHash,
                firstName: adminFirstName || existingAdmin.firstName,
                lastName: adminLastName || existingAdmin.lastName
              }
            });
          } else {
            await tx.user.create({
              data: {
                email: adminEmail,
                passwordHash: passHash,
                firstName: adminFirstName || "Store",
                lastName: adminLastName || "Admin",
                roleId: roleAdmin.id,
                tenantId: id,
                status: "ACTIVE"
              }
            });
          }
        }

        return tenant;
      });

      await logAudit({
        userId: request.user!.id,
        action: "UPDATE_BUSINESS_SUBSCRIPTION",
        entity: "Tenant",
        oldValue: oldTenant,
        newValue: result,
        tenantId: request.user!.tenantId
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to update business subscription" });
    }
  });

  // Delete tenant (business)
  fastify.delete("/tenants/:id", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }

    const { id } = request.params as { id: string };

    if (id === request.user?.tenantId) {
      return reply.status(400).send({ error: "Cannot delete the business you are currently logged into." });
    }

    try {
      const oldTenant = await prisma.tenant.findUnique({ where: { id } });
      if (!oldTenant) {
        return reply.status(404).send({ error: "Business not found" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.setting.deleteMany({ where: { tenantId: id } });
        await tx.refreshToken.deleteMany({ where: { user: { tenantId: id } } });
        await tx.session.deleteMany({ where: { user: { tenantId: id } } });
        await tx.auditLog.deleteMany({ where: { tenantId: id } });
        
        await tx.expense.deleteMany({ where: { tenantId: id } });
        await tx.payment.deleteMany({ where: { sale: { tenantId: id } } });
        await tx.saleItem.deleteMany({ where: { product: { tenantId: id } } });
        await tx.sale.deleteMany({ where: { tenantId: id } });
        
        await tx.repairTicket.deleteMany({ where: { tenantId: id } });
        
        await tx.stockMovement.deleteMany({ where: { product: { tenantId: id } } });
        await tx.stockTransfer.deleteMany({
          where: {
            OR: [
              { sourceStore: { tenantId: id } },
              { targetStore: { tenantId: id } }
            ]
          }
        });
        await tx.storeInventory.deleteMany({ where: { store: { tenantId: id } } });
        await tx.store.deleteMany({ where: { tenantId: id } });
        await tx.product.deleteMany({ where: { tenantId: id } });
        
        await tx.customer.deleteMany({ where: { tenantId: id } });
        await tx.supplier.deleteMany({ where: { tenantId: id } });
        
        await tx.user.deleteMany({ where: { tenantId: id } });
        
        await tx.tenant.delete({ where: { id } });
      });

      await logAudit({
        userId: request.user!.id,
        action: "DELETE_BUSINESS_SUBSCRIPTION",
        entity: "Tenant",
        oldValue: oldTenant,
        tenantId: request.user!.tenantId
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to delete business" });
    }
  });

  // Impersonate tenant admin
  fastify.post("/tenants/:tenantId/impersonate", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }

    const { tenantId } = request.params as { tenantId: string };

    const targetUser = await prisma.user.findFirst({
      where: {
        tenantId,
        role: {
          name: "ADMIN"
        }
      },
      include: {
        role: true,
        tenant: true
      }
    });

    if (!targetUser) {
      return reply.status(404).send({ error: "No admin user found for this business" });
    }

    const accessToken = generateAccessToken({
      userId: targetUser.id,
      tenantId: targetUser.tenantId,
      role: targetUser.role.name,
    });

    // Write audit log
    await logAudit({
      userId: request.user!.id,
      action: "SUPERADMIN_IMPERSONATION",
      entity: "User",
      entityId: targetUser.id,
      tenantId: request.user!.tenantId,
      endpoint: `/api/v1/system/tenants/${tenantId}/impersonate`,
    });

    const enabledModulesSetting = await prisma.setting.findUnique({
      where: { tenantId_key: { tenantId: targetUser.tenantId, key: "ENABLED_MODULES" } },
    });
    const enabledModules = enabledModulesSetting
      ? enabledModulesSetting.value.split(",")
      : ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"];

    return {
      accessToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role.name,
        mfaEnabled: false,
        profilePhoto: targetUser.profilePhoto,
        enabledModules,
        businessName: targetUser.tenant?.name || null,
      },
    };
  });

  // Get all license tiers and rates
  fastify.get("/license-tiers", { preHandler: requirePermission("products:read") }, async (request) => {
    const systemTenantId = request.user!.tenantId;
    const setting = await prisma.setting.findUnique({
      where: {
        tenantId_key: {
          tenantId: systemTenantId,
          key: "LICENSE_TIERS_DATA"
        }
      }
    });

    if (setting) {
      try {
        return JSON.parse(setting.value);
      } catch (e) {
        console.error("Failed to parse stored tiers:", e);
      }
    }

    const defaultTiers = [
      { key: "STARTER", name: "Starter Tier", rate: 49, annualRate: 490, billing: "monthly", modules: ["DASHBOARD", "POS", "CUSTOMERS"] },
      { key: "PROFESSIONAL", name: "Professional Tier", rate: 99, annualRate: 990, billing: "monthly", modules: ["DASHBOARD", "POS", "PRODUCTS", "CUSTOMERS", "SUPPLIERS"] },
      { key: "ENTERPRISE", name: "Enterprise Tier", rate: 199, annualRate: 1990, billing: "monthly", modules: ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"] }
    ];

    await prisma.setting.upsert({
      where: {
        tenantId_key: {
          tenantId: systemTenantId,
          key: "LICENSE_TIERS_DATA"
        }
      },
      create: {
        key: "LICENSE_TIERS_DATA",
        value: JSON.stringify(defaultTiers),
        tenantId: systemTenantId
      },
      update: {
        value: JSON.stringify(defaultTiers)
      }
    });

    return defaultTiers;
  });

  // Save license tiers and rates
  fastify.post("/license-tiers", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }
    const systemTenantId = request.user!.tenantId;
    const body = request.body as any[];

    await prisma.setting.upsert({
      where: {
        tenantId_key: {
          tenantId: systemTenantId,
          key: "LICENSE_TIERS_DATA"
        }
      },
      create: {
        key: "LICENSE_TIERS_DATA",
        value: JSON.stringify(body),
        tenantId: systemTenantId
      },
      update: {
        value: JSON.stringify(body)
      }
    });

    return { success: true };
  });

  // --- TENANT STORE/BRANCH MANAGEMENT ---

  // Get all stores for a specific tenant
  fastify.get("/tenants/:tenantId/stores", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }
    const { tenantId } = request.params as { tenantId: string };
    return prisma.store.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  });

  // Create a store for a specific tenant
  fastify.post("/tenants/:tenantId/stores", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }
    const { tenantId } = request.params as { tenantId: string };
    const { name, address } = request.body as { name: string; address?: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Store name is required" });
    }

    try {
      const store = await prisma.$transaction(async (tx) => {
        const newStore = await tx.store.create({
          data: {
            name: name.trim(),
            address: address?.trim() || null,
            tenantId,
          },
        });

        try {
          await nontaxablePrisma.store.create({
            data: {
              id: newStore.id,
              name: name.trim(),
              address: address?.trim() || null,
              tenantId,
            },
          });
        } catch (err) {
          console.error("Failed to sync store creation to nontaxable db:", err);
        }

        // Initialize StoreInventory for all existing products in this tenant with 0 stock
        const products = await tx.product.findMany({
          where: { tenantId },
        });

        for (const p of products) {
          await tx.storeInventory.create({
            data: {
              productId: p.id,
              storeId: newStore.id,
              quantity: 0,
            },
          });
        }

        return newStore;
      });

      return store;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to create store" });
    }
  });

  // Update a store for a specific tenant
  fastify.put("/tenants/:tenantId/stores/:storeId", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }
    const { tenantId, storeId } = request.params as { tenantId: string; storeId: string };
    const { name, address } = request.body as { name: string; address?: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Store name is required" });
    }

    try {
      const updatedStore = await prisma.$transaction(async (tx) => {
        const store = await tx.store.update({
          where: { id: storeId, tenantId },
          data: {
            name: name.trim(),
            address: address?.trim() || null,
          },
        });

        try {
          await nontaxablePrisma.store.update({
            where: { id: storeId, tenantId },
            data: {
              name: name.trim(),
              address: address?.trim() || null,
            },
          });
        } catch (err) {
          console.error("Failed to sync store update to nontaxable db:", err);
        }

        return store;
      });

      return updatedStore;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to update store" });
    }
  });

  // Delete a store for a specific tenant
  fastify.delete("/tenants/:tenantId/stores/:storeId", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    if (request.user?.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Access denied: SuperAdmin role required" });
    }
    const { tenantId, storeId } = request.params as { tenantId: string; storeId: string };

    try {
      await prisma.$transaction(async (tx) => {
        // Cascade delete dependents linked to this specific store
        await tx.storeInventory.deleteMany({ where: { storeId } });
        await tx.stockTransfer.deleteMany({
          where: {
            OR: [
              { sourceStoreId: storeId },
              { targetStoreId: storeId }
            ]
          }
        });
        await tx.payment.deleteMany({ where: { sale: { storeId } } });
        await tx.saleItem.deleteMany({ where: { sale: { storeId } } });
        await tx.sale.deleteMany({ where: { storeId } });
        await tx.repairTicket.deleteMany({ where: { storeId } });
        
        await tx.store.delete({ where: { id: storeId, tenantId } });

        try {
          await nontaxablePrisma.storeInventory.deleteMany({ where: { storeId } });
          await nontaxablePrisma.store.delete({ where: { id: storeId, tenantId } });
        } catch (err) {
          console.error("Failed to sync store deletion to nontaxable db:", err);
        }
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to delete store" });
    }
  });
}
