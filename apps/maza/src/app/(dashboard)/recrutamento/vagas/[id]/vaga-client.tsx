"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Button } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@maza/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@maza/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@maza/ui/dialog";
import {
  createCandidate,
  createInterviewQuestion,
  deleteInterviewQuestion,
} from "@/app/(dashboard)/recrutamento/actions";
import { formatDateBR } from "@/lib/format";
import type {
  Candidate,
  CandidateStatus,
  InterviewQuestion,
} from "@/lib/recrutamento/types";

const CAND_STATUS: Record<
  CandidateStatus,
  { bg: string; fg: string; label: string }
> = {
  pendente: { bg: "rgba(245,158,11,0.16)", fg: "#A16207", label: "Pendente" },
  aprovado: { bg: "rgba(34,197,94,0.16)", fg: "#15803D", label: "Aprovado" },
  reprovado: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C", label: "Reprovado" },
};

const INTERVIEW_STATUS: Record<
  string,
  { bg: string; fg: string; label: string }
> = {
  pendente: { bg: "var(--surface-2)", fg: "var(--text-3)", label: "Aguardando" },
  em_andamento: {
    bg: "rgba(59,130,246,0.16)",
    fg: "#1D4ED8",
    label: "Em andamento",
  },
  concluido: {
    bg: "rgba(34,197,94,0.16)",
    fg: "#15803D",
    label: "Concluída",
  },
};

export function VagaDetailClient({
  vagaId,
  questions,
  candidates,
}: {
  vagaId: string;
  questions: InterviewQuestion[];
  candidates: Candidate[];
}) {
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);

  return (
    <Tabs defaultValue="candidates">
      <TabsList variant="line">
        <TabsTrigger value="candidates">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Candidatos ({candidates.length})
        </TabsTrigger>
        <TabsTrigger value="questions">
          <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
          Perguntas ({questions.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="candidates">
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 14,
          }}
        >
          <Button onClick={() => setShowCandidateForm(true)}>
            <UserPlus size={14} className="mr-1" /> Convidar candidato
          </Button>
        </div>

        {candidates.length === 0 ? (
          <EmptyState>
            Sem candidatos ainda. Convide o primeiro — você gera um access_code
            CAND-XXXX e envia pra ele acessar pelo app mobile.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Access code</TableHead>
                <TableHead>Entrevista</TableHead>
                <TableHead>Status RH</TableHead>
                <TableHead>Inscrito em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const rhStatus = CAND_STATUS[c.status];
                const intStatus =
                  INTERVIEW_STATUS[c.interview_status] ??
                  INTERVIEW_STATUS.pendente!;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <strong>{c.full_name}</strong>
                      {c.email && (
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {c.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <CopyableCode code={c.access_code} />
                    </TableCell>
                    <TableCell>
                      <Badge {...intStatus} />
                    </TableCell>
                    <TableCell>
                      <Badge {...rhStatus} />
                    </TableCell>
                    <TableCell style={{ color: "var(--text-3)" }}>
                      {formatDateBR(c.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/recrutamento/candidatos/${c.id}`}
                        style={BTN_GHOST}
                      >
                        <ExternalLink size={12} /> Revisar
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="questions">
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 14,
          }}
        >
          <Button onClick={() => setShowQuestionForm(true)}>
            <Plus size={14} className="mr-1" /> Nova pergunta
          </Button>
        </div>

        {questions.length === 0 ? (
          <EmptyState>
            Sem perguntas. Adicione a primeira — o candidato vai gravar a
            resposta em vídeo no app mobile.
          </EmptyState>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {questions.map((q) => (
              <QuestionRow key={q.id} q={q} />
            ))}
          </div>
        )}
      </TabsContent>

      <NovaPerguntaDialog
        open={showQuestionForm}
        onOpenChange={setShowQuestionForm}
        vagaId={vagaId}
      />
      <NovoCandidatoDialog
        open={showCandidateForm}
        onOpenChange={setShowCandidateForm}
        vagaId={vagaId}
      />
    </Tabs>
  );
}

function QuestionRow({ q }: { q: InterviewQuestion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Excluir pergunta #${q.order_num}?`)) return;
    startTransition(async () => {
      await deleteInterviewQuestion(q.id);
      router.refresh();
    });
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {q.order_num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
          {q.question_text}
        </div>
        {q.video_url && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            Vídeo do RH anexado
          </div>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={pending}
        style={{ ...BTN_GHOST, color: "var(--destructive)" }}
        title="Excluir"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function NovaPerguntaDialog({
  open,
  onOpenChange,
  vagaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vagaId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!text.trim()) {
      setError("Pergunta obrigatória.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createInterviewQuestion({
        job_opening_id: vagaId,
        question_text: text.trim(),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
        </DialogHeader>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 8,
          }}
        >
          <Field label="Pergunta *">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              placeholder="Ex: Conte sua experiência com atendimento ao cliente."
            />
          </Field>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            Vídeo do RH (opcional) você pode adicionar depois pelo app mobile
            — upload direto pro bucket interview-videos.
          </p>
          {error && (
            <div style={ERROR_BOX}>{error}</div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NovoCandidatoDialog({
  open,
  onOpenChange,
  vagaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vagaId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCreatedCode(null);
    setError(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Nome obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createCandidate({
        job_opening_id: vagaId,
        full_name: name.trim(),
        email: email.trim() || "",
        phone: phone.trim() || "",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCreatedCode(r.data.access_code);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>
            {createdCode ? "Candidato criado!" : "Convidar candidato"}
          </DialogTitle>
        </DialogHeader>

        {createdCode ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 8,
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
              Use este código para o candidato acessar a entrevista no app
              mobile:
            </p>
            <CopyableCode code={createdCode} large />
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Pronto
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 8,
            }}
          >
            <Field label="Nome completo *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            {error && <div style={ERROR_BOX}>{error}</div>}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 4,
              }}
            >
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Criar candidato"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyableCode({
  code,
  large,
}: {
  code: string;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <button
      onClick={handle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: large ? "10px 14px" : "3px 10px",
        borderRadius: 6,
        background: "var(--brand-soft)",
        border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)",
        color: "var(--brand)",
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: large ? 18 : 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
      title="Copiar"
    >
      {code}
      {copied ? <Check size={large ? 16 : 12} /> : <Copy size={large ? 16 : 12} />}
    </button>
  );
}

function Badge({
  bg,
  fg,
  label,
}: {
  bg: string;
  fg: string;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--text-3)",
        fontSize: 13,
        background: "var(--surface)",
        border: "1px dashed var(--border)",
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</label>
      {children}
    </div>
  );
}

const BTN_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  fontSize: 11,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  textDecoration: "none",
  color: "var(--text-2)",
};

const ERROR_BOX: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.4)",
  borderRadius: 6,
  color: "var(--destructive)",
  fontSize: 12,
};
