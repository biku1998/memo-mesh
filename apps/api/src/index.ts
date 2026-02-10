import Fastify from "fastify";

const fastify = Fastify({
  logger: true
});

fastify.get("/health", async () => {
  return { status: "ok" };
});

const port = Number(process.env.PORT ?? 3000);

fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    fastify.log.info(`API listening on port ${port}`);
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });

