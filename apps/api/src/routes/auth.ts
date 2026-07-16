import { FastifyInstance } from "fastify";
import { comparePassword, hashPassword, generateAccessToken, generateRefreshToken } from "@easypos/auth";
import { LoginSchema, MfaVerifySchema } from "@easypos/shared";
import prisma from "../utils/prisma";
import { authenticate, requirePermission } from "../middleware/auth";
import { generateMfaSecret, generateQrCodeDataUrl, verifyMfaToken } from "../utils/totp";
import { logAudit } from "../utils/audit";

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post("/login", async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const { email, password } = parseResult.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const passwordMatches = comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    // Check if MFA is required (if enabled)
    if (user.mfaEnabled && !request.headers["x-mfa-token"]) {
      return reply.status(200).send({ mfaRequired: true, userId: user.id });
    }

    if (user.mfaEnabled) {
      const mfaToken = request.headers["x-mfa-token"] as string;
      if (!user.mfaSecret || !verifyMfaToken(mfaToken, user.mfaSecret)) {
        return reply.status(401).send({ error: "Invalid MFA code" });
      }
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role.name,
    });

    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Set refresh token in httpOnly cookie
    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Write login audit log
    await logAudit({
      userId: user.id,
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      tenantId: user.tenantId,
      endpoint: "/api/v1/auth/login",
    });

    const enabledModulesSetting = await prisma.setting.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key: "ENABLED_MODULES" } },
    });
    const enabledModules = enabledModulesSetting
      ? enabledModulesSetting.value.split(",")
      : ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"];

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        mfaEnabled: user.mfaEnabled,
        profilePhoto: user.profilePhoto,
        enabledModules,
      },
    };
  });

  // MFA verification during login screen
  fastify.post("/login/mfa", async (request, reply) => {
    const { userId, token } = request.body as { userId: string; token: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || user.status !== "ACTIVE" || !user.mfaEnabled || !user.mfaSecret) {
      return reply.status(400).send({ error: "Invalid login status" });
    }

    if (!verifyMfaToken(token, user.mfaSecret)) {
      return reply.status(401).send({ error: "Invalid MFA code" });
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role.name,
    });

    const refreshToken = generateRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logAudit({
      userId: user.id,
      action: "USER_LOGIN_MFA",
      entity: "User",
      entityId: user.id,
      tenantId: user.tenantId,
      endpoint: "/api/v1/auth/login/mfa",
    });

    const enabledModulesSetting = await prisma.setting.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key: "ENABLED_MODULES" } },
    });
    const enabledModules = enabledModulesSetting
      ? enabledModulesSetting.value.split(",")
      : ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"];

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        mfaEnabled: user.mfaEnabled,
        profilePhoto: user.profilePhoto,
        enabledModules,
      },
    };
  });

  // Token Refresh
  fastify.post("/refresh", async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ error: "Refresh token missing" });
    }

    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { role: true } } },
    });

    if (!dbToken || dbToken.expiresAt < new Date()) {
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate tokens
    const accessToken = generateAccessToken({
      userId: dbToken.user.id,
      tenantId: dbToken.user.tenantId,
      role: dbToken.user.role.name,
    });

    const newRefreshToken = generateRefreshToken(dbToken.user.id);

    // Delete old refresh token, save new
    await prisma.refreshToken.delete({ where: { id: dbToken.id } });
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: dbToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie("refreshToken", newRefreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  });

  // Logout
  fastify.post("/logout", async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    reply.clearCookie("refreshToken", { path: "/" });
    return { success: true };
  });

  // Get current user profile
  fastify.get("/me", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { role: { include: { permissions: true } } },
    });

    return {
      user: {
        id: user!.id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        role: user!.role.name,
        permissions: user!.role.permissions.map((p) => p.action),
        mfaEnabled: user!.mfaEnabled,
        profilePhoto: user!.profilePhoto,
      },
    };
  });

  // Update current user profile
  fastify.put("/me", { preHandler: authenticate }, async (request, reply) => {
    const { firstName, lastName, email, password, profilePhoto } = request.body as any;

    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.status(400).send({ error: "Email already exists" });
      }
      updateData.email = email;
    }

    if (password) {
      updateData.passwordHash = hashPassword(password);
    }

    if (profilePhoto !== undefined) {
      updateData.profilePhoto = profilePhoto; // base64 string or null
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { role: true },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE_PROFILE",
      entity: "User",
      entityId: user.id,
      oldValue: { firstName: user.firstName, lastName: user.lastName, email: user.email },
      newValue: { firstName: updated.firstName, lastName: updated.lastName, email: updated.email },
      tenantId: user.tenantId,
      endpoint: "/api/v1/auth/me",
    });

    return {
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role.name,
        profilePhoto: updated.profilePhoto,
      },
    };
  });

  // Setup MFA
  fastify.post("/mfa/setup", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    const { secret, otpauth } = generateMfaSecret(user!.email, "EasyPOS Hub");
    const qrDataUrl = await generateQrCodeDataUrl(otpauth);

    // Temporarily save secret
    await prisma.user.update({
      where: { id: user!.id },
      data: { mfaSecret: secret },
    });

    return { secret, qrDataUrl };
  });

  // Verify and Enable MFA
  fastify.post("/mfa/verify", { preHandler: authenticate }, async (request, reply) => {
    const parseResult = MfaVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const { token } = parseResult.data;
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });

    if (!user || !user.mfaSecret) {
      return reply.status(400).send({ error: "MFA setup has not been initiated" });
    }

    const isValid = verifyMfaToken(token, user.mfaSecret);
    if (!isValid) {
      return reply.status(400).send({ error: "Verification failed: invalid OTP token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    });

    await logAudit({
      userId: user.id,
      action: "MFA_ENABLED",
      entity: "User",
      entityId: user.id,
      tenantId: user.tenantId,
      endpoint: "/api/v1/auth/mfa/verify",
    });

    return { success: true };
  });

  // Disable MFA
  fastify.post("/mfa/disable", { preHandler: authenticate }, async (request) => {
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await logAudit({
      userId: request.user!.id,
      action: "MFA_DISABLED",
      entity: "User",
      entityId: request.user!.id,
      tenantId: request.user!.tenantId,
      endpoint: "/api/v1/auth/mfa/disable",
    });

    return { success: true };
  });

  // CRUD User Accounts (Requires permissions)
  fastify.get("/users", { preHandler: requirePermission("users:read") }, async (request) => {
    const users = await prisma.user.findMany({
      where: { tenantId: request.user!.tenantId },
      include: { role: true },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role.name,
      roleId: u.roleId,
      status: u.status,
      createdAt: u.createdAt,
    }));
  });

  // Create User
  fastify.post("/users", { preHandler: requirePermission("users:create") }, async (request, reply) => {
    const { email, password, firstName, lastName, roleId, status } = request.body as any;

    if (!email || !password || !firstName || !lastName || !roleId) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(400).send({ error: "Email already exists" });
    }

    const hashed = hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        firstName,
        lastName,
        roleId,
        status: status || "ACTIVE",
        tenantId: request.user!.tenantId,
      },
      include: { role: true },
    });

    await logAudit({
      userId: request.user!.id,
      action: "CREATE_USER",
      entity: "User",
      entityId: newUser.id,
      newValue: { email, firstName, lastName, role: newUser.role.name },
      tenantId: request.user!.tenantId,
    });

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role.name,
      status: newUser.status,
    };
  });

  // Update User
  fastify.put("/users/:id", { preHandler: requirePermission("users:update") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { firstName, lastName, roleId, status, password } = request.body as any;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.status(444).send({ error: "User not found" });
    }

    // Safety checks: Cannot demote or disable the SuperAdmin if doing so from normal accounts
    if (targetUser.email === "superadmin@easypos.com" && request.user!.role !== "SUPERADMIN") {
      return reply.status(403).send({ error: "Forbidden: Only SuperAdmin can modify SuperAdmin account" });
    }

    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (roleId) updateData.roleId = roleId;
    if (status) updateData.status = status;
    if (password) updateData.passwordHash = hashPassword(password);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    await logAudit({
      userId: request.user!.id,
      action: "UPDATE_USER",
      entity: "User",
      entityId: id,
      oldValue: { firstName: targetUser.firstName, lastName: targetUser.lastName, roleId: targetUser.roleId, status: targetUser.status },
      newValue: { firstName: updated.firstName, lastName: updated.lastName, roleId: updated.roleId, status: updated.status },
      tenantId: request.user!.tenantId,
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role.name,
      status: updated.status,
    };
  });

  // Delete User
  fastify.delete("/users/:id", { preHandler: requirePermission("users:delete") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    if (targetUser.email === "superadmin@easypos.com") {
      return reply.status(400).send({ error: "Cannot delete the Super Administrator account" });
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      userId: request.user!.id,
      action: "DELETE_USER",
      entity: "User",
      entityId: id,
      oldValue: { email: targetUser.email, name: `${targetUser.firstName} ${targetUser.lastName}` },
      tenantId: request.user!.tenantId,
    });

    return { success: true };
  });

  // Get available Roles
  fastify.get("/roles", { preHandler: authenticate }, async (request) => {
    const roles = await prisma.role.findMany();
    return roles.map((r) => ({ id: r.id, name: r.name, description: r.description }));
  });
}
