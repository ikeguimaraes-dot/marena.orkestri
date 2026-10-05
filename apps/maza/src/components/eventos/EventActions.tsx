"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Printer, Trash2, X } from "lucide-react";

import {
  deleteEvent,
  updateEventStatus,
} from "@/app/(dashboard)/eventos/actions";
import { NEXT_STATUS, STATUS_LABEL } from "@/lib/eventos/labels";
import type { EventStatus } from "@maza/db/types/database";

/**
 * Botões de ação na view de O.S.: editar, imprimir, transitar status,
 * deletar. Status transitions seguem NEXT_STATUS (ver labels.ts).
 */
export function EventActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const next = NEXT_STATUS[status] ?? [];

  const transition = (novo: EventStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await updateEventStatus(eventId, novo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteEvent(eventId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/eventos");
    });
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button
        type="button"
        onClick={() => router.push(`/eventos/${eventId}/editar`)}
        style={BTN_OUTLINE}
        disabled={pending}
      >
        <Pencil size={14} /> Editar
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        style={BTN_GHOST}
      >
        <Printer size={14} /> Imprimir
      </button>

      {next.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => transition(s)}
          disabled={pending}
          style={s === "cancelado" ? BTN_DANGER : BTN_OUTLINE}
        >
          <Check size={14} /> Marcar como {STATUS_LABEL[s]}
        </button>
      ))}

      {confirmDelete ? (
        <>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            style={BTN_DANGER}
          >
            <Trash2 size={14} /> Confirmar exclusão
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            style={BTN_GHOST}
          >
            <X size={14} /> Cancelar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          style={BTN_DANGER}
          disabled={pending}
        >
          <Trash2 size={14} /> Excluir
        </button>
      )}

      {error && (
        <div
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "var(--destructive)",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

const baseBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const BTN_OUTLINE: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  color: "var(--brand)",
  border: "1px solid var(--brand)",
};

const BTN_GHOST: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  color: "var(--text-3)",
  border: "1px solid var(--border)",
};

const BTN_DANGER: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  color: "var(--destructive)",
  border: "1px solid var(--destructive)",
};
