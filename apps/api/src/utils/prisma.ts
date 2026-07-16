import { PrismaClient } from "@easypos/database";
import * as path from "path";

// Ensure the SQLite database path defaults correctly if not specified
if (!process.env.DATABASE_URL) {
  const dbFile = path.resolve(__dirname, "..", "..", "..", "..", "packages", "database", "prisma", "dev.db");
  process.env.DATABASE_URL = `file:${dbFile}`;
}

export const prisma = new PrismaClient();
export default prisma;
