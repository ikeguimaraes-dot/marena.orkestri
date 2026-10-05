import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  getJobOpening,
  listCandidatesForJob,
  listInterviewQuestions,
} from "@/app/(dashboard)/recrutamento/actions";
import { VagaDetailClient } from "./vaga-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function VagaDetailPage({ params }: Props) {
  const { id } = await params;
  const vaga = await getJobOpening(id);
  if (!vaga) notFound();

  const [questions, candidates] = await Promise.all([
    listInterviewQuestions(id),
    listCandidatesForJob(id),
  ]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Link
        href="/recrutamento/vagas"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Vagas
      </Link>

      <header style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Vaga · {vaga.is_active ? "Ativa" : "Inativa"}
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          {vaga.title}
        </h1>
        {vaga.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {vaga.description}
          </p>
        )}
      </header>

      <VagaDetailClient
        vagaId={id}
        questions={questions}
        candidates={candidates}
      />
    </div>
  );
}
