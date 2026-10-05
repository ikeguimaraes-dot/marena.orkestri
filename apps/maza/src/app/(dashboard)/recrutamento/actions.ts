"use server";

// Server Actions do módulo Recrutamento.
//
// Padrão Marena: ActionResult<T> + cookie SSR. Service_role só na ação que
// candidato (sem auth) chama no app mobile pra inserir interview_responses
// — essa não fica aqui, fica no app mobile + endpoint próprio.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient, createServiceClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  candidateSchema,
  interviewQuestionSchema,
  interviewQuestionUpdateSchema,
  jobOpeningSchema,
  type CandidateFormValues,
  type InterviewQuestionFormValues,
  type InterviewQuestionUpdateValues,
  type JobOpeningFormValues,
} from "@/lib/recrutamento/schema";
import type {
  Candidate,
  CandidateInterviewStatus,
  CandidateReviewBundle,
  CandidateStatus,
  CandidateUpdate,
  CandidateWithJob,
  InterviewQuestion,
  InterviewResponse,
  JobOpening,
  JobOpeningUpdate,
  JobOpeningWithCounts,
} from "@/lib/recrutamento/types";

const JOBS = "job_openings" as const;
const CANDIDATES = "candidates" as const;
const QUESTIONS = "interview_questions" as const;
const RESPONSES = "interview_responses" as const;
const VIDEOS_BUCKET = "interview-videos";
const SIGNED_URL_TTL = 60 * 60; // 1h

// Alfabeto sem caracteres confundíveis (sem 0/O, 1/I).
const ACCESS_CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAccessCode(): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += ACCESS_CODE_ALPHA.charAt(
      Math.floor(Math.random() * ACCESS_CODE_ALPHA.length),
    );
  }
  return `CAND-${suffix}`;
}

// ── Vagas ─────────────────────────────────────────────────────

export async function listJobOpenings(
  brandId?: string | null,
): Promise<JobOpeningWithCounts[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let q = supabase
      .from(JOBS)
      .select("*, brand:brands!inner(name, color)")
      .order("created_at", { ascending: false });
    if (brandId) q = q.eq("brand_id", brandId);

    type JoinRow = JobOpening & {
      brand: { name: string; color: string } | { name: string; color: string }[] | null;
    };
    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listJobOpenings]", error.message);
      return [];
    }

    // Counts em paralelo.
    const ids = (data ?? []).map((j) => j.id);
    if (ids.length === 0) return [];

    const { data: cands } = await supabase
      .from(CANDIDATES)
      .select("job_opening_id, status")
      .in("job_opening_id", ids)
      .returns<{ job_opening_id: string; status: CandidateStatus }[]>();

    const counts: Record<string, { total: number; pendentes: number }> = {};
    for (const c of cands ?? []) {
      const x = (counts[c.job_opening_id] ??= { total: 0, pendentes: 0 });
      x.total++;
      if (c.status === "pendente") x.pendentes++;
    }

    return (data ?? []).map((row) => {
      const brand = Array.isArray(row.brand) ? row.brand[0] : row.brand;
      const c = counts[row.id] ?? { total: 0, pendentes: 0 };
      return {
        ...row,
        brand_name: brand?.name ?? null,
        brand_color: brand?.color ?? null,
        total_candidatos: c.total,
        pendentes: c.pendentes,
      } as JobOpeningWithCounts;
    });
  } catch (e) {
    console.error("[listJobOpenings] exceção:", e);
    return [];
  }
}

export async function getJobOpening(id: string): Promise<JobOpening | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(JOBS)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getJobOpening]", error.message);
      return null;
    }
    return (data as JobOpening | null) ?? null;
  } catch (e) {
    console.error("[getJobOpening] exceção:", e);
    return null;
  }
}

export async function createJobOpening(
  input: JobOpeningFormValues,
): Promise<ActionResult<JobOpening>> {
  try {
    const parsed = jobOpeningSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = { ...parsed.data, created_by: user.id };
    const { data, error } = await supabase
      .from(JOBS)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/recrutamento/vagas");
    return { ok: true, data: data as JobOpening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateJobOpening(
  id: string,
  patch: JobOpeningUpdate,
): Promise<ActionResult<JobOpening>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(JOBS)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath("/recrutamento/vagas");
    revalidatePath(`/recrutamento/vagas/${id}`);
    return { ok: true, data: data as JobOpening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function toggleJobOpeningActive(
  id: string,
): Promise<ActionResult<JobOpening>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data: current } = await supabase
      .from(JOBS)
      .select("is_active")
      .eq("id", id)
      .maybeSingle<{ is_active: boolean }>();
    if (!current) return { ok: false, error: "Vaga não encontrada" };
    const { data, error } = await supabase
      .from(JOBS)
      .update({ is_active: !current.is_active } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath("/recrutamento/vagas");
    return { ok: true, data: data as JobOpening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Candidatos ────────────────────────────────────────────────

export async function listCandidatesForJob(
  jobOpeningId: string,
): Promise<Candidate[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(CANDIDATES)
      .select("*")
      .eq("job_opening_id", jobOpeningId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listCandidatesForJob]", error.message);
      return [];
    }
    return (data ?? []) as Candidate[];
  } catch (e) {
    console.error("[listCandidatesForJob] exceção:", e);
    return [];
  }
}

/**
 * Cria candidato + access_code automático único. Retry simples em caso de
 * collision (UNIQUE constraint) — até 5 tentativas.
 */
export async function createCandidate(
  input: CandidateFormValues,
): Promise<ActionResult<Candidate>> {
  try {
    const parsed = candidateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateAccessCode();
      const payload = {
        job_opening_id: parsed.data.job_opening_id,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        access_code: code,
      };
      const { data, error } = await supabase
        .from(CANDIDATES)
        .insert(payload as never)
        .select()
        .single();
      if (!error && data) {
        revalidatePath(`/recrutamento/vagas/${parsed.data.job_opening_id}`);
        return { ok: true, data: data as Candidate };
      }
      // Postgres unique violation = 23505. Retry só nesse caso.
      const code23505 = error && (error as { code?: string }).code === "23505";
      if (!code23505) {
        return { ok: false, error: error?.message ?? "Falha ao criar candidato" };
      }
    }
    return {
      ok: false,
      error: "Falha ao gerar access_code único após 5 tentativas",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateCandidate(
  id: string,
  patch: CandidateUpdate,
): Promise<ActionResult<Candidate>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(CANDIDATES)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as Candidate).job_opening_id) {
      revalidatePath(`/recrutamento/vagas/${(data as Candidate).job_opening_id}`);
    }
    revalidatePath(`/recrutamento/candidatos/${id}`);
    return { ok: true, data: data as Candidate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus,
): Promise<ActionResult<Candidate>> {
  return updateCandidate(id, { status });
}

export async function updateCandidateInterviewStatus(
  id: string,
  interview_status: CandidateInterviewStatus,
): Promise<ActionResult<Candidate>> {
  return updateCandidate(id, { interview_status });
}

// ── Perguntas ─────────────────────────────────────────────────

export async function listInterviewQuestions(
  jobOpeningId: string,
): Promise<InterviewQuestion[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(QUESTIONS)
      .select("*")
      .eq("job_opening_id", jobOpeningId)
      .order("order_num", { ascending: true });
    if (error) {
      console.error("[listInterviewQuestions]", error.message);
      return [];
    }
    return (data ?? []) as InterviewQuestion[];
  } catch (e) {
    console.error("[listInterviewQuestions] exceção:", e);
    return [];
  }
}

/**
 * Cria pergunta com order_num auto-incrementado (max+1 da vaga).
 */
export async function createInterviewQuestion(
  input: InterviewQuestionFormValues,
): Promise<ActionResult<InterviewQuestion>> {
  try {
    const parsed = interviewQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: maxRow } = await supabase
      .from(QUESTIONS)
      .select("order_num")
      .eq("job_opening_id", parsed.data.job_opening_id)
      .order("order_num", { ascending: false })
      .limit(1)
      .maybeSingle<{ order_num: number }>();
    const nextOrder = (maxRow?.order_num ?? 0) + 1;

    const payload = {
      job_opening_id: parsed.data.job_opening_id,
      question_text: parsed.data.question_text,
      video_url: parsed.data.video_url ?? null,
      order_num: nextOrder,
    };
    const { data, error } = await supabase
      .from(QUESTIONS)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath(`/recrutamento/vagas/${parsed.data.job_opening_id}`);
    return { ok: true, data: data as InterviewQuestion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateInterviewQuestion(
  id: string,
  patch: InterviewQuestionUpdateValues,
): Promise<ActionResult<InterviewQuestion>> {
  try {
    const parsed = interviewQuestionUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(QUESTIONS)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as InterviewQuestion).job_opening_id) {
      revalidatePath(
        `/recrutamento/vagas/${(data as InterviewQuestion).job_opening_id}`,
      );
    }
    return { ok: true, data: data as InterviewQuestion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteInterviewQuestion(
  id: string,
): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(QUESTIONS).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/recrutamento/vagas");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Bundle pra revisão ───────────────────────────────────────

/**
 * Server Component da página de revisão chama isso. Gera signed URLs
 * (1h TTL) pros vídeos no bucket interview-videos. Service role pra
 * `createSignedUrl` — mais robusto que confiar em RLS pra storage.
 */
export async function getCandidateWithResponses(
  candidateId: string,
): Promise<CandidateReviewBundle | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    type CandJoin = Candidate & {
      job: { title: string; brand: { name: string } | { name: string }[] | null } | null;
    };
    const { data: cand } = await supabase
      .from(CANDIDATES)
      .select("*, job:job_openings!inner(title, brand:brands!inner(name))")
      .eq("id", candidateId)
      .maybeSingle<CandJoin>();
    if (!cand) return null;

    const job = cand.job;
    const brand = job
      ? Array.isArray(job.brand)
        ? job.brand[0]
        : job.brand
      : null;

    const { data: questions } = await supabase
      .from(QUESTIONS)
      .select("*")
      .eq("job_opening_id", cand.job_opening_id)
      .order("order_num", { ascending: true })
      .returns<InterviewQuestion[]>();

    const { data: responses } = await supabase
      .from(RESPONSES)
      .select("*")
      .eq("candidate_id", candidateId)
      .returns<InterviewResponse[]>();

    const responsesByQ: Record<string, InterviewResponse> = {};
    for (const r of responses ?? []) {
      responsesByQ[r.question_id] = r;
    }

    // Signed URLs — usa service role pra evitar dependência de RLS.
    const service = createServiceClient();
    const signer = service ?? supabase;

    const enriched = await Promise.all(
      (questions ?? []).map(async (q) => {
        const questionVid = q.video_url
          ? await signer.storage
              .from(VIDEOS_BUCKET)
              .createSignedUrl(q.video_url, SIGNED_URL_TTL)
          : null;

        const resp = responsesByQ[q.id];
        const responseVid = resp
          ? await signer.storage
              .from(VIDEOS_BUCKET)
              .createSignedUrl(resp.video_url, SIGNED_URL_TTL)
          : null;

        return {
          ...q,
          question_video_signed_url: questionVid?.data?.signedUrl ?? null,
          response: resp
            ? {
                ...resp,
                response_video_signed_url:
                  responseVid?.data?.signedUrl ?? "",
              }
            : null,
        };
      }),
    );

    // Strip job from candidate (já capturamos brand/title)
    const { job: _job, ...candidateClean } = cand;
    void _job;
    return {
      candidate: candidateClean as Candidate,
      job_title: job?.title ?? null,
      brand_name: brand?.name ?? null,
      questions: enriched,
    };
  } catch (e) {
    console.error("[getCandidateWithResponses] exceção:", e);
    return null;
  }
}

// ── Listagem geral pra dashboard ─────────────────────────────

export async function listAllCandidates(): Promise<CandidateWithJob[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type Row = Candidate & {
      job: {
        title: string;
        brand: { name: string } | { name: string }[] | null;
      } | null;
    };
    const { data, error } = await supabase
      .from(CANDIDATES)
      .select("*, job:job_openings!inner(title, brand:brands!inner(name))")
      .order("created_at", { ascending: false })
      .returns<Row[]>();
    if (error) {
      console.error("[listAllCandidates]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const brand = r.job
        ? Array.isArray(r.job.brand)
          ? r.job.brand[0]
          : r.job.brand
        : null;
      return {
        ...r,
        job_title: r.job?.title ?? null,
        brand_name: brand?.name ?? null,
      } as CandidateWithJob;
    });
  } catch (e) {
    console.error("[listAllCandidates] exceção:", e);
    return [];
  }
}
