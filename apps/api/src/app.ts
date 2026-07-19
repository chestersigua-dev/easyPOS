import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";

import { authRoutes } from "./routes/auth";
import { productRoutes } from "./routes/products";
import { customerRoutes } from "./routes/customers";
import { supplierRoutes } from "./routes/suppliers";
import { saleRoutes } from "./routes/sales";
import { repairRoutes } from "./routes/repairs";
import { accountingRoutes } from "./routes/accounting";
import { systemRoutes } from "./routes/system";
import { storeRoutes } from "./routes/stores";
import { transferRoutes } from "./routes/transfers";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

  // Register Security Plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "easypos-cookie-secret-999333",
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    reply.status(statusCode).send({
      error: isClientError ? error.message : "Internal Server Error",
    });
  });

  // Register API Routes
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(productRoutes, { prefix: "/api/v1/products" });
  app.register(customerRoutes, { prefix: "/api/v1/customers" });
  app.register(supplierRoutes, { prefix: "/api/v1/suppliers" });
  app.register(saleRoutes, { prefix: "/api/v1/sales" });
  app.register(repairRoutes, { prefix: "/api/v1/repairs" });
  app.register(accountingRoutes, { prefix: "/api/v1/accounting" });
  app.register(systemRoutes, { prefix: "/api/v1/system" });
  app.register(storeRoutes, { prefix: "/api/v1/stores" });
  app.register(transferRoutes, { prefix: "/api/v1/transfers" });

  // Simple Health Check
  app.get("/health", async () => {
    return { status: "OK", timestamp: new Date() };
  });

  return app;
}
