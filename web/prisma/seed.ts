/**
 * EvalForge / TutorBench Local — seed script (Ticket 1).
 *
 * Creates ONE synthetic demo project with placeholder benchmark tasks and
 * model runs so the app shell has something to look at during development.
 *
 * IMPORTANT: every value here is SYNTHETIC demo data. It is not a real model
 * run, not a real measurement, and not imported from any real artifact. No
 * metrics here should be treated as evidence. Real data only ever enters the
 * system through validated artifact import (not implemented yet).
 *
 * Run with: npm run db:seed  (requires a configured DATABASE_URL)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User (synthetic)",
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Demo evaluation project (synthetic)",
      description:
        "Synthetic demo data for local development only. Not a real evaluation.",
      ownerId: demoUser.id,
      tasks: {
        create: [
          {
            taskKey: "python-factorial-debug",
            prompt: "Find the bug in this Python factorial function (demo).",
            language: "python",
            expectedFixHint: "if n == 0: return 1",
          },
          {
            taskKey: "cpp-vector-bounds-debug",
            prompt: "Find the undefined behavior in this C++ loop (demo).",
            language: "cpp",
            expectedFixHint: "for (std::size_t i = 0; i < values.size(); ++i)",
          },
        ],
      },
    },
    include: { tasks: true },
  });

  // A synthetic placeholder artifact + runs. rawJson is a stub, NOT a real
  // imported artifact. Metrics are illustrative placeholders only.
  const artifact = await prisma.artifact.create({
    data: {
      projectId: project.id,
      variant: "baseline",
      modelSha256: null,
      status: "imported",
      rawJson: {
        note: "SYNTHETIC demo stub — not a real benchmark artifact.",
      },
      modelRuns: {
        create: project.tasks.map((task) => ({
          taskId: task.id,
          promptId: task.taskKey,
          ok: true,
          elapsedSeconds: null, // unavailable in demo, never faked as 0
          tokensPerSecond: null,
          cleanOutputPreview: "Synthetic placeholder answer (demo only).",
        })),
      },
    },
  });

  console.log("Seed complete (SYNTHETIC demo data).");
  console.log(`  user:     ${demoUser.email}`);
  console.log(`  project:  ${project.name} (${project.id})`);
  console.log(`  tasks:    ${project.tasks.length}`);
  console.log(`  artifact: ${artifact.id} (variant=${artifact.variant})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
