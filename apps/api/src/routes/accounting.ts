import { FastifyInstance } from "fastify";
import { prisma, nontaxablePrisma } from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";

export async function accountingRoutes(fastify: FastifyInstance) {
  // Financial Dashboard aggregates
  fastify.get("/dashboard", { preHandler: requirePermission("accounting:read") }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { nontaxable } = request.query as { nontaxable?: string };
    const useNontaxable = nontaxable === "true";
    const dbSalesClient = useNontaxable ? nontaxablePrisma : prisma;

    // Fetch active sales, expenses, products for asset value
    const sales = await dbSalesClient.sale.findMany({
      where: { tenantId, status: "COMPLETED" },
      include: { items: { include: { product: true } } },
    });

    const expenses = await prisma.expense.findMany({
      where: { tenantId },
    });

    const products = await prisma.product.findMany({
      where: { tenantId },
    });

    // 1. Calculations
    let grossRevenue = 0;
    let costOfGoodsSold = 0;

    sales.forEach((s) => {
      grossRevenue += s.total;
      s.items.forEach((item) => {
        costOfGoodsSold += item.quantity * item.product.purchaseCost;
      });
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossRevenue - costOfGoodsSold - totalExpenses;

    const inventoryAssetValue = products.reduce(
      (sum, p) => sum + p.quantity * p.purchaseCost,
      0
    );

    // 2. Group sales by date for charts (Last 30 days daily sales)
    const dailySalesMap: { [key: string]: number } = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pastMonthSales = await dbSalesClient.sale.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "asc" },
    });

    pastMonthSales.forEach((s) => {
      const dateKey = s.createdAt.toISOString().slice(0, 10);
      dailySalesMap[dateKey] = (dailySalesMap[dateKey] || 0) + s.total;
    });

    const dailySalesChart = Object.keys(dailySalesMap).map((date) => ({
      date,
      revenue: dailySalesMap[date],
    }));

    // 3. Top products sold by quantity
    const productSalesMap: { [key: string]: { name: string; quantity: number; totalSales: number } } = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = item.product;
        if (!productSalesMap[prod.id]) {
          productSalesMap[prod.id] = { name: prod.name, quantity: 0, totalSales: 0 };
        }
        productSalesMap[prod.id].quantity += item.quantity;
        productSalesMap[prod.id].totalSales += item.quantity * item.price;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 4. Low stock counts
    const lowStockCount = products.filter((p) => p.quantity <= p.reorderLevel).length;

    // 5. Repair status statistics
    const repairsCount = await prisma.repairTicket.count({ where: { tenantId } });
    const pendingRepairs = await prisma.repairTicket.count({
      where: { tenantId, status: { in: ["PENDING", "DIAGNOSING", "WAITING_PARTS", "REPAIRING"] } },
    });

    return {
      grossRevenue,
      costOfGoodsSold,
      totalExpenses,
      netProfit,
      inventoryAssetValue,
      dailySalesChart,
      topProducts,
      lowStockCount,
      repairsCount,
      pendingRepairs,
    };
  });

  // Expense listing
  fastify.get("/expenses", { preHandler: requirePermission("accounting:read") }, async (request) => {
    return prisma.expense.findMany({
      where: { tenantId: request.user!.tenantId },
      orderBy: { date: "desc" },
    });
  });

  // Create expense
  fastify.post("/expenses", { preHandler: requirePermission("accounting:read") }, async (request, reply) => {
    const { category, amount, description, date } = request.body as any;
    if (!category || !amount || amount <= 0) {
      return reply.status(400).send({ error: "Category and positive amount are required" });
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        amount,
        description,
        date: date ? new Date(date) : new Date(),
        tenantId: request.user!.tenantId,
      },
    });

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_EXPENSE",
      entity: "Expense",
      entityId: expense.id,
      newValue: expense,
      tenantId: request.user!.tenantId,
    });

    return expense;
  });

  // Delete expense
  fastify.delete("/expenses/:id", { preHandler: requirePermission("accounting:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const expense = await prisma.expense.findUnique({ where: { id } });

    if (!expense || expense.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Expense record not found" });
    }

    await prisma.expense.delete({ where: { id } });

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_EXPENSE",
      entity: "Expense",
      entityId: id,
      oldValue: expense,
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });

  // System audit logs viewing
  fastify.get("/logs", { preHandler: requirePermission("system:logs") }, async (request) => {
    return prisma.auditLog.findMany({
      where: { tenantId: request.user!.tenantId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });
}
