// PDF do holerite — gerado on-demand. RLS aplica via Supabase server client,
// então só quem tem role na unit do employee consegue baixar.

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import { PayslipPdf } from "@/components/pessoas/PayslipPdf";
import type { Employee, Payslip } from "@maza/db/types/pessoas";

// Garante runtime Node (não Edge) — @react-pdf/renderer precisa de Node APIs.
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;

  // middleware já validou sessão; defense in depth.
  const user = await requireUser();

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase indisponível" }, { status: 503 });
  }

  // Busca holerite + employee + unit + brand. RLS bloqueia se sem acesso.
  const { data: payslipRow, error: payslipErr } = await supabase
    .from("payslips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (payslipErr) {
    console.error("[pdf] payslip query error:", payslipErr.message);
    return NextResponse.json({ error: payslipErr.message }, { status: 500 });
  }
  if (!payslipRow) {
    return NextResponse.json({ error: "Holerite não encontrado" }, { status: 404 });
  }
  const payslip = payslipRow as Payslip;

  const { data: empRow, error: empErr } = await supabase
    .from("employees")
    .select("id, nome, sobrenome, funcao, cpf, unit_id")
    .eq("id", payslip.employee_id)
    .maybeSingle();
  if (empErr || !empRow) {
    return NextResponse.json(
      { error: empErr?.message ?? "Colaborador não encontrado" },
      { status: 500 },
    );
  }
  const employee = empRow as Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "cpf" | "unit_id">;

  const { data: unitRow } = await supabase
    .from("units")
    .select("id, name, brand_id")
    .eq("id", employee.unit_id)
    .maybeSingle();

  let brandName: string | null = null;
  const unitName = (unitRow as { name?: string } | null)?.name ?? "Unidade";
  const brandId = (unitRow as { brand_id?: string | null } | null)?.brand_id;
  if (brandId) {
    const { data: brandRow } = await supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .maybeSingle();
    brandName = (brandRow as { name?: string } | null)?.name ?? null;
  }

  const fullName = `${employee.nome} ${employee.sobrenome}`.trim();

  const buffer = await renderToBuffer(
    <PayslipPdf
      payslip={payslip}
      employeeName={fullName}
      employeeFuncao={employee.funcao}
      employeeCpf={employee.cpf}
      unitName={unitName}
      brandName={brandName}
    />,
  );

  const filename = `holerite-${slugify(fullName)}-${payslip.competencia.slice(0, 7)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
