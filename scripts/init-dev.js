const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Load .env before anything else ──────────────────────────────────────────
const rootDir = path.resolve(__dirname, "..");
const envFile = path.resolve(rootDir, ".env");

if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Only set if not already in environment (shell overrides .env)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log(`Loaded environment from ${envFile}`);
}

// ── SQLite fallback (only if DATABASE_URL is still not set) ─────────────────
const isPostgres = process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith("postgresql") ||
   process.env.DATABASE_URL.startsWith("postgres"));

if (!process.env.DATABASE_URL) {
  const dbFile = path.resolve(rootDir, "packages", "database", "prisma", "dev.db");
  process.env.DATABASE_URL = `file:${dbFile}`;
  console.log(`Using default SQLite database at: ${dbFile}`);
} else if (isPostgres) {
  console.log(`Using PostgreSQL database: ${process.env.DATABASE_URL.split("@")[1] || "(neon)"}`);
} else {
  console.log(`Using database: ${process.env.DATABASE_URL}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function runCommand(command, cwd = rootDir) {
  console.log(`\nRunning: ${command}`);
  try {
    execSync(command, { stdio: "inherit", cwd, env: process.env });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== EasyPOS Initialization Script ===");

  // Create uploads folder if not exists
  const uploadsDir = path.resolve(rootDir, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log("Created uploads/ folder.");
  }

  const backupsDir = path.resolve(uploadsDir, "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
    console.log("Created uploads/backups/ folder.");
  }

  // Build packages sequentially
  console.log("\nBuilding shared package...");
  runCommand("npm run build --workspace=packages/shared");

  console.log("\nGenerating Prisma Client...");
  runCommand("npx prisma generate --schema=packages/database/prisma/schema.prisma");

  console.log("\nBuilding database package...");
  runCommand("npm run build --workspace=packages/database");

  console.log("\nBuilding auth package...");
  runCommand("npm run build --workspace=packages/auth");

  console.log("\nBuilding UI package...");
  runCommand("npm run build --workspace=packages/ui");

  // Push schema
  console.log("\nPushing schema to database...");
  runCommand("npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss");

  // Run seed script
  console.log("\nSeeding default database...");
  runCommand("npx prisma db seed");

  console.log("\n=== EasyPOS Setup Completed Successfully! ===");
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
