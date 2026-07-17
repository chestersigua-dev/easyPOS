import { PrismaClient } from "@easypos/database";
import * as path from "path";
import * as fs from "fs";

const isPostgres = process.env.DATABASE_URL?.startsWith("postgresql") || process.env.DATABASE_URL?.startsWith("postgres");

// ── SQLite fallback ──────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  const mainDbFile = path.resolve(
    __dirname, "..", "..", "..", "..", "packages", "database", "prisma", "dev.db"
  );
  process.env.DATABASE_URL = `file:${mainDbFile}`;
  console.log(`[prisma] No DATABASE_URL set — defaulting to SQLite at ${mainDbFile}`);
}

// ── Main Prisma client ───────────────────────────────────────────────────────
export const prisma = new PrismaClient();

// ── Non-taxable Prisma client ────────────────────────────────────────────────
//
//  PostgreSQL / Neon:  Both "databases" are the same connection — Sale.taxable
//  flag already differentiates records, so nontaxablePrisma === prisma.
//
//  SQLite (local):  Historically a separate file (nontaxable.db) was used.
//  We keep that behaviour if DATABASE_URL is a file:// path.
//
let _nontaxablePrisma: PrismaClient;

if (isPostgres) {
  // Reuse the same client; queries must filter by taxable = false themselves.
  _nontaxablePrisma = prisma;
} else {
  // SQLite path: initialise / clone nontaxable.db on first run
  const mainDbFile = path.resolve(
    __dirname, "..", "..", "..", "..", "packages", "database", "prisma", "dev.db"
  );
  const nontaxableDbFile = path.resolve(
    __dirname, "..", "..", "..", "..", "packages", "database", "prisma", "nontaxable.db"
  );

  if (!fs.existsSync(nontaxableDbFile) && fs.existsSync(mainDbFile)) {
    try {
      fs.copyFileSync(mainDbFile, nontaxableDbFile);
      console.log("[prisma] Initialised nontaxable.db from dev.db.");

      const tempClient = new PrismaClient({
        datasources: { db: { url: `file:${nontaxableDbFile}` } },
      });

      tempClient.$connect()
        .then(async () => {
          await tempClient.payment.deleteMany();
          await tempClient.saleItem.deleteMany();
          await tempClient.sale.deleteMany();
          await tempClient.$disconnect();
          console.log("[prisma] Cleaned transaction tables in nontaxable.db.");
        })
        .catch((err) => console.error("[prisma] Failed to clean nontaxable.db:", err));
    } catch (err) {
      console.error("[prisma] Failed to clone nontaxable.db:", err);
    }
  }

  _nontaxablePrisma = new PrismaClient({
    datasources: { db: { url: `file:${nontaxableDbFile}` } },
  });
}

export const nontaxablePrisma = _nontaxablePrisma;
export default prisma;
