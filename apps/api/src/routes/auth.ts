import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@memo-mesh/db";
import { RegisterBody, LoginBody } from "@memo-mesh/shared";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/register
  fastify.post("/v1/auth/register", async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    request.session.userId = user.id;
    return reply.status(201).send({ id: user.id, email: user.email, createdAt: user.createdAt.toISOString() });
  });

  // POST /v1/auth/login
  fastify.post("/v1/auth/login", async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    request.session.userId = user.id;
    return reply.send({ id: user.id, email: user.email, createdAt: user.createdAt.toISOString() });
  });

  // POST /v1/auth/logout
  fastify.post("/v1/auth/logout", async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  // GET /v1/auth/me
  fastify.get("/v1/auth/me", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await request.session.destroy();
      return reply.status(401).send({ error: "Not authenticated" });
    }

    return reply.send({ id: user.id, email: user.email, createdAt: user.createdAt.toISOString() });
  });
};
