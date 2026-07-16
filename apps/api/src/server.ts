import * as dotenv from "dotenv";
import { buildApp } from "./app";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8085", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Fastify API Server running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
