import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword, generateAccessToken, verifyAccessToken } from "./index";

describe("Authentication Utilities", () => {
  it("hashes password and verifies matching password", () => {
    const raw = "SuperSecretPassword123";
    const hash = hashPassword(raw);
    expect(hash).not.toBe(raw);
    expect(comparePassword(raw, hash)).toBe(true);
    expect(comparePassword("WrongPassword", hash)).toBe(false);
  });

  it("signs and verifies JWT access tokens", () => {
    const payload = {
      userId: "user-uuid-111",
      tenantId: "tenant-uuid-222",
      role: "SALES",
    };

    const token = generateAccessToken(payload);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.role).toBe(payload.role);
  });
});
