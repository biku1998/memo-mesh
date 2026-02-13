import Fastify from "fastify";
import { messageRoutes } from "./routes/messages.js";

const fastify = Fastify({
  logger: true,
});

fastify.get("/health", () => {
  return { status: "ok" };
});

fastify.register(messageRoutes, { prefix: "/v1/projects/:projectId" });

// Parse and validate PORT environment variable
const portEnv = process.env.PORT;
const defaultPort = 3000;

let port: number;

if (!portEnv || portEnv.trim() === "") {
  port = defaultPort;
} else {
  const portCandidate = Number(portEnv);

  if (
    !Number.isInteger(portCandidate) ||
    portCandidate < 1 ||
    portCandidate > 65535
  ) {
    fastify.log.error(
      `Invalid PORT value: "${portEnv}". Must be an integer between 1 and 65535.`,
    );
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
