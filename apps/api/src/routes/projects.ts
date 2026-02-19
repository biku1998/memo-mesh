import { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { prisma } from "@memo-mesh/db";
import { CreateProjectBody } from "@memo-mesh/shared";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/projects — create a new project (requires session)
  fastify.post("/v1/projects", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsed = CreateProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { name, provider } = parsed.data;

    const apiKey = `mm_${crypto.randomBytes(24).toString("hex")}`;

    const project = await prisma.project.create({
      data: { userId, name, provider, apiKey },
    });

    return reply.status(201).send({
      id: project.id,
      name: project.name,
      provider: project.provider,
      apiKey: project.apiKey,
      createdAt: project.createdAt.toISOString(),
    });
  });

  // GET /v1/projects — list projects belonging to the authenticated user
  fastify.get("/v1/projects", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, provider: true, apiKey: true, createdAt: true },
    });

    return reply.send(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        apiKey: p.apiKey,
        createdAt: p.createdAt.toISOString(),
      })),
    );
  });
};
