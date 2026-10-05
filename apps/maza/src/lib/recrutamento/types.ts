// Tipos do módulo Recrutamento (HOS RH expansion).
//
// Schema em supabase migrations 011-018. As tabelas são:
//   job_openings          — vagas abertas
//   candidates            — candidato + access_code (sem auth.users)
//   interview_questions   — perguntas com vídeo opcional do RH
//   interview_responses   — vídeos das respostas dos candidatos
//
// Distinção crítica de status:
//   candidates.status            → decisão RH (pendente|aprovado|reprovado)
//   candidates.interview_status  → ciclo da entrevista no app mobile
//                                  (pendente|em_andamento|concluido)

export type CandidateStatus = "pendente" | "aprovado" | "reprovado";
export type CandidateInterviewStatus = "pendente" | "em_andamento" | "concluido";

// ── Vagas ─────────────────────────────────────────────────────

export type JobOpening = {
  id: string;
  brand_id: string;
  unit_id: string | null;
  title: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type JobOpeningInsert = {
  id?: string;
  brand_id: string;
  unit_id?: string | null;
  title: string;
  description?: string | null;
  is_active?: boolean;
  created_by?: string | null;
};

export type JobOpeningUpdate = Partial<Omit<JobOpeningInsert, "brand_id">>;

export type JobOpeningWithCounts = JobOpening & {
  brand_name: string | null;
  brand_color: string | null;
  total_candidatos: number;
  pendentes: number;
};

// ── Candidatos ────────────────────────────────────────────────

export type Candidate = {
  id: string;
  job_opening_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;             // padrão CAND-XXXX
  status: CandidateStatus;         // decisão RH
  interview_status: CandidateInterviewStatus; // ciclo do app
  created_at: string;
};

export type CandidateInsert = {
  id?: string;
  job_opening_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  access_code: string;
  status?: CandidateStatus;
  interview_status?: CandidateInterviewStatus;
};

export type CandidateUpdate = Partial<Omit<CandidateInsert, "job_opening_id" | "access_code">>;

export type CandidateWithJob = Candidate & {
  job_title: string | null;
  brand_name: string | null;
};

// ── Perguntas + respostas ────────────────────────────────────

export type InterviewQuestion = {
  id: string;
  job_opening_id: string;
  order_num: number;
  question_text: string;
  video_url: string | null;        // path no bucket interview-videos (signed URL no SC)
  created_at: string;
};

export type InterviewQuestionInsert = {
  id?: string;
  job_opening_id: string;
  order_num: number;
  question_text: string;
  video_url?: string | null;
};

export type InterviewQuestionUpdate = Partial<
  Omit<InterviewQuestionInsert, "job_opening_id">
>;

export type InterviewResponse = {
  id: string;
  candidate_id: string;
  question_id: string;
  video_url: string;               // path obrigatório
  created_at: string;
};

export type InterviewResponseInsert = {
  id?: string;
  candidate_id: string;
  question_id: string;
  video_url: string;
};

// ── Bundle pra revisão lado-a-lado ──────────────────────────

/**
 * O Server Component da revisão de candidato:
 *   1) busca candidate
 *   2) busca questions ordenadas
 *   3) busca responses do candidato
 *   4) gera signed URL (1h TTL) pra cada video_url (question + response)
 *   5) retorna esse bundle pro client renderizar
 */
export type CandidateReviewBundle = {
  candidate: Candidate;
  job_title: string | null;
  brand_name: string | null;
  questions: Array<
    InterviewQuestion & {
      question_video_signed_url: string | null;
      response: (InterviewResponse & { response_video_signed_url: string }) | null;
    }
  >;
};
