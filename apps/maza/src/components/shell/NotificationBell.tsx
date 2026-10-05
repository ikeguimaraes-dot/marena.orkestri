"use client";

// Bell de notificações no TopBar. Polling a cada 30s pra contar não lidas.
// Dropdown com últimas 10 notificações + "Marcar todas como lidas".

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";

import {
  countUnread,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/notifications/actions";
import { timeAgo, type Notification } from "@/lib/notifications/types";

const POLL_MS = 30_000;

export function NotificationBell() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [unread, setUnread] = useState<number>(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [n, list] = await Promise.all([countUnread(), listNotifications(10)]);
      setUnread(n);
      setItems(list);
    } catch {
      // silently ignore — proximo poll tenta de novo
    }
  }, []);

  // Fetch inicial + polling a cada POLL_MS. Pausa quando aba escondida.
  useEffect(() => {
    let cancelled = false;
    void refresh();
    function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  // Refresh imediato quando aba volta a ficar visível.
  useEffect(() => {
    function onVisible() {
      if (typeof document !== "undefined" && !document.hidden) {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Click fora → fecha dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Refresh ao abrir o dropdown — pra não mostrar dados velhos.
  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  function handleClickItem(n: Notification) {
    setOpen(false);
    if (!n.lida) {
      startTransition(async () => {
        await markAsRead(n.id);
        await refresh();
      });
    }
    if (n.link) {
      router.push(n.link);
    }
  }

  function handleMarkAll() {
    startTransition(async () => {
      const r = await markAllAsRead();
      if (r.ok) await refresh();
    });
  }

  const hasUnread = unread > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={handleToggle}
        title="Notificações"
        aria-label={
          hasUnread ? `Notificações (${unread} não lidas)` : "Notificações"
        }
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "transparent",
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
          color: "var(--text-2)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color var(--t), color var(--t)",
        }}
      >
        <Bell size={16} />
        {hasUnread && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#EF4444",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 0 0 2px var(--bg)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <strong
              style={{
                fontSize: 13,
                color: "var(--text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Notificações
              {loading && <Loader2 size={12} className="animate-spin" />}
            </strong>
            <button
              onClick={handleMarkAll}
              disabled={!hasUnread}
              style={{
                background: "transparent",
                border: "none",
                color: hasUnread ? "var(--brand)" : "var(--text-3)",
                cursor: hasUnread ? "pointer" : "default",
                fontSize: 11,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={11} />
              Marcar todas
            </button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text-3)",
                }}
              >
                Sem notificações ainda.
              </div>
            ) : (
              items.map((n) => (
                <NotifItem
                  key={n.id}
                  n={n}
                  onClick={() => handleClickItem(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({
  n,
  onClick,
}: {
  n: Notification;
  onClick: () => void;
}) {
  const Wrapper: React.ElementType = n.link ? Link : "button";
  const wrapperProps = n.link
    ? { href: n.link, onClick }
    : { type: "button" as const, onClick };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "10px 14px",
        borderBottom: "1px solid var(--border)",
        background: n.lida ? "transparent" : "color-mix(in srgb, var(--brand) 5%, transparent)",
        textAlign: "left",
        textDecoration: "none",
        color: "var(--text)",
        cursor: "pointer",
        border: "none",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {!n.lida && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "var(--brand)",
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: n.lida ? 500 : 700,
            color: "var(--text)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {n.titulo}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            whiteSpace: "nowrap",
          }}
        >
          {timeAgo(n.created_at)}
        </span>
      </div>
      {n.mensagem && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            paddingLeft: n.lida ? 0 : 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {n.mensagem}
        </div>
      )}
    </Wrapper>
  );
}
