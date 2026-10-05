import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET ?? ""}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-lorean-emails`;

  const response = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[cron/lorean-import] edge function error:", result);
    return NextResponse.json(result, { status: 502 });
  }

  console.log("[cron/lorean-import] done:", result);
  return NextResponse.json(result);
}
