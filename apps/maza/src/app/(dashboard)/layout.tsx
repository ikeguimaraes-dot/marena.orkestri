import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { AuthProvider } from "@maza/auth/context";
import { requireUser } from "@maza/auth/server";
import { createServiceClient, createSupabaseServerClient } from "@maza/db/supabase/server";
import type { Unit } from "@maza/db/types/database";

// Layout chama cookies() via getCurrentUser — Next 16 não pode prerender estaticamente
// rotas que dependem de request. Toda página dentro do (dashboard) é dynamic.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // middleware já redirecionou anônimos — defense in depth: se chegou aqui,
  // exige user válido. Falha → redirect /login (exceção NEXT_REDIRECT).
  const user = await requireUser();

  const [units, hasRegisteredUnits] = await Promise.all([
    loadAccessibleUnits(),
    hasAnyActiveUnit(),
  ]);

  return (
    <AuthProvider user={user} units={units} hasRegisteredUnits={hasRegisteredUnits}>
      <div className="maza-workspace">
        <a className="maza-skip-link" href="#conteudo">Pular para o conteúdo</a>
        <Sidebar />
        <div className="maza-workspace-body">
          <TopBar />
          <main id="conteudo" tabIndex={-1} className="shell-main maza-page-main">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}

/** Consulta apenas a existência, sem expor dados que a RLS ocultou do usuário. */
async function hasAnyActiveUnit(): Promise<boolean> {
  const service = createServiceClient();
  if (!service) return false;

  const { count, error } = await service
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  if (error) {
    console.error("[hasAnyActiveUnit] query error:", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

async function loadAccessibleUnits(): Promise<Unit[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[loadAccessibleUnits] supabase indisponível");
      return [];
    }
    // RLS no servidor garante que só vem o que o user pode ver.
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) {
      console.error("[loadAccessibleUnits] query error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[loadAccessibleUnits] exceção:", e);
    return [];
  }
}
