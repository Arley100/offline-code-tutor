import { NextResponse, type NextRequest } from "next/server";

// Demo placeholder route protection (Ticket 1). Mirrors src/lib/auth.ts but is
// inlined because middleware runs in the edge runtime and cannot import
// next/headers. Replace with Auth.js middleware in future work.
const DEMO_SESSION_COOKIE =
  process.env.DEMO_SESSION_COOKIE ?? "evalforge_demo_session";
const DEMO_SESSION_VALUE = "demo";

const PROTECTED_PREFIXES = ["/dashboard", "/projects"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const session = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (session === DEMO_SESSION_VALUE) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*"],
};
