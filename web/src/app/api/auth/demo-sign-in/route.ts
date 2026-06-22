import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "@/lib/auth";

/**
 * Demo placeholder sign-in (Ticket 1). Sets a non-secure session cookie and
 * redirects. NOT real authentication — see src/lib/auth.ts.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const redirectTo =
    (formData?.get("redirect") as string | null) ?? "/dashboard";

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Deliberately short-lived; this is a dev placeholder only.
    maxAge: 60 * 60,
  });
  return response;
}
