import { FastifyInstance } from "fastify";
import { SupplierSchema } from "../utils/shared";
import prisma from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";

export async function supplierRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: requirePermission("suppliers:read") }, async (request) => {
    const { search } = request.query as { search?: string };
    const whereClause: any = {
      tenantId: request.user!.tenantId,
    };

    if (search) {
      whereClause.OR = [
        { companyName: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    return prisma.supplier.findMany({
      where: whereClause,
      orderBy: { companyName: "asc" },
    });
  });

  fastify.post("/", { preHandler: requirePermission("suppliers:create") }, async (request, reply) => {
    const parseResult = SupplierSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const newSupplier = await prisma.supplier.create({
      data: {
        ...data,
        tenantId: request.user!.tenantId,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_SUPPLIER",
      entity: "Supplier",
      entityId: newSupplier.id,
      newValue: newSupplier,
      tenantId: request.user!.tenantId,
    });

    return newSupplier;
  });

  fastify.put("/:id", { preHandler: requirePermission("suppliers:update") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = SupplierSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier || supplier.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Supplier not found" });
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_SUPPLIER",
      entity: "Supplier",
      entityId: id,
      oldValue: supplier,
      newValue: updated,
      tenantId: request.user!.tenantId,
    });

    return updated;
  });

  fastify.delete("/:id", { preHandler: requirePermission("suppliers:delete") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier || supplier.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Supplier not found" });
    }

    await prisma.supplier.delete({ where: { id } });

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_SUPPLIER",
      entity: "Supplier",
      entityId: id,
      oldValue: supplier,
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });
}
