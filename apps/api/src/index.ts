import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyCors from "@fastify/cors";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { messageRoutes } from "./routes/messages.js";
import { searchRoutes } from "./routes/search.js";
import { graphRoutes } from "./routes/graph.js";
import { memoryRoutes } from "./routes/memories.js";
import { requireApiKey } from "./middleware/apiKey.js";

const fastify = Fastify({ logger: true });

// --- CORS ---
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
await fastify.register(fastifyCors, {
  origin: webOrigin,
  credentials: true,
});

// --- Cookie + Session ---
await fastify.register(fastifyCookie);

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  fastify.log.error("SESSION_SECRET env var is required in production");
  process.exit(1);
}

await fastify.register(fastifySession, {
  secret: sessionSecret ?? "memo-mesh-dev-secret-change-in-production",
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

// --- Health ---
fastify.get("/health", () => ({ status: "ok" }));

// --- Auth + Project routes (no API key required) ---
fastify.register(authRoutes);
fastify.register(projectRoutes);

// --- Core routes (require X-API-Key) ---
const API_PREFIX = "/v1/projects/:projectId";

fastify.register(
  async (scoped) => {
    scoped.addHook("preHandler", requireApiKey);
    scoped.register(messageRoutes, { prefix: API_PREFIX });
    scoped.register(searchRoutes, { prefix: API_PREFIX });
    scoped.register(graphRoutes, { prefix: API_PREFIX });
    scoped.register(memoryRoutes, { prefix: API_PREFIX });
  },
);

// --- Parse and validate PORT ---
const portEnv = process.env.PORT;
const defaultPort = 3000;
let port: number;

if (!portEnv || portEnv.trim() === "") {
  port = defaultPort;
} else {
  const portCandidate = Number(portEnv);
  if (!Number.isInteger(portCandidate) || portCandidate < 1 || portCandidate > 65535) {
    fastify.log.error(`Invalid PORT value: "${portEnv}". Must be an integer between 1 and 65535.`);
    process.exit(1);
  }
  port = portCandidate;
}

fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    fastify.log.info(`API listening on port ${port}`);
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
