/**
 * EvalForge / TutorBench Local — seed script.
 *
 * Creates ONE synthetic demo project with placeholder benchmark tasks and
 * model runs so the app shell has something to look at during development.
 *
 * IDEMPOTENT: the demo project, tasks, and seed artifact have stable ids/keys,
 * so re-running `npm run db:seed` updates/resets the same demo data instead of
 * creating duplicate demo projects. It only ever touches the seed-owned rows;
 * user-created projects and user-imported artifacts are left untouched.
 *
 * IMPORTANT: every value here is SYNTHETIC demo data. It is not a real model
 * run, not a real measurement, and not imported from any real artifact. No
 * metrics here should be treated as evidence. Real data only ever enters the
 * system through validated artifact import.
 *
 * Run with: npm run db:seed  (requires a configured DATABASE_URL)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Stable ids so repeated seeding upserts the same rows.
const DEMO_PROJECT_ID = "seed-demo-project";
const DEMO_ARTIFACT_ID = "seed-demo-artifact";
const DEMO_PROJECT_NAME = "Demo evaluation project (synthetic)";
const DEMO_PROJECT_DESCRIPTION =
  "Synthetic demo data for local development only. Not a real evaluation.";

const DEMO_TASKS = [
  {
    taskKey: "python-factorial-debug",
    title: "Python factorial base case (demo)",
    prompt: "Find the bug in this Python factorial function (demo).",
    language: "python",
    difficulty: "easy",
    category: "logic-error",
    expectedFixHint: "if n == 0: return 1",
    notes: "Synthetic demo task.",
  },
  {
    taskKey: "cpp-vector-bounds-debug",
    title: "C++ vector out-of-bounds loop (demo)",
    prompt: "Find the undefined behavior in this C++ loop (demo).",
    language: "cpp",
    difficulty: "medium",
    category: "off-by-one",
    expectedFixHint: "for (std::size_t i = 0; i < values.size(); ++i)",
    notes: "Synthetic demo task.",
  },
];

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User (synthetic)",
    },
  });

  const project = await prisma.project.upsert({
    where: { id: DEMO_PROJECT_ID },
    update: {
      name: DEMO_PROJECT_NAME,
      description: DEMO_PROJECT_DESCRIPTION,
      ownerId: demoUser.id,
    },
    create: {
      id: DEMO_PROJECT_ID,
      name: DEMO_PROJECT_NAME,
      description: DEMO_PROJECT_DESCRIPTION,
      ownerId: demoUser.id,
    },
  });

  // Clean up legacy duplicate seed projects created before this script was
  // idempotent: same synthetic name + demo owner, but not the stable id. This
  // only matches the seed's own name, so user-created projects are never removed.
  const removedLegacy = await prisma.project.deleteMany({
    where: {
      ownerId: demoUser.id,
      name: DEMO_PROJECT_NAME,
      id: { not: DEMO_PROJECT_ID },
    },
  });

  // Upsert tasks by their stable (projectId, taskKey) compound unique so keys
  // stay stable for artifact matching across re-seeds.
  const tasks = [];
  for (const task of DEMO_TASKS) {
    const upserted = await prisma.benchmarkTask.upsert({
      where: {
        projectId_taskKey: { projectId: project.id, taskKey: task.taskKey },
      },
      update: task,
      create: { ...task, projectId: project.id },
    });
    tasks.push(upserted);
  }

  // Reset the single synthetic seed artifact by its stable id (cascades to its
  // runs). This does NOT touch any artifacts a user imported into the project.
  await prisma.artifact.deleteMany({ where: { id: DEMO_ARTIFACT_ID } });
  const artifact = await prisma.artifact.create({
    data: {
      id: DEMO_ARTIFACT_ID,
      projectId: project.id,
      variant: "baseline",
      modelSha256: null,
      benchmarkStatus: "completed",
      sourceCreatedAtUtc: null,
      contentHash: null,
      status: "imported",
      rawJson: {
        note: "SYNTHETIC demo stub — not a real benchmark artifact.",
      },
      modelRuns: {
        create: tasks.map((task) => ({
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

  console.log("Seed complete (SYNTHETIC demo data, idempotent).");
  console.log(`  user:           ${demoUser.email}`);
  console.log(`  project:        ${project.name} (${project.id})`);
  console.log(`  tasks:          ${tasks.length}`);
  console.log(`  artifact:       ${artifact.id} (variant=${artifact.variant})`);
  console.log(`  legacy removed: ${removedLegacy.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
