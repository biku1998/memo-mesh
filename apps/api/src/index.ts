import Fastify from "fastify";

const fastify = Fastify({
  logger: true
});

fastify.get("/health", () => {
  return { status: "ok" };
});

// Parse and validate PORT environment variable
const portEnv = process.env.PORT;
const defaultPort = 3000;

let port: number;

if (!portEnv || portEnv.trim() === "") {
  // Missing or empty: use default
  port = defaultPort;
} else {
  const portCandidate = Number(portEnv);
  
  // Validate: must be integer and within valid port range (1-65535)
  if (
    !Number.isInteger(portCandidate) ||
    portCandidate < 1 ||
    portCandidate > 65535
  ) {
    fastify.log.error(
      `Invalid PORT value: "${portEnv}". Must be an integer between 1 and 65535.`
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

