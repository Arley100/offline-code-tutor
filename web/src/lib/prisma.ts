/**
 * Prisma client singleton. Not used by any page yet (no artifact import in this
 * foundation), but provided so future tickets have a single shared client and
 * avoid exhausting connections during development hot-reloads.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
