import { FastifyInstance } from "fastify";
import prisma from "../utils/prisma";
import { requirePermission } from "../middleware/auth";

export async function storeRoutes(fastify: FastifyInstance) {
  // Get all stores
  fastify.get("/", { preHandler: requirePermission("products:read") }, async (request) => {
    return prisma.store.findMany({
      where: { tenantId: request.user!.tenantId },
      orderBy: { name: "asc" },
    });
  });

  // Create store (Settings / Admin only)
  fastify.post("/", { preHandler: requirePermission("system:settings") }, async (request, reply) => {
    const { name, address } = request.body as { name: string; address?: string };
    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Store name is required" });
    }

    const tenantId = request.user!.tenantId;

    try {
      const store = await prisma.$transaction(async (tx) => {
        const newStore = await tx.store.create({
          data: {
            name: name.trim(),
            address: address?.trim() || null,
            tenantId,
          },
        });

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
}
