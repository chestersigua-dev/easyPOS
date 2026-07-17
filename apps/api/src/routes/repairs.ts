import { FastifyInstance } from "fastify";
import { RepairSchema } from "@easypos/shared";
import prisma from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";
import { generateRepairTicketPdf } from "../utils/pdf";

async function generateTicketNumber(tenantId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REP-${currentYear}-`;

  const count = await prisma.repairTicket.count({
    where: {
      tenantId,
      ticketNo: { startsWith: prefix },
    },
  });

  const nextNum = String(count + 1).padStart(4, "0");
  return `${prefix}${nextNum}`;
}

export async function repairRoutes(fastify: FastifyInstance) {
  // Get all repair tickets
  fastify.get("/", { preHandler: requirePermission("repairs:read") }, async (request) => {
    const { status, storeId } = request.query as { status?: string; storeId?: string };
    const whereClause: any = {
      tenantId: request.user!.tenantId,
    };

    if (status) {
      whereClause.status = status;
    }
    if (storeId) {
      whereClause.storeId = storeId;
    }

    return prisma.repairTicket.findMany({
      where: whereClause,
      include: {
        customer: true,
        technician: true,
        statusHistory: true,
        store: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // Create repair ticket
  fastify.post("/", { preHandler: requirePermission("repairs:create") }, async (request, reply) => {
    const parseResult = RepairSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const tenantId = request.user!.tenantId;
    const ticketNo = await generateTicketNumber(tenantId);

    const ticket = await prisma.repairTicket.create({
      data: {
        ticketNo,
        customerId: data.customerId,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        accessories: data.accessories || null,
        issueDescription: data.issueDescription,
        internalNotes: data.internalNotes || null,
        cost: data.cost,
        status: "PENDING",
        technicianId: data.technicianId || null,
        customerSignature: data.customerSignature || null,
        technicianSignature: data.technicianSignature || null,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        tenantId,
        storeId: data.storeId || null,
        statusHistory: {
          create: {
            status: "PENDING",
            notes: "Ticket created successfully",
            updatedBy: `${request.user!.email}`,
          },
        },
      },
      include: {
        customer: true,
        technician: true,
        store: true,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_REPAIR_TICKET",
      entity: "RepairTicket",
      entityId: ticket.id,
      newValue: { ticketNo: ticket.ticketNo, brand: ticket.brand, model: ticket.model },
      tenantId,
    });

    return ticket;
  });

  // Update repair ticket (Assign technician, add notes, or transitions status)
  fastify.put("/:id", { preHandler: requirePermission("repairs:update") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = RepairSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const ticket = await prisma.repairTicket.findUnique({
      where: { id },
      include: { statusHistory: true },
    });

    if (!ticket || ticket.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Repair ticket not found" });
    }

    const isStatusChanged = ticket.status !== data.status;

    const updated = await prisma.repairTicket.update({
      where: { id },
      data: {
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        accessories: data.accessories || null,
        issueDescription: data.issueDescription,
        internalNotes: data.internalNotes || null,
        repairNotes: data.repairNotes || null,
        cost: data.cost,
        status: data.status,
        technicianId: data.technicianId || null,
        customerSignature: data.customerSignature || null,
        technicianSignature: data.technicianSignature || null,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        storeId: data.storeId || null,
      },
      include: {
        customer: true,
        technician: true,
        statusHistory: true,
        store: true,
      },
    });

    // Record status movement timeline history
    if (isStatusChanged) {
      await prisma.repairStatusHistory.create({
        data: {
          repairTicketId: id,
          status: data.status,
          notes: data.repairNotes || `Status updated to ${data.status}`,
          updatedBy: `${request.user!.email}`,
        },
      });
    }

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_REPAIR_TICKET",
      entity: "RepairTicket",
      entityId: id,
      oldValue: { status: ticket.status, cost: ticket.cost, technicianId: ticket.technicianId },
      newValue: { status: updated.status, cost: updated.cost, technicianId: updated.technicianId },
      tenantId: request.user!.tenantId,
    });

    return updated;
  });

  // Delete repair ticket
  fastify.delete("/:id", { preHandler: requirePermission("repairs:delete") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const ticket = await prisma.repairTicket.findUnique({ where: { id } });
    if (!ticket || ticket.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Repair ticket not found" });
    }

    await prisma.repairTicket.delete({ where: { id } });

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_REPAIR_TICKET",
      entity: "RepairTicket",
      entityId: id,
      oldValue: ticket,
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });

  // Export PDF Ticket
  fastify.get("/:id/pdf", { preHandler: requirePermission("repairs:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const ticket = await prisma.repairTicket.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: true,
      },
    });

    if (!ticket || ticket.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Repair ticket not found" });
    }

    const settingsList = await prisma.setting.findMany({
      where: { tenantId: request.user!.tenantId },
    });

    const settings: any = {};
    settingsList.forEach((s) => {
      if (s.key === "APP_NAME") settings.appName = s.value;
    });

    const pdfBuffer = await generateRepairTicketPdf(ticket, settings);

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename=repair_ticket_${ticket.ticketNo}.pdf`)
      .send(pdfBuffer);
  });
}
