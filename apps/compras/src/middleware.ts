import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@kph/db/supabase/proxy";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  if (user) return response;

  const shellUrl = process.env.NEXT_PUBLIC_SHELL_URL ?? "http://localhost:3000";
  const login = new URL("/login", shellUrl);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login, 302);
}

export const config = { matcher: ["/compras/:path*"] };
