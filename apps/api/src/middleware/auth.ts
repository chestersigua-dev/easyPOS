import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "@easypos/auth";
import prisma from "../utils/prisma";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized: Missing access token" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    // Verify user status in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return reply.status(403).send({ error: "Access denied: Account is inactive or locked" });
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      tenantId: user.tenantId,
    };
  } catch (error) {
    return reply.status(401).send({ error: "Unauthorized: Invalid or expired token" });
  }
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Ensure user is authenticated first
    if (!request.user) {
      await authenticate(request, reply);
      if (reply.sent) return;
    }

    const userRoleName = request.user?.role;
    if (!userRoleName) {
      return reply.status(403).send({ error: "Access denied: Missing role information" });
    }

    // SuperAdmin bypasses all permission checks
    if (userRoleName === "SUPERADMIN") {
      return;
    }

    // Query roles and permissions from database
    const roleWithPermissions = await prisma.role.findFirst({
      where: { name: userRoleName },
      include: { permissions: true },
    });

    if (!roleWithPermissions) {
      return reply.status(403).send({ error: "Access denied: Role not found in database" });
    }

    const hasPermission = roleWithPermissions.permissions.some(
      (p) => p.action === permission
    );

    if (!hasPermission) {
      return reply.status(403).send({ error: `Forbidden: Missing required permission '${permission}'` });
    }
  };
}
