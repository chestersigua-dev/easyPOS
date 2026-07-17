import { FastifyInstance } from "fastify";
import { ProductSchema } from "@easypos/shared";
import { prisma, nontaxablePrisma } from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";
import { parseExcelProducts, exportToExcel } from "../utils/excel";

export async function productRoutes(fastify: FastifyInstance) {
  // Get all products
  fastify.get("/", { preHandler: requirePermission("products:read") }, async (request) => {
    const { search, lowStock } = request.query as { search?: string; lowStock?: string };

    const whereClause: any = {
      tenantId: request.user!.tenantId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { brand: { contains: search } },
        { category: { contains: search } },
        {
          storeInventories: {
            some: {
              store: {
                name: { contains: search }
              }
            }
          }
        }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        storeInventories: {
          include: {
            store: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    if (lowStock === "true") {
      return products.filter((p) => p.quantity <= p.reorderLevel);
    }

    return products;
  });

  // Create product
  fastify.post("/", { preHandler: requirePermission("products:create") }, async (request, reply) => {
    const parseResult = ProductSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const existing = await prisma.product.findFirst({
      where: { sku: data.sku, tenantId: request.user!.tenantId },
    });
    if (existing) {
      return reply.status(400).send({ error: "Product SKU already exists in store" });
    }

    const { storeId, ...productData } = data;

    const newProduct = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          ...productData,
          tenantId: request.user!.tenantId,
        },
      });

      // Initialize StoreInventory records for all stores in this tenant
      const stores = await tx.store.findMany({
        where: { tenantId: request.user!.tenantId },
        orderBy: { createdAt: "asc" },
      });

      // Place initial product stock in the selected store or first store as default, others get 0
      const targetStoreId = storeId || (stores[0] ? stores[0].id : null);
      for (let i = 0; i < stores.length; i++) {
        await tx.storeInventory.create({
          data: {
            productId: prod.id,
            storeId: stores[i].id,
            quantity: stores[i].id === targetStoreId ? prod.quantity : 0,
          },
        });
      }

      return prod;
    });

    try {
      await nontaxablePrisma.product.create({
        data: {
          ...productData,
          id: newProduct.id,
          tenantId: request.user!.tenantId,
        },
      });

      // Initialize StoreInventory records for nontaxable db
      const stores = await nontaxablePrisma.store.findMany({
        where: { tenantId: request.user!.tenantId },
        orderBy: { createdAt: "asc" },
      });
      const targetStoreId = storeId || (stores[0] ? stores[0].id : null);
      for (let i = 0; i < stores.length; i++) {
        await nontaxablePrisma.storeInventory.create({
          data: {
            productId: newProduct.id,
            storeId: stores[i].id,
            quantity: stores[i].id === targetStoreId ? newProduct.quantity : 0,
          },
        });
      }
    } catch (err) {
      console.error("Failed to sync product creation to nontaxable db:", err);
    }

    // Create initial stock movement log if quantity > 0
    if (newProduct.quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: newProduct.id,
          type: "IN",
          quantity: newProduct.quantity,
          reason: "Initial stock registration",
          oldQuantity: 0,
          newQuantity: newProduct.quantity,
          createdBy: request.user!.id,
        },
      });
    }

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_PRODUCT",
      entity: "Product",
      entityId: newProduct.id,
      newValue: newProduct,
      tenantId: request.user!.tenantId,
    });

    return newProduct;
  });

  // Update product
  fastify.put("/:id", { preHandler: requirePermission("products:update") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = ProductSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product || product.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const { storeId, ...productData } = data;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
      },
    });

    try {
      await nontaxablePrisma.product.update({
        where: { id },
        data: {
          ...productData,
        },
      });
    } catch (err) {
      console.error("Failed to sync product update to nontaxable db:", err);
    }

    // Log stock changes if direct edit occurred
    if (product.quantity !== updatedProduct.quantity) {
      const diff = updatedProduct.quantity - product.quantity;
      
      // Update store inventory for selected branch to keep in sync
      const targetStoreId = storeId || (await prisma.store.findFirst({
        where: { tenantId: request.user!.tenantId },
        orderBy: { createdAt: "asc" },
      }))?.id;

      if (targetStoreId) {
        await prisma.storeInventory.upsert({
          where: { productId_storeId: { productId: id, storeId: targetStoreId } },
          create: { productId: id, storeId: targetStoreId, quantity: diff > 0 ? diff : 0 },
          update: { quantity: { increment: diff } },
        });

        // Sync to nontaxable storeInventory
        try {
          await nontaxablePrisma.storeInventory.upsert({
            where: { productId_storeId: { productId: id, storeId: targetStoreId } },
            create: { productId: id, storeId: targetStoreId, quantity: diff > 0 ? diff : 0 },
            update: { quantity: { increment: diff } },
          });
        } catch (err) {}
      }

      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: diff > 0 ? "IN" : "OUT",
          quantity: Math.abs(diff),
          reason: "Direct manual inventory update",
          oldQuantity: product.quantity,
          newQuantity: updatedProduct.quantity,
          createdBy: request.user!.id,
        },
      });
    }

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_PRODUCT",
      entity: "Product",
      entityId: id,
      oldValue: product,
      newValue: updatedProduct,
      tenantId: request.user!.tenantId,
    });

    return updatedProduct;
  });

  // Delete product
  fastify.delete("/:id", { preHandler: requirePermission("products:delete") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Product not found" });
    }

    await prisma.product.delete({ where: { id } });

    try {
      await nontaxablePrisma.product.delete({ where: { id } });
    } catch (err) {
      console.error("Failed to sync product deletion to nontaxable db:", err);
    }

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_PRODUCT",
      entity: "Product",
      entityId: id,
      oldValue: product,
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });

  // Adjust stock inventory (Approved adjustment)
  fastify.post("/adjust", { preHandler: requirePermission("accounting:adjust") }, async (request, reply) => {
    const { productId, type, quantity, reason, storeId } = request.body as {
      productId: string;
      type: "IN" | "OUT";
      quantity: number;
      reason: string;
      storeId?: string;
    };

    if (!productId || !type || !quantity || quantity <= 0) {
      return reply.status(400).send({ error: "Missing or invalid parameters" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const oldQty = product.quantity;
    const newQty = type === "IN" ? oldQty + quantity : oldQty - quantity;

    if (newQty < 0) {
      return reply.status(400).send({ error: "Insufficient stock to adjust downwards" });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { quantity: newQty },
    });

    try {
      await nontaxablePrisma.product.update({
        where: { id: productId },
        data: { quantity: newQty },
      });
    } catch (err) {
      console.error("Failed to sync stock adjustment to nontaxable db:", err);
    }

    const targetStoreId = storeId || (await prisma.store.findFirst({
      where: { tenantId: request.user!.tenantId },
      orderBy: { createdAt: "asc" },
    }))?.id;

    if (targetStoreId) {
      await prisma.storeInventory.upsert({
        where: { productId_storeId: { productId, storeId: targetStoreId } },
        create: { productId, storeId: targetStoreId, quantity: type === "IN" ? quantity : 0 },
        update: { quantity: { [type === "IN" ? "increment" : "decrement"]: quantity } },
      });

      // Sync to nontaxable storeInventory
      try {
        await nontaxablePrisma.storeInventory.upsert({
          where: { productId_storeId: { productId, storeId: targetStoreId } },
          create: { productId, storeId: targetStoreId, quantity: type === "IN" ? quantity : 0 },
          update: { quantity: { [type === "IN" ? "increment" : "decrement"]: quantity } },
        });
      } catch (err) {}
    }

    await prisma.stockMovement.create({
      data: {
        productId,
        type: "ADJUSTMENT",
        quantity,
        reason,
        oldQuantity: oldQty,
        newQuantity: newQty,
        createdBy: request.user!.id,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: `STOCK_ADJUSTMENT_${type}`,
      entity: "Product",
      entityId: productId,
      oldValue: { quantity: oldQty },
      newValue: { quantity: newQty, reason },
      tenantId: request.user!.tenantId,
    });

    return updated;
  });

  // Export Excel template or active list
  fastify.get("/export", { preHandler: requirePermission("products:read") }, async (request, reply) => {
    const products = await prisma.product.findMany({
      where: { tenantId: request.user!.tenantId },
    });

    const exportData = products.map((p) => ({
      SKU: p.sku,
      Barcode: p.barcode || "",
      Name: p.name,
      Brand: p.brand,
      Category: p.category,
      Description: p.description || "",
      PurchaseCost: p.purchaseCost,
      SellingPrice: p.sellingPrice,
      WholesalePrice: p.wholesalePrice,
      Quantity: p.quantity,
      MinStock: p.minStock,
      MaxStock: p.maxStock,
      ReorderLevel: p.reorderLevel,
      Warranty: p.warranty || "",
      Location: p.location || "",
      Serialized: p.serialized ? "true" : "false",
    }));

    const buffer = exportToExcel(exportData, "Products");

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", "attachment; filename=products_export.xlsx")
      .send(buffer);
  });

  // Import Products Excel File
  fastify.post("/import", { preHandler: requirePermission("products:create") }, async (request, reply) => {
    const fileData = await request.file();
    if (!fileData) {
      return reply.status(400).send({ error: "Missing uploaded file file" });
    }

    const buffer = await fileData.toBuffer();
    const rows = parseExcelProducts(buffer);

    let importCount = 0;
    let skipCount = 0;

    for (const row of rows) {
      if (!row.sku || !row.name) {
        skipCount++;
        continue;
      }

      // Check if SKU exists
      const existing = await prisma.product.findFirst({
        where: { sku: row.sku, tenantId: request.user!.tenantId },
      });

      if (existing) {
        // Update stock quantity and prices
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            quantity: row.quantity,
            purchaseCost: row.purchaseCost,
            sellingPrice: row.sellingPrice,
            wholesalePrice: row.wholesalePrice,
          },
        });
        try {
          await nontaxablePrisma.product.update({
            where: { id: existing.id },
            data: {
              quantity: row.quantity,
              purchaseCost: row.purchaseCost,
              sellingPrice: row.sellingPrice,
              wholesalePrice: row.wholesalePrice,
            },
          });
        } catch (err) {}
        await prisma.stockMovement.create({
          data: {
            productId: existing.id,
            type: "IN",
            quantity: row.quantity,
            reason: "Bulk spreadsheet update",
            oldQuantity: existing.quantity,
            newQuantity: row.quantity,
            createdBy: request.user!.id,
          },
        });
      } else {
        // Create new
        const newP = await prisma.product.create({
          data: {
            ...row,
            tenantId: request.user!.tenantId,
          },
        });
        try {
          await nontaxablePrisma.product.create({
            data: {
              ...row,
              id: newP.id,
              tenantId: request.user!.tenantId,
            },
          });
        } catch (err) {}
        if (newP.quantity > 0) {
          await prisma.stockMovement.create({
            data: {
              productId: newP.id,
              type: "IN",
              quantity: newP.quantity,
              reason: "Bulk spreadsheet import",
              oldQuantity: 0,
              newQuantity: newP.quantity,
              createdBy: request.user!.id,
            },
          });
        }
      }
      importCount++;
    }

    await logAudit({
      userId: request.user!.id,
      action: "IMPORT_PRODUCTS",
      entity: "Product",
      newValue: { imported: importCount, skipped: skipCount },
      tenantId: request.user!.tenantId,
    });

    return { success: true, imported: importCount, skipped: skipCount };
  });

  // Get stock movement history for a product
  fastify.get("/:id/movements", { preHandler: requirePermission("products:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product || product.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
    });

    return movements;
  });
}
