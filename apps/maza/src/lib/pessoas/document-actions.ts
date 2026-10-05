"use server";

import { createSupabaseServerClient, createServiceClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import type {
  EmployeeDocument,
  EmployeeDocumentWithEmployee,
  EmployeeDocumentTipo,
} from "@maza/db/types/pessoas";

const BUCKET = "employee-documents";
const TABLE = "employee_documents";

async function ensureBucket(): Promise<void> {
  const service = createServiceClient();
  if (!service) return;
  const { error } = await service.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10485760,
  });
  // Ignore "already exists" — bucket was already created, which is fine.
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Storage bucket error: ${error.message}`);
  }
}

async function unitIdsForBrand(brandId: string): Promise<string[]> {
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service.from("units").select("id").eq("brand_id", brandId);
  return (data ?? []).map((u: { id: string }) => u.id);
}

// ── List ──────────────────────────────────────────────────────────

export type DocFilters = {
  brandId?: string;
  employeeId?: string;
  tipo?: EmployeeDocumentTipo | "";
  status?: "todos" | "vencidos" | "vencendo_30d" | "validos";
};

export async function listDocuments(
  filters: DocFilters = {},
): Promise<EmployeeDocumentWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let empIds: string[] | null = null;

    if (filters.brandId) {
      const unitIds = await unitIdsForBrand(filters.brandId);
      if (unitIds.length === 0) return [];
      const { data: emps } = await supabase
        .from("employees")
        .select("id")
        .in("unit_id", unitIds);
      empIds = (emps ?? []).map((e: { id: string }) => e.id);
      if (empIds.length === 0) return [];
    }

    if (filters.employeeId) {
      empIds = [filters.employeeId];
    }

    let query = supabase
      .from(TABLE)
      .select("*, employee:employees(id, nome, sobrenome, funcao, unit_id)")
      .order("data_validade", { ascending: true, nullsFirst: false });

    if (empIds) {
      query = query.in("employee_id", empIds);
    }

    if (filters.tipo) {
      query = query.eq("tipo", filters.tipo);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);

    let docs = data as EmployeeDocumentWithEmployee[];

    if (filters.status && filters.status !== "todos") {
      docs = docs.filter((d) => {
        const v = d.data_validade;
        if (filters.status === "vencidos") return v != null && v < todayStr;
        if (filters.status === "vencendo_30d")
          return v != null && v >= todayStr && v <= in30Str;
        if (filters.status === "validos") return v == null || v > in30Str;
        return true;
      });
    }

    return docs;
  } catch {
    return [];
  }
}

// ── Stats ─────────────────────────────────────────────────────────

export async function getDocumentStats(brandId?: string): Promise<{
  total: number;
  vencidos: number;
  vencendo_30d: number;
  sem_validade: number;
}> {
  const fallback = { total: 0, vencidos: 0, vencendo_30d: 0, sem_validade: 0 };
  try {
    const all = await listDocuments({ brandId });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);

    return {
      total: all.length,
      vencidos: all.filter((d) => d.data_validade != null && d.data_validade < todayStr).length,
      vencendo_30d: all.filter(
        (d) => d.data_validade != null && d.data_validade >= todayStr && d.data_validade <= in30Str,
      ).length,
      sem_validade: all.filter((d) => d.data_validade == null).length,
    };
  } catch {
    return fallback;
  }
}

// ── Upload ────────────────────────────────────────────────────────

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<EmployeeDocument>> {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const service = createServiceClient();
    if (!supabase || !service) return { ok: false, error: "Serviço indisponível" };

    await ensureBucket();

    const employeeId = formData.get("employeeId") as string;
    const tipo = formData.get("tipo") as EmployeeDocumentTipo;
    const nome = formData.get("nome") as string;
    const descricao = (formData.get("descricao") as string) || null;
    const dataEmissao = (formData.get("dataEmissao") as string) || null;
    const dataValidade = (formData.get("dataValidade") as string) || null;
    const observacoes = (formData.get("observacoes") as string) || null;
    const file = formData.get("file") as File | null;

    if (!employeeId || !tipo || !nome.trim()) {
      return { ok: false, error: "Campos obrigatórios ausentes" };
    }

    let filePath = "";
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    if (file && file.size > 0) {
      if (file.size > 10485760) return { ok: false, error: "Arquivo maior que 10 MB" };
      const ext = file.name.split(".").pop() ?? "bin";
      const uuid = crypto.randomUUID();
      filePath = `${employeeId}/${uuid}.${ext}`;
      fileSize = file.size;
      mimeType = file.type;

      const buf = await file.arrayBuffer();
      const { error: uploadErr } = await service.storage
        .from(BUCKET)
        .upload(filePath, buf, { contentType: file.type, upsert: false });

      if (uploadErr) return { ok: false, error: uploadErr.message };
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        employee_id: employeeId,
        tipo,
        nome: nome.trim(),
        descricao,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        data_emissao: dataEmissao || null,
        data_validade: dataValidade || null,
        observacoes,
        uploaded_by: user.id === "bypass" ? null : user.id,
      } as never)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as EmployeeDocument };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Signed URL ────────────────────────────────────────────────────

export async function getDocumentSignedUrl(
  documentId: string,
): Promise<ActionResult<string>> {
  try {
    const supabase = await createSupabaseServerClient();
    const service = createServiceClient();
    if (!supabase || !service) return { ok: false, error: "Serviço indisponível" };

    const { data: doc, error: dbErr } = await supabase
      .from(TABLE)
      .select("file_path")
      .eq("id", documentId)
      .single();

    if (dbErr || !doc) return { ok: false, error: "Documento não encontrado" };

    const path = (doc as unknown as { file_path: string }).file_path;
    if (!path) return { ok: false, error: "Arquivo não anexado" };

    const { data, error } = await service.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return { ok: false, error: error?.message ?? "Erro ao gerar URL" };
    return { ok: true, data: data.signedUrl };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Delete ────────────────────────────────────────────────────────

export async function deleteDocument(documentId: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const service = createServiceClient();
    if (!supabase || !service) return { ok: false, error: "Serviço indisponível" };

    const { data: doc } = await supabase
      .from(TABLE)
      .select("file_path")
      .eq("id", documentId)
      .single();

    const path = (doc as unknown as { file_path: string } | null)?.file_path;
    if (path) {
      await service.storage.from(BUCKET).remove([path]);
    }

    const { error } = await supabase.from(TABLE).delete().eq("id", documentId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Update ────────────────────────────────────────────────────────

export async function updateDocument(
  id: string,
  patch: {
    nome?: string;
    descricao?: string | null;
    data_emissao?: string | null;
    data_validade?: string | null;
    observacoes?: string | null;
  },
): Promise<ActionResult<EmployeeDocument>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Serviço indisponível" };

    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as EmployeeDocument };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Employees for select ──────────────────────────────────────────

export async function listEmployeesForSelect(
  brandId?: string,
): Promise<Array<{ id: string; nome: string; sobrenome: string; funcao: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao, unit_id")
      .eq("ativo", true)
      .order("nome");

    if (brandId) {
      const unitIds = await unitIdsForBrand(brandId);
      if (unitIds.length === 0) return [];
      query = query.in("unit_id", unitIds);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as any[]).map((e) => ({
      id: e.id as string,
      nome: e.nome as string,
      sobrenome: e.sobrenome as string,
      funcao: e.funcao as string,
    }));
  } catch {
    return [];
  }
}
