import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@maza/db/supabase/server";
import type { RoleName } from "@maza/db/types/database";

export type CurrentUser = {
  id: string;
  email: string | null;
  /**
   * Nome amigável exibido no shell (TopBar / Sidebar).
   *
   * Ordem de preferência ao resolver (em `getCurrentUser`):
   *   1) user_metadata.display_name
   *   2) user_metadata.full_name
   *   3) user_metadata.name
   *   4) null (UI faz fallback para o e-mail)
   *
   * Vem do painel Auth → Users (campo "Display name") ou do payload de
   * signUp com options.data. Não confundir com profiles.nome (que é
   * dado de RH).
   */
  displayName: string | null;
  roles: Array<{
    role: RoleName;
    unitId: string | null;
    brandId: string | null;
    groupId: string | null;
  }>;
};

/**
 * DAL — verifica sessão e carrega roles. `cache` memoiza durante uma render pass.
 * Server-only. Retorna null se sem sessão ou sem Supabase.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const cookieStore = await cookies();
    const supabase = await createSupabaseServerClient(cookieStore);
    if (!supabase) {
      console.warn("[getCurrentUser] supabase indisponível");
      return null;
    }

    // getSession() lê o JWT do cookie localmente (sem chamada de rede).
    // O middleware já validou o token com getUser() — aqui confiamos nele.
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError) {
      console.warn("[getCurrentUser] auth.getSession error:", authError.message);
      return null;
    }
    if (!session) return null;
    const user = session.user;

    // Pega roles do user. RLS permite SELECT do próprio user_roles.
    // Embedded select (roles!inner) não é tipado pelo nosso Database — cast explícito.
    type RoleJoinRow = {
      unit_id: string | null;
      brand_id: string | null;
      group_id: string | null;
      roles: { name: RoleName } | { name: RoleName }[] | null;
    };
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("unit_id, brand_id, group_id, roles!inner(name)")
      .eq("user_id", user.id)
      .returns<RoleJoinRow[]>();

    if (rolesError) {
      console.error("[getCurrentUser] roles query error:", rolesError.message);
      // Continua com roles vazias — não bloqueia o user.
    }

    const roles = (rolesData ?? []).map((r) => {
      const roleObj = Array.isArray(r.roles) ? r.roles[0] : r.roles;
      return {
        role: (roleObj?.name ?? "colaborador") as RoleName,
        unitId: r.unit_id,
        brandId: r.brand_id,
        groupId: r.group_id,
      };
    });

    // Resolve display_name do user_metadata (campo "Display name" no
    // painel Supabase Auth → Users). Ordem de preferência: display_name,
    // full_name, name. Suporta valores não-string defensivamente.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pickString = (v: unknown): string | null =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    const displayName =
      pickString(meta.display_name) ??
      pickString(meta.full_name) ??
      pickString(meta.name);

    return {
      id: user.id,
      email: user.email ?? null,
      displayName,
      roles,
    };
  } catch (e) {
    // Next.js usa exceptions especiais (NEXT_REDIRECT, NEXT_DYNAMIC_USAGE) pra
    // controle de fluxo. NUNCA engolir — deixa Next tratar.
    if (isNextInternal(e)) throw e;
    console.error("[getCurrentUser] exceção:", e);
    return null;
  }
});

function isNextInternal(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest === "string") {
    return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("DYNAMIC_SERVER_USAGE");
  }
  const message = (e as { message?: unknown }).message;
  return typeof message === "string" && message.includes("Dynamic server usage");
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect("/login");
}

/** Falha se o user não tiver pelo menos uma das roles especificadas. */
export async function requireRole(allowed: ReadonlyArray<RoleName>): Promise<CurrentUser> {
  const user = await requireUser();
  const has = user.roles.some((r) => allowed.includes(r.role));
  if (!has) redirect("/");
  return user;
}

/** Conveniência: o user é founder? */
export function isFounder(user: CurrentUser | null): boolean {
  return !!user?.roles.some((r) => r.role === "founder");
}
