import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create test user (password doesn't matter for core pipeline dev)
  const user = await prisma.user.upsert({
    where: { email: "test@memo-mesh.dev" },
    update: {},
    create: {
      email: "test@memo-mesh.dev",
      passwordHash: "placeholder-not-used-yet",
    },
  });

  console.log(`User: ${user.id} (${user.email})`);

  // Create test project with a known API key
  const project = await prisma.project.upsert({
    where: { apiKey: "mm_test_seed_key" },
    update: {},
    create: {
      userId: user.id,
      name: "Test Project",
      apiKey: "mm_test_seed_key",
      provider: "openai",
    },
  });

  console.log(`Project: ${project.id} (${project.name})`);
  console.log(`API Key: ${project.apiKey}`);
  console.log("");
  console.log("Seed complete. Use these for testing:");
  console.log(`  Project ID: ${project.id}`);
  console.log(`  API Key:    ${project.apiKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
