"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  Clock,
  Save,
  Users,
  UtensilsCrossed,
  Wine,
  Wrench,
  X,
} from "lucide-react";

import {
  ACESSO_OPTIONS,
  AMBULANCIA_OPTIONS,
  ARTISTICO_OPTIONS,
  FOTOGRAFIA_OPTIONS,
  GERADOR_OPTIONS,
  MENU_BAR_CATEGORIAS,
  MENU_BAR_SERVICOS,
  MENU_COZINHA_CATEGORIAS,
  MENU_COZINHA_SERVICOS,
  MOBILIARIO_OPTIONS,
  MONTAGEM_OPTIONS,
  SITUACAO_PAGAMENTO_OPTIONS,
  STATUS_LABEL,
  TIPO_OPTIONS,
  VALET_OPTIONS,
} from "@/lib/eventos/labels";
import {
  BRIGADA_PADRAO,
  MENU_BAR_DEFAULT_ROWS,
  MENU_COZINHA_DEFAULT_ROWS,
} from "@/lib/eventos/defaults";
import { listUnitsForBrand } from "@/app/(dashboard)/eventos/actions";
import type {
  BrandOption,
  EventListRow,
  LayoutAnexo,
  MenuItem,
  UnitOption,
} from "@/lib/eventos/types";
import type { EventStatus } from "@maza/db/types/database";

import { BrigadaSection } from "./BrigadaSection";
import { CollapsibleSection } from "./CollapsibleSection";
import { LayoutUpload } from "./LayoutUpload";
import { MenuSection } from "./MenuSection";
import { ResumoHeader } from "./ResumoHeader";

import type { EventFormValues } from "@/lib/eventos/schema";
import type { ActionResult } from "@/lib/result";
import type { EventFull } from "@/lib/eventos/types";

// Subset de status disponíveis no select do form (paridade HOS).
const STATUS_OPTIONS: EventStatus[] = [
  "rascunho",
  "confirmado",
  "em_andamento",
  "concluido",
  "realizado",
  "cancelado",
];

type Props = {
  brands: BrandOption[];
  initial?: EventListRow | null;
  /** Server Action vinda da page — recebe os values e devolve ActionResult. */
  onSubmit: (input: EventFormValues) => Promise<ActionResult<EventFull>>;
  submitLabel: string;
};

/**
 * Form completo de criação/edição de O.S. Espelha a UX do HOS legado em 7
 * seções colapsáveis: Dados, Brigada, Menu Bar, Menu Cozinha, Alertas,
 * Montagem, Tempos, Infraestrutura.
 */
export function EventForm({ brands, initial, onSubmit, submitLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [units, setUnits] = useState<UnitOption[]>([]);

  // ── Derive datas do initial (TIMESTAMPTZ → date / time) ──
  const initialDate = useMemo(() => {
    if (!initial?.data_inicio) return "";
    return initial.data_inicio.slice(0, 10); // "YYYY-MM-DD"
  }, [initial?.data_inicio]);

  // Header
  const [brandId, setBrandId] = useState(initial?.brand_id ?? brands[0]?.id ?? "");
  const [unitId, setUnitId] = useState<string | null>(initial?.unit_id ?? null);
  const [tipo, setTipo] = useState(initial?.tipo ?? "Corporativo");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [tema, setTema] = useState(initial?.tema ?? "");
  const [dataInicio, setDataInicio] = useState(initialDate);
  const [horaInicio, setHoraInicio] = useState(initial?.hora_inicio ?? "");
  const [horaTermino, setHoraTermino] = useState(initial?.hora_termino ?? "");
  const [pax, setPax] = useState<string>(
    initial?.num_convidados != null ? String(initial.num_convidados) : "",
  );
  const [contato, setContato] = useState(initial?.contato_cliente ?? "");
  const [pagamento, setPagamento] = useState(
    initial?.situacao_pagamento ?? SITUACAO_PAGAMENTO_OPTIONS[0],
  );
  const [comercial, setComercial] = useState(
    initial?.responsavel_comercial ?? "",
  );
  const [operacional, setOperacional] = useState(
    initial?.responsavel_operacional ?? "",
  );
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "rascunho");
  const [briefing, setBriefing] = useState(initial?.briefing_cliente ?? "");

  // Brigada
  const [brigada, setBrigada] = useState(
    initial?.brigada ?? [...BRIGADA_PADRAO],
  );

  // Menu Bar
  const [menuBar, setMenuBar] = useState<MenuItem[]>(
    initial?.menu_bar?.filter((r) => r.servico !== "_info") ??
      [...MENU_BAR_DEFAULT_ROWS],
  );
  const [menuBarInfo, setMenuBarInfo] = useState(
    initial?.menu_bar?.find((r) => r.servico === "_info")?.descritivo ?? "",
  );

  // Menu Cozinha
  const [menuCozinha, setMenuCozinha] = useState<MenuItem[]>(
    initial?.menu_cozinha?.filter((r) => r.servico !== "_info") ??
      [...MENU_COZINHA_DEFAULT_ROWS],
  );
  const [menuCozinhaInfo, setMenuCozinhaInfo] = useState(
    initial?.menu_cozinha?.find((r) => r.servico === "_info")?.descritivo ?? "",
  );

  // Alertas
  const [campoLivre, setCampoLivre] = useState(initial?.campo_livre ?? "");

  // Montagem
  const [montagem, setMontagem] = useState(initial?.montagem ?? "");
  const [montagemDesc, setMontagemDesc] = useState(
    initial?.montagem_descricao ?? "",
  );
  const [layoutAnexos, setLayoutAnexos] = useState<LayoutAnexo[]>(
    initial?.layout_anexos ?? [],
  );

  // Tempos
  const [temposMov, setTemposMov] = useState(initial?.tempos_movimentos ?? "");

  // Infra
  const [espacos, setEspacos] = useState(initial?.espacos ?? "");
  const [acesso, setAcesso] = useState(
    initial?.acesso_entrada ?? ACESSO_OPTIONS[0],
  );
  const [acessoObs, setAcessoObs] = useState(initial?.acesso_obs ?? "");
  const [mobiliario, setMobiliario] = useState(
    initial?.mobiliario ?? MOBILIARIO_OPTIONS[0],
  );
  const [mobiliarioObs, setMobiliarioObs] = useState(
    initial?.mobiliario_obs ?? "",
  );
  const [fotografia, setFotografia] = useState(
    initial?.fotografia ?? FOTOGRAFIA_OPTIONS[0],
  );
  const [valet, setValet] = useState(initial?.valet ?? VALET_OPTIONS[0]);
  const [artistico, setArtistico] = useState(
    initial?.artistico ?? ARTISTICO_OPTIONS[0],
  );
  const [gerador, setGerador] = useState(
    initial?.gerador ?? GERADOR_OPTIONS[0],
  );
  const [ambulancia, setAmbulancia] = useState(
    initial?.ambulancia ?? AMBULANCIA_OPTIONS[0],
  );
  const [menores, setMenores] = useState(initial?.menores ?? "");

  // ── Carrega units quando brand muda ──
  useEffect(() => {
    if (!brandId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    void listUnitsForBrand(brandId).then((u) => {
      if (cancelled) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnits(u);
      // Se o unit atual não pertence à nova brand, limpa
      if (unitId && !u.some((x) => x.id === unitId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUnitId(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // ── Submit ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!brandId) {
      setError("Selecione uma marca");
      return;
    }
    if (!nome.trim()) {
      setError("Informe o nome do evento");
      return;
    }
    if (!dataInicio) {
      setError("Informe a data do evento");
      return;
    }

    // Anexa info como row sintética com servico='_info' (compat HOS)
    const menuBarOut = menuBarInfo
      ? [
          ...menuBar,
          {
            categoria: "",
            servico: "_info",
            hr_ini: null,
            hr_fim: null,
            descritivo: menuBarInfo,
            obs: "",
          },
        ]
      : menuBar;
    const menuCozinhaOut = menuCozinhaInfo
      ? [
          ...menuCozinha,
          {
            categoria: "",
            servico: "_info",
            hr_ini: null,
            hr_fim: null,
            descritivo: menuCozinhaInfo,
            obs: "",
          },
        ]
      : menuCozinha;

    const values: EventFormValues = {
      brand_id: brandId,
      unit_id: unitId,
      tipo,
      nome: nome.trim(),
      tema,
      data_inicio: dataInicio,
      hora_inicio: horaInicio,
      hora_termino: horaTermino,
      num_convidados: pax === "" ? null : parseInt(pax, 10),
      contato_cliente: contato,
      situacao_pagamento: pagamento,
      responsavel_comercial: comercial,
      responsavel_operacional: operacional,
      status,
      briefing_cliente: briefing,
      brigada,
      menu_bar: menuBarOut,
      menu_bar_info: menuBarInfo,
      menu_cozinha: menuCozinhaOut,
      menu_cozinha_info: menuCozinhaInfo,
      campo_livre: campoLivre,
      montagem,
      montagem_descricao: montagemDesc,
      layout_anexos: layoutAnexos,
      tempos_movimentos: temposMov,
      espacos,
      acesso_entrada: acesso,
      acesso_obs: acessoObs,
      mobiliario,
      mobiliario_obs: mobiliarioObs,
      fotografia,
      valet,
      artistico,
      gerador,
      ambulancia,
      menores,
    };

    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/eventos/${result.data.id}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 980 }}>
      <ResumoHeader
        nome={nome}
        espacos={espacos}
        data={dataInicio}
        hora_inicio={horaInicio}
        hora_termino={horaTermino}
        num_convidados={pax === "" ? null : parseInt(pax, 10) || null}
      />

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "var(--destructive)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* ── DADOS DO EVENTO ── */}
      <CollapsibleSection icon={<ClipboardList size={16} />} title="Dados do Evento">
        <Grid cols={2}>
          <Field label="Marca">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              style={INPUT}
            >
              <option value="">— Selecione —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de Evento">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={INPUT}
            >
              {TIPO_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Grid cols={2}>
          <Field label="Unit (opcional)">
            <select
              value={unitId ?? ""}
              onChange={(e) => setUnitId(e.target.value || null)}
              style={INPUT}
              disabled={!brandId || units.length === 0}
            >
              <option value="">— Brand-level —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome do Evento / Cliente">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Patria Investimentos"
              style={INPUT}
              required
            />
          </Field>
        </Grid>
        <Grid cols={2}>
          <Field label="Tema do Evento">
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: Comemoração de executivos"
              style={INPUT}
            />
          </Field>
          <Field label="Status da O.S.">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              style={INPUT}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Grid cols={3}>
          <Field label="Data do Evento">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={INPUT}
              required
            />
          </Field>
          <Field label="Hora Início">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              style={INPUT}
            />
          </Field>
          <Field label="Hora Término">
            <input
              type="time"
              value={horaTermino}
              onChange={(e) => setHoraTermino(e.target.value)}
              style={INPUT}
            />
          </Field>
        </Grid>
        <Grid cols={3}>
          <Field label="Nº de Convidados">
            <input
              type="number"
              min={0}
              value={pax}
              onChange={(e) => setPax(e.target.value)}
              placeholder="110"
              style={INPUT}
            />
          </Field>
          <Field label="Contato / Telefone">
            <input
              type="text"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Nome (11) 99999-9999"
              style={INPUT}
            />
          </Field>
          <Field label="Situação do Pagamento">
            <select
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value)}
              style={INPUT}
            >
              {SITUACAO_PAGAMENTO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Grid cols={2}>
          <Field label="Responsável Comercial">
            <input
              type="text"
              value={comercial}
              onChange={(e) => setComercial(e.target.value)}
              placeholder="Ex: Ike"
              style={INPUT}
            />
          </Field>
          <Field label="Responsável Operacional">
            <input
              type="text"
              value={operacional}
              onChange={(e) => setOperacional(e.target.value)}
              placeholder="Ex: Responsáveis pelo evento"
              style={INPUT}
            />
          </Field>
        </Grid>
        <Field label="Briefing do Cliente" mt>
          <textarea
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            rows={3}
            placeholder="Descreva o perfil e contexto do cliente..."
            style={{ ...INPUT, resize: "vertical", minHeight: 80 }}
          />
        </Field>
      </CollapsibleSection>

      {/* ── BRIGADA ── */}
      <CollapsibleSection icon={<Users size={16} />} title="Brigada">
        <BrigadaSection value={brigada} onChange={setBrigada} />
      </CollapsibleSection>

      {/* ── MENU BAR ── */}
      <CollapsibleSection icon={<Wine size={16} />} title="Menu Bar">
        <MenuSection
          rows={menuBar}
          onChange={setMenuBar}
          categoriaOptions={MENU_BAR_CATEGORIAS}
          servicoOptions={MENU_BAR_SERVICOS}
          headerLabel="Menu Bar"
          info={menuBarInfo}
          onInfoChange={setMenuBarInfo}
          infoLabel="Informações gerais sobre o serviço de bar"
        />
      </CollapsibleSection>

      {/* ── MENU COZINHA ── */}
      <CollapsibleSection icon={<UtensilsCrossed size={16} />} title="Menu Cozinha">
        <MenuSection
          rows={menuCozinha}
          onChange={setMenuCozinha}
          categoriaOptions={MENU_COZINHA_CATEGORIAS}
          servicoOptions={MENU_COZINHA_SERVICOS}
          headerLabel="Menu Cozinha"
          info={menuCozinhaInfo}
          onInfoChange={setMenuCozinhaInfo}
          infoLabel="Informações gerais sobre o serviço de comida"
        />
      </CollapsibleSection>

      {/* ── ALERTAS ── */}
      <CollapsibleSection icon={<AlertTriangle size={16} />} title="Alertas Operacionais">
        <Field label="Campo Livre — Observações e Alertas">
          <textarea
            value={campoLivre}
            onChange={(e) => setCampoLivre(e.target.value)}
            rows={5}
            placeholder="Segurança, manutenção, logística, rádios, pontos de atenção..."
            style={{ ...INPUT, resize: "vertical", minHeight: 100 }}
          />
        </Field>
      </CollapsibleSection>

      {/* ── MONTAGEM ── */}
      <CollapsibleSection icon={<Wrench size={16} />} title="Montagem">
        <Field label="Tipo de Montagem">
          <select
            value={montagem}
            onChange={(e) => setMontagem(e.target.value)}
            style={INPUT}
          >
            <option value="">— Selecione —</option>
            {MONTAGEM_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrever Montagem" mt>
          <textarea
            value={montagemDesc}
            onChange={(e) => setMontagemDesc(e.target.value)}
            rows={4}
            placeholder="Descreva a montagem, layout, disposição de móveis e espaços..."
            style={{ ...INPUT, resize: "vertical", minHeight: 90 }}
          />
        </Field>
        <Field label="Anexar Layout" mt>
          <LayoutUpload value={layoutAnexos} onChange={setLayoutAnexos} />
        </Field>
      </CollapsibleSection>

      {/* ── TEMPOS ── */}
      <CollapsibleSection icon={<Clock size={16} />} title="Tempos e Movimentos">
        <Field label="Cronograma do Evento">
          <textarea
            value={temposMov}
            onChange={(e) => setTemposMov(e.target.value)}
            rows={6}
            placeholder={`Descreva o cronograma e tempos de cada etapa do evento...

Ex:
06h00 — Início da montagem
11h00 — Pausa montagem (operação térreo)
18h00 — Abertura de portas
19h00 — Início do serviço
00h30 — Encerramento`}
            style={{ ...INPUT, resize: "vertical", minHeight: 130 }}
          />
        </Field>
      </CollapsibleSection>

      {/* ── INFRAESTRUTURA ── */}
      <CollapsibleSection icon={<Building2 size={16} />} title="Infraestrutura">
        <Grid cols={2}>
          <Field label="Espaços Utilizados">
            <textarea
              value={espacos}
              onChange={(e) => setEspacos(e.target.value)}
              rows={2}
              placeholder={"Ex: MEET - Rooftop\nMEET - Bar Secreto"}
              style={{ ...INPUT, resize: "vertical", minHeight: 60 }}
            />
          </Field>
          <Field label="Acesso de Entrada">
            <select
              value={acesso}
              onChange={(e) => setAcesso(e.target.value)}
              style={INPUT}
            >
              {ACESSO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Field label="Observações de Portaria" mt>
          <textarea
            value={acessoObs}
            onChange={(e) => setAcessoObs(e.target.value)}
            rows={2}
            placeholder="Ex: 2 hostess, pulseiras, check-in..."
            style={{ ...INPUT, resize: "vertical", minHeight: 56 }}
          />
        </Field>
        <Grid cols={2}>
          <Field label="Mobiliário">
            <select
              value={mobiliario}
              onChange={(e) => setMobiliario(e.target.value)}
              style={INPUT}
            >
              {MOBILIARIO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Obs. Mobiliário">
            <input
              type="text"
              value={mobiliarioObs}
              onChange={(e) => setMobiliarioObs(e.target.value)}
              placeholder="Ex: 12 Puffs + 4 Bistrô (locação)"
              style={INPUT}
            />
          </Field>
        </Grid>
        <Grid cols={2}>
          <Field label="Fotografia / Vídeo">
            <select
              value={fotografia}
              onChange={(e) => setFotografia(e.target.value)}
              style={INPUT}
            >
              {FOTOGRAFIA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valet">
            <select
              value={valet}
              onChange={(e) => setValet(e.target.value)}
              style={INPUT}
            >
              {VALET_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Grid cols={3}>
          <Field label="Artístico / DJ / Banda">
            <select
              value={artistico}
              onChange={(e) => setArtistico(e.target.value)}
              style={INPUT}
            >
              {ARTISTICO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gerador">
            <select
              value={gerador}
              onChange={(e) => setGerador(e.target.value)}
              style={INPUT}
            >
              {GERADOR_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ambulância">
            <select
              value={ambulancia}
              onChange={(e) => setAmbulancia(e.target.value)}
              style={INPUT}
            >
              {AMBULANCIA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        <Field label="Observação dos Menores" mt>
          <textarea
            value={menores}
            onChange={(e) => setMenores(e.target.value)}
            rows={2}
            placeholder="Observações sobre clientes menores de idade..."
            style={{ ...INPUT, resize: "vertical", minHeight: 56 }}
          />
        </Field>
      </CollapsibleSection>

      {/* ── ACTIONS ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          paddingTop: 8,
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/eventos")}
          style={BTN_GHOST}
        >
          <X size={14} /> Cancelar
        </button>
        <button type="submit" disabled={pending} style={BTN_GOLD}>
          <Save size={14} /> {pending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Helpers de UI compactos ──────────────────────────────────

function Grid({
  cols,
  children,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols === 3 ? "1fr 1fr 1fr" : "1fr 1fr",
        gap: 14,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  mt,
}: {
  label: string;
  children: React.ReactNode;
  mt?: boolean;
}) {
  return (
    <div style={{ marginTop: mt ? 14 : 0 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const BTN_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.3,
  cursor: "pointer",
  background: "transparent",
  color: "var(--text-3)",
  border: "1px solid var(--border)",
};

const BTN_GOLD: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.3,
  cursor: "pointer",
  background: "var(--brand)",
  color: "#0a0a0a",
  border: "none",
};
