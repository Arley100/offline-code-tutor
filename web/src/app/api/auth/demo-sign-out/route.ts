import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";

/** Demo placeholder sign-out (Ticket 1): clears the session cookie. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(DEMO_SESSION_COOKIE);
  return response;
}
