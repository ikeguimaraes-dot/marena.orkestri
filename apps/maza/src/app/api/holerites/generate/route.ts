// Wrapper HTTP pra geração em massa: resolve a unit do cookie e chama a
// Server Action `generatePayslipsForUnit`. Existe porque botões client não
// têm acesso direto ao cookie da unit selecionada.

import { NextResponse } from "next/server";

import { generatePayslipsForUnit } from "@/lib/pessoas/actions";
import { requireUser } from "@maza/auth/server";
import { getCurrentUnit } from "@maza/auth/unit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // middleware já validou sessão; defense in depth.
  await requireUser();

  const unit = await getCurrentUnit();
  if (!unit) {
    return NextResponse.json(
      { ok: false, error: "Sem unidade selecionada" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body inválido" },
      { status: 400 },
    );
  }

  const { mes, ano } = body as { mes?: unknown; ano?: unknown };
  const mesN = Number(mes);
  const anoN = Number(ano);
  if (!Number.isInteger(mesN) || mesN < 1 || mesN > 12) {
    return NextResponse.json(
      { ok: false, error: "mes deve ser 1-12" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(anoN) || anoN < 2020 || anoN > 2100) {
    return NextResponse.json(
      { ok: false, error: "ano fora do intervalo" },
      { status: 400 },
    );
  }

  const res = await generatePayslipsForUnit(unit.id, mesN, anoN);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    count: res.data.count,
    failures: res.data.failures,
  });
}
