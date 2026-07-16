import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATABASE_FILE = path.resolve(__dirname, "..", "..", "..", "packages", "database", "prisma", "dev.db");
const BACKUP_DIR = path.resolve(__dirname, "..", "..", "..", "uploads", "backups");

export function computeFileChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

export interface BackupResult {
  filename: string;
  checksum: string;
  size: number;
}

export function createDatabaseBackup(): BackupResult {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATABASE_FILE)) {
    throw new Error("Source database file not found for backup");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `db_backup_${timestamp}.db`;
  const destPath = path.join(BACKUP_DIR, filename);

  fs.copyFileSync(DATABASE_FILE, destPath);

  const checksum = computeFileChecksum(destPath);
  const stats = fs.statSync(destPath);

  return {
    filename,
    checksum,
    size: stats.size,
  };
}

export function restoreDatabaseFromBackup(filename: string, expectedChecksum: string): void {
  const srcPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Backup file ${filename} not found`);
  }

  const currentChecksum = computeFileChecksum(srcPath);
  if (currentChecksum !== expectedChecksum) {
    throw new Error("Backup file checksum verification failed: file may be corrupted");
  }

  // Backup current db state as emergency fallback before overwrite
  const emergencyDest = `${DATABASE_FILE}.emergency`;
  if (fs.existsSync(DATABASE_FILE)) {
    fs.copyFileSync(DATABASE_FILE, emergencyDest);
  }

  try {
    fs.copyFileSync(srcPath, DATABASE_FILE);
    if (fs.existsSync(emergencyDest)) {
      fs.unlinkSync(emergencyDest);
    }
  } catch (error) {
    // Rollback
    if (fs.existsSync(emergencyDest)) {
      fs.copyFileSync(emergencyDest, DATABASE_FILE);
      fs.unlinkSync(emergencyDest);
    }
    throw error;
  }
}

export function listAvailableBackups(): any[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter((f) => f.startsWith("db_backup_") && f.endsWith(".db"))
    .map((f) => {
      const filePath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        filename: f,
        size: stats.size,
        createdAt: stats.birthtime,
        checksum: computeFileChecksum(filePath),
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
