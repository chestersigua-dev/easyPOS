const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function runCommand(command, cwd = process.cwd()) {
  console.log(`Running: ${command} in ${cwd}`);
  try {
    execSync(command, { stdio: "inherit", cwd });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

async function main() {
  console.log("=== EasyPOS Initialization Script ===");

  // Set default Database URL for SQLite if not present in environment
  const rootDir = path.resolve(__dirname, "..");
  const dbFile = path.resolve(rootDir, "packages", "database", "prisma", "dev.db");

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${dbFile}`;
    console.log(`Using default SQLite database at: ${dbFile}`);
  }

  // Create uploads folder if not exists
  const uploadsDir = path.resolve(rootDir, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log("Created uploads/ folder.");
  }

  // Create doc-backups directory
  const backupsDir = path.resolve(uploadsDir, "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
    console.log("Created uploads/backups/ folder.");
  }

  // Build packages sequentially to avoid dependency issues
  console.log("\nBuilding shared package...");
  runCommand("npm run build --workspace=packages/shared", rootDir);

  console.log("\nGenerating Prisma Client...");
  runCommand("npx prisma generate --schema=packages/database/prisma/schema.prisma", rootDir);

  console.log("\nBuilding database package...");
  runCommand("npm run build --workspace=packages/database", rootDir);

  console.log("\nBuilding auth package...");
  runCommand("npm run build --workspace=packages/auth", rootDir);

  console.log("\nBuilding UI package...");
  runCommand("npm run build --workspace=packages/ui", rootDir);

  // Initialize DB tables
  console.log("\nPushing schema to database...");
  runCommand("npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss", rootDir);

  // Run database seeding
  console.log("\nSeeding default roles, credentials, and products...");
  runCommand("npx ts-node packages/database/prisma/seed.ts", rootDir);

  console.log("\n=== EasyPOS Setup Completed Successfully! ===");
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
