import { NextResponse } from "next/server";
import { NAV_CONFIG, NAV_VERSAO } from "@/lib/nav-config";

export const dynamic = "force-static";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  return NextResponse.json(
    {
      versao: NAV_VERSAO,
      shellUrl: process.env.NEXT_PUBLIC_SHELL_URL ?? null,
      groups: NAV_CONFIG,
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
