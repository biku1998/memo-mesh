import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

function generateApiKey(): string {
  return `mm_${randomBytes(24).toString("hex")}`;
}

const logSecrets = process.env.SEED_LOG_SECRETS === "true";

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function main() {
  console.log("Seeding database...");

  const user = await prisma.user.upsert({
    where: { email: "test@memo-mesh.dev" },
    update: {},
    create: {
      email: "test@memo-mesh.dev",
      passwordHash: "placeholder-not-used-yet",
    },
  });

  console.log(`User: ${user.id} (${user.email})`);

  // Use env var if provided, otherwise generate a random key
  const apiKey = process.env.SEED_API_KEY || generateApiKey();

  // Look for existing project by user, or create one
  let project = await prisma.project.findFirst({
    where: { userId: user.id, name: "Test Project" },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        userId: user.id,
        name: "Test Project",
        apiKey,
        provider: "openai",
      },
    });
  }

  console.log(`Project: ${project.id} (${project.name})`);
  console.log("");
  console.log("Seed complete. Use these for testing:");
  console.log(`  Project ID: ${project.id}`);
  console.log(
    `  API Key:    ${logSecrets ? project.apiKey : mask(project.apiKey)}`,
  );

  if (!logSecrets) {
    console.log("  (Set SEED_LOG_SECRETS=true to show the full API key)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
