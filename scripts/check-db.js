const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "..", "packages", "database", "prisma", "dev.db");
process.env.DATABASE_URL = `file:${dbPath}`;
console.log("Connecting to:", process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function check() {
  try {
    const tenants = await prisma.tenant.findMany();
    console.log("=== Tenants ===");
    console.log(tenants.map(t => ({ id: t.id, name: t.name })));

    const users = await prisma.user.findMany({ include: { role: true } });
    console.log("\n=== Users ===");
    console.log(users.map(u => ({ id: u.id, email: u.email, role: u.role.name, tenantId: u.tenantId })));

    const stores = await prisma.store.findMany();
    console.log("\n=== Stores ===");
    console.log(stores.map(s => ({ id: s.id, name: s.name, tenantId: s.tenantId })));

    const products = await prisma.product.findMany();
    console.log("\n=== Products ===");
    console.log(products.map(p => ({ id: p.id, name: p.name, quantity: p.quantity, tenantId: p.tenantId })));

    const inventories = await prisma.storeInventory.findMany({ include: { store: true, product: true } });
    console.log("\n=== Store Inventories ===");
    console.log(inventories.map(i => ({ id: i.id, store: i.store.name, product: i.product.name, quantity: i.quantity })));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
