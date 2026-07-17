import { FastifyInstance } from "fastify";
import prisma from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";

export async function transferRoutes(fastify: FastifyInstance) {
  // List transfers history
  fastify.get("/", { preHandler: requirePermission("products:read") }, async (request) => {
    return prisma.stockTransfer.findMany({
      where: {
        product: { tenantId: request.user!.tenantId },
      },
      include: {
        product: true,
        sourceStore: true,
        targetStore: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // Execute transfer
  fastify.post("/", { preHandler: requirePermission("accounting:adjust") }, async (request, reply) => {
    const { sourceStoreId, targetStoreId, productId, quantity } = request.body as {
      sourceStoreId: string;
      targetStoreId: string;
      productId: string;
      quantity: number;
    };

    if (!sourceStoreId || !targetStoreId || !productId || !quantity || quantity <= 0) {
      return reply.status(400).send({ error: "Missing or invalid transfer parameters" });
    }

    if (sourceStoreId === targetStoreId) {
      return reply.status(400).send({ error: "Source and target store locations cannot be the same" });
    }

    const tenantId = request.user!.tenantId;

    try {
      const transfer = await prisma.$transaction(async (tx) => {
        // 1. Verify stores and product belong to tenant
        const [sourceStore, targetStore, product] = await Promise.all([
          tx.store.findFirst({ where: { id: sourceStoreId, tenantId } }),
          tx.store.findFirst({ where: { id: targetStoreId, tenantId } }),
          tx.product.findFirst({ where: { id: productId, tenantId } }),
        ]);

        if (!sourceStore || !targetStore || !product) {
          throw new Error("Invalid store or product reference");
        }

        // 2. Get inventories
        const sourceInv = await tx.storeInventory.findUnique({
          where: { productId_storeId: { productId, storeId: sourceStoreId } },
        });

        if (!sourceInv || sourceInv.quantity < quantity) {
          throw new Error(`Insufficient stock in ${sourceStore.name}. Available: ${sourceInv?.quantity || 0}`);
        }

        // 3. Update source inventory
        await tx.storeInventory.update({
          where: { productId_storeId: { productId, storeId: sourceStoreId } },
          data: { quantity: { decrement: quantity } },
        });

        // 4. Update target inventory
        await tx.storeInventory.upsert({
          where: { productId_storeId: { productId, storeId: targetStoreId } },
          create: { productId, storeId: targetStoreId, quantity },
          update: { quantity: { increment: quantity } },
        });

        // 5. Create transfer history log
        const newTransfer = await tx.stockTransfer.create({
          data: {
            sourceStoreId,
            targetStoreId,
            productId,
            quantity,
            createdBy: request.user!.email,
          },
          include: {
            product: true,
            sourceStore: true,
            targetStore: true,
          },
        });

        // 6. Log stock movements for audit trail
        await tx.stockMovement.create({
          data: {
            productId,
            type: "OUT",
            quantity,
            reason: `Transfer to ${targetStore.name} (${newTransfer.id})`,
            oldQuantity: sourceInv.quantity,
            newQuantity: sourceInv.quantity - quantity,
            createdBy: request.user!.id,
          },
        });

        const targetInv = await tx.storeInventory.findUnique({
          where: { productId_storeId: { productId, storeId: targetStoreId } },
        });
        const oldTargetQty = (targetInv?.quantity || 0) - quantity;
        await tx.stockMovement.create({
          data: {
            productId,
            type: "IN",
            quantity,
            reason: `Transfer from ${sourceStore.name} (${newTransfer.id})`,
            oldQuantity: oldTargetQty,
            newQuantity: targetInv?.quantity || quantity,
            createdBy: request.user!.id,
          },
        });

        return newTransfer;
      });

      await logAudit({
        userId: request.user!.id,
        action: "INVENTORY_TRANSFER",
        entity: "StockTransfer",
        entityId: transfer.id,
        newValue: { from: transfer.sourceStore.name, to: transfer.targetStore.name, product: transfer.product.name, qty: quantity },
        tenantId,
      });

      return transfer;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Transfer transaction failed" });
    }
  });
}
