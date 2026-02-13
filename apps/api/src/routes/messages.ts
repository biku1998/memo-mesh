import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@memo-mesh/db";
import { CreateMessageBody } from "@memo-mesh/shared";

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/messages", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    // Validate body
    const parsed = CreateMessageBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { role, content } = parsed.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Store message
    const message = await prisma.message.create({
      data: {
        projectId,
        role,
        content,
      },
    });

    // Create raw memory linked to the message
    await prisma.memory.create({
      data: {
        projectId,
        type: "raw",
        text: content,
        sourceMessageId: message.id,
      },
    });

    return reply.status(201).send({ messageId: message.id });
  });
};
