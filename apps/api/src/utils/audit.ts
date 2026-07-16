import prisma from "./prisma";

interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  success?: boolean;
  tenantId?: string | null;
}

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  oldValue,
  newValue,
  ipAddress,
  userAgent,
  endpoint,
  success = true,
  tenantId,
}: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || undefined,
        action,
        entity,
        entityId: entityId || undefined,
        oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
        newValue: newValue ? JSON.stringify(newValue) : undefined,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        endpoint: endpoint || undefined,
        success,
        tenantId: tenantId || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
