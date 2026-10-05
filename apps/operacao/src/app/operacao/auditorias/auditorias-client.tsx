"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@kph/ui/tabs";
import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import { Textarea } from "@kph/ui/textarea";

import { submitChecklistRecord, createChecklist } from "./actions";
import { formatDateBR } from "@/lib/format";
import type {
  ChecklistArea,
  ChecklistItem,
  ChecklistRecordRow,
  ChecklistTurno,
  QualityChecklistRow,
} from "@kph/db/types/database";

const TURNO_LABEL: Record<ChecklistTurno, string> = {
  abertura: "Abertura",
  almoco: "Almoço",
  jantar: "Jantar",
  fechamento: "Fechamento",
};

const AREA_LABEL: Record<ChecklistArea, string> = {
  cozinha: "Cozinha",
  bar: "Bar",
  salao: "Salão",
  higiene: "Higiene",
  geral: "Geral",
};

const AREA_COLOR: Record<ChecklistArea, { bg: string; fg: string }> = {
  cozinha: { bg: "rgba(239,68,68,0.12)", fg: "#B91C1C" },
  bar: { bg: "rgba(59,130,246,0.12)", fg: "#1D4ED8" },
  salao: { bg: "rgba(168,85,247,0.12)", fg: "#7E22CE" },
  higiene: { bg: "rgba(34,197,94,0.12)", fg: "#15803D" },
  geral: { bg: "rgba(107,114,128,0.12)", fg: "#374151" },
};

function AreaBadge({ area }: { area: ChecklistArea }) {
  const { bg, fg } = AREA_COLOR[area];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
      }}
    >
      {AREA_LABEL[area]}
    </span>
  );
}

function TurnoBadge({ turno }: { turno: ChecklistTurno }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: "rgba(212,165,116,0.15)",
        color: "var(--brand)",
      }}
    >
      {TURNO_LABEL[turno]}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
    );
  }
  const { bg, fg } =
    score >= 80
      ? { bg: "rgba(34,197,94,0.12)", fg: "#15803D" }
      : score >= 60
        ? { bg: "rgba(245,158,11,0.12)", fg: "#A16207" }
        : { bg: "rgba(239,68,68,0.12)", fg: "#B91C1C" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color: fg,
      }}
    >
      {score}%
    </span>
  );
}

function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function AuditoriasClient({
  unitId,
  unitName: _unitName,
  checklists,
  records,
}: {
  unitId: string;
  unitName: string;
  checklists: QualityChecklistRow[];
  records: ChecklistRecordRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [turnoHoje, setTurnoHoje] = useState<ChecklistTurno>("abertura");
  const [respostas, setRespostas] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const [showForm, setShowForm] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formArea, setFormArea] = useState<ChecklistArea>("cozinha");
  const [formTurno, setFormTurno] = useState<ChecklistTurno>("abertura");
  const [formItens, setFormItens] = useState("");
  const [formPending, setFormPending] = useState(false);

  const checklistsHoje = checklists.filter((cl) => cl.turno === turnoHoje);

  function getRespostas(clId: string): Record<string, boolean> {
    return respostas[clId] ?? {};
  }

  function toggleItem(clId: string, itemId: string, checked: boolean) {
    setRespostas((prev) => ({
      ...prev,
      [clId]: { ...(prev[clId] ?? {}), [itemId]: checked },
    }));
  }

  function handleSubmitChecklist(cl: QualityChecklistRow) {
    const state = getRespostas(cl.id);
    const total = cl.items.length;
    const checkedCount = Object.values(state).filter(Boolean).length;
    const score_pct = total === 0 ? 100 : Math.round((checkedCount / total) * 100);

    setSubmitting((prev) => ({ ...prev, [cl.id]: true }));
    startTransition(async () => {
      const r = await submitChecklistRecord({
        checklist_id: cl.id,
        unit_id: unitId,
        data: today(),
        turno: turnoHoje,
        responsavel_id: null,
        respostas: state,
        score_pct,
        observacoes: obs[cl.id] ?? null,
      });
      setSubmitting((prev) => ({ ...prev, [cl.id]: false }));
      if (!r.ok) {
        alert(r.error);
        return;
      }
      setRespostas((prev) => {
        const next = { ...prev };
        delete next[cl.id];
        return next;
      });
      setObs((prev) => {
        const next = { ...prev };
        delete next[cl.id];
        return next;
      });
      router.refresh();
    });
  }

  function handleCreateChecklist() {
    const linhas = formItens
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const items: ChecklistItem[] = linhas.map((texto) => ({
      id: crypto.randomUUID(),
      texto,
      obrigatorio: false,
    }));
    setFormPending(true);
    startTransition(async () => {
      const r = await createChecklist({
        unit_id: unitId,
        nome: formNome,
        area: formArea,
        turno: formTurno,
        items,
        ativo: true,
      });
      setFormPending(false);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      setShowForm(false);
      setFormNome("");
      setFormArea("cozinha");
      setFormTurno("abertura");
      setFormItens("");
      router.refresh();
    });
  }

  const checklistMap = new Map(checklists.map((cl) => [cl.id, cl]));

  return (
    <Tabs defaultValue="hoje">
      <TabsList>
        <TabsTrigger value="hoje">Hoje</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="configurar">Configurar</TabsTrigger>
      </TabsList>

      <TabsContent value="hoje" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 20, maxWidth: 260 }}>
          <Select
            value={turnoHoje}
            onValueChange={(v) => setTurnoHoje(v as ChecklistTurno)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertura">Abertura</SelectItem>
              <SelectItem value="almoco">Almoço</SelectItem>
              <SelectItem value="jantar">Jantar</SelectItem>
              <SelectItem value="fechamento">Fechamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {checklistsHoje.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "32px 22px",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            Nenhum checklist para este turno.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {checklistsHoje.map((cl) => {
              const state = getRespostas(cl.id);
              const isPending = submitting[cl.id] ?? false;
              return (
                <div
                  key={cl.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 18px",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--brand-soft)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--text)",
                        flex: 1,
                      }}
                    >
                      {cl.nome}
                    </span>
                    <AreaBadge area={cl.area} />
                  </div>

                  <div style={{ padding: "14px 18px" }}>
                    {cl.items.length === 0 ? (
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-3)",
                          margin: "0 0 12px",
                        }}
                      >
                        Nenhum item cadastrado.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          marginBottom: 14,
                        }}
                      >
                        {cl.items.map((item) => (
                          <label
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={state[item.id] ?? false}
                              onChange={(e) =>
                                toggleItem(cl.id, item.id, e.target.checked)
                              }
                              style={{
                                marginTop: 2,
                                accentColor: "var(--brand)",
                                width: 15,
                                height: 15,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--text)",
                                lineHeight: 1.45,
                              }}
                            >
                              {item.texto}
                              {item.obrigatorio && (
                                <span
                                  style={{
                                    color: "var(--brand)",
                                    marginLeft: 4,
                                    fontSize: 11,
                                  }}
                                >
                                  *
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <Textarea
                      placeholder="Observações opcionais…"
                      value={obs[cl.id] ?? ""}
                      onChange={(e) =>
                        setObs((prev) => ({
                          ...prev,
                          [cl.id]: e.target.value,
                        }))
                      }
                      style={{ fontSize: 13, marginBottom: 12, minHeight: 72 }}
                    />

                    <Button
                      onClick={() => handleSubmitChecklist(cl)}
                      disabled={isPending}
                      style={{ minWidth: 120 }}
                    >
                      {isPending ? "Enviando…" : "Submeter"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="historico" style={{ marginTop: 20 }}>
        {records.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "32px 22px",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            Nenhum registro nos últimos 30 dias.
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => {
                  const cl = checklistMap.get(rec.checklist_id);
                  return (
                    <TableRow key={rec.id}>
                      <TableCell style={{ fontSize: 13 }}>
                        {formatDateBR(rec.data)}
                      </TableCell>
                      <TableCell>
                        <TurnoBadge turno={rec.turno} />
                      </TableCell>
                      <TableCell
                        style={{
                          fontSize: 13,
                          color: cl ? "var(--text)" : "var(--text-3)",
                        }}
                      >
                        {cl ? cl.nome : "—"}
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={rec.score_pct} />
                      </TableCell>
                      <TableCell
                        style={{
                          fontSize: 12,
                          color: "var(--text-2)",
                          maxWidth: 260,
                        }}
                      >
                        {rec.observacoes ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="configurar" style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Checklists cadastrados
          </span>
          <Button
            variant="outline"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancelar" : "+ Novo Checklist"}
          </Button>
        </div>

        {showForm && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 20px",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Nome
              </label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Abertura Cozinha"
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Área
                </label>
                <Select
                  value={formArea}
                  onValueChange={(v) => setFormArea(v as ChecklistArea)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cozinha">Cozinha</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="salao">Salão</SelectItem>
                    <SelectItem value="higiene">Higiene</SelectItem>
                    <SelectItem value="geral">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Turno
                </label>
                <Select
                  value={formTurno}
                  onValueChange={(v) => setFormTurno(v as ChecklistTurno)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abertura">Abertura</SelectItem>
                    <SelectItem value="almoco">Almoço</SelectItem>
                    <SelectItem value="jantar">Jantar</SelectItem>
                    <SelectItem value="fechamento">Fechamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Itens
              </label>
              <Textarea
                value={formItens}
                onChange={(e) => setFormItens(e.target.value)}
                placeholder="Um item por linha…"
                style={{ minHeight: 100, fontSize: 13 }}
              />
            </div>
            <div>
              <Button
                onClick={handleCreateChecklist}
                disabled={formPending || !formNome.trim()}
              >
                {formPending ? "Criando…" : "Criar"}
              </Button>
            </div>
          </div>
        )}

        {checklists.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "32px 22px",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            Nenhum checklist cadastrado ainda.
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklists.map((cl) => (
                  <TableRow key={cl.id}>
                    <TableCell
                      style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}
                    >
                      {cl.nome}
                    </TableCell>
                    <TableCell>
                      <AreaBadge area={cl.area} />
                    </TableCell>
                    <TableCell>
                      <TurnoBadge turno={cl.turno} />
                    </TableCell>
                    <TableCell
                      style={{ fontSize: 13, color: "var(--text-2)" }}
                    >
                      {cl.items.length} {cl.items.length === 1 ? "item" : "itens"}
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: cl.ativo
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(107,114,128,0.12)",
                          color: cl.ativo ? "#15803D" : "var(--text-3)",
                        }}
                      >
                        {cl.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
