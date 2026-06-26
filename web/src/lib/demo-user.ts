/**
 * Resolves the current user for the demo placeholder auth.
 *
 * Ticket 2 has no real auth provider, so all data is owned by a single
 * upserted demo user. When real Auth.js lands (later ticket), this is the seam
 * to replace with the authenticated session user.
 */
import { prisma } from "@/lib/prisma";

export const DEMO_USER_EMAIL = "demo@example.com";

export async function getOrCreateDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo User (placeholder auth)" },
  });
}
