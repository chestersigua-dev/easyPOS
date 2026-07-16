import { FastifyInstance } from "fastify";
import { CustomerSchema } from "@easypos/shared";
import prisma from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";

async function generateCustomerId(tenantId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `CUST-${currentYear}-`;

  const count = await prisma.customer.count({
    where: {
      tenantId,
      id: { startsWith: prefix },
    },
  });

  const nextNum = String(count + 1).padStart(4, "0");
  return `${prefix}${nextNum}`;
}

export async function customerRoutes(fastify: FastifyInstance) {
  // Get all customers
  fastify.get("/", { preHandler: requirePermission("customers:read") }, async (request) => {
    const { search } = request.query as { search?: string };
    const whereClause: any = {
      tenantId: request.user!.tenantId,
    };

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { mobile: { contains: search } },
        { email: { contains: search } },
        { id: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    return customers;
  });

  // Create customer
  fastify.post("/", { preHandler: requirePermission("customers:create") }, async (request, reply) => {
    const parseResult = CustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const cid = await generateCustomerId(request.user!.tenantId);

    const newCustomer = await prisma.customer.create({
      data: {
        ...data,
        id: cid,
        birthday: data.birthday ? new Date(data.birthday) : null,
        tenantId: request.user!.tenantId,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_CUSTOMER",
      entity: "Customer",
      entityId: cid,
      newValue: newCustomer,
      tenantId: request.user!.tenantId,
    });

    return newCustomer;
  });

  // Update customer
  fastify.put("/:id", { preHandler: requirePermission("customers:update") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = CustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const customer = await prisma.customer.findUnique({ where: { id } });

    if (!customer || customer.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Customer not found" });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        birthday: data.birthday ? new Date(data.birthday) : null,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_CUSTOMER",
      entity: "Customer",
      entityId: id,
      oldValue: customer,
      newValue: updated,
      tenantId: request.user!.tenantId,
    });

    return updated;
  });

  // Delete customer
  fastify.delete("/:id", { preHandler: requirePermission("customers:delete") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Customer not found" });
    }

    await prisma.customer.delete({ where: { id } });

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_CUSTOMER",
      entity: "Customer",
      entityId: id,
      oldValue: customer,
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });

  // Get customer sales history
  fastify.get("/:id/sales", { preHandler: requirePermission("customers:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const sales = await prisma.sale.findMany({
      where: { customerId: id, tenantId: request.user!.tenantId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    return sales;
  });

  // Get customer repairs history
  fastify.get("/:id/repairs", { preHandler: requirePermission("customers:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repairs = await prisma.repairTicket.findMany({
      where: { customerId: id, tenantId: request.user!.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return repairs;
  });
}
