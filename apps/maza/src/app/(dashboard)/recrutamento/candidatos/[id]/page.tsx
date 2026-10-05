import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCandidateWithResponses } from "@/app/(dashboard)/recrutamento/actions";
import { CandidatoClient } from "./candidato-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CandidatoPage({ params }: Props) {
  const { id } = await params;
  const bundle = await getCandidateWithResponses(id);
  if (!bundle) notFound();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
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

      <CandidatoClient bundle={bundle} />
    </div>
  );
}
