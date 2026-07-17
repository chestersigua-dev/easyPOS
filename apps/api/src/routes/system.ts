import { FastifyInstance } from "fastify";
import { prisma, nontaxablePrisma } from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { comparePassword, hashPassword } from "@easypos/auth";
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

    if (confirmAppName !== (appNameSetting?.value || "EasyPOS Hub")) {
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
      await prisma.$transaction(async (tx) => {
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
      await prisma.$transaction(async (tx) => {
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
          { key: "APP_NAME", value: "EasyPOS Store" },
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
        { key: "APP_NAME", value: "EasyPOS Store" },
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
      await prisma.$transaction(async (tx) => {
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
}
