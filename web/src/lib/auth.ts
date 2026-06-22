/**
 * Demo placeholder authentication (Ticket 1 only).
 *
 * This is intentionally minimal: a single non-secure cookie that exists only to
 * exercise route protection while the foundation is built. It is NOT real
 * authentication — there is no password, no session store, no CSRF protection.
 * Ticket 4 / future work will replace this with Auth.js / NextAuth backed by the
 * Prisma `User` model. Do not use this for anything real.
 */
import { cookies } from "next/headers";

export const DEMO_SESSION_COOKIE =
  process.env.DEMO_SESSION_COOKIE ?? "evalforge_demo_session";

export const DEMO_SESSION_VALUE = "demo";

/** Server-side check used by protected pages. */
export async function isDemoAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}
