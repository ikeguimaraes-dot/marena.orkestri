"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type InsightData = {
  headline: string;
  insights: string[];
  proximo_passo: string;
};

type Props = {
  module: string;
  context: Record<string, unknown>;
  title?: string;
};

export function InsightPanel({ module, context, title = "Insight IA" }: Props) {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const payload = useMemo(
    () => JSON.stringify({ module, context }),
    [module, context],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch("/api/intelligence/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) { setLoading(false); return; }
      const json = (await res.json()) as InsightData | null;
      if (json?.headline) setData(json);
    } catch {
      // fail silently — never block page
    } finally {
      setLoading(false);
    }
  }, [payload]);

  useEffect(() => { load(); }, [load]);

  // If done loading and no data, render nothing
  if (!loading && !data) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--brand-secondary)",
        borderRadius: 10,
        padding: "20px 24px",
        marginTop: 28,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            background: "var(--brand-secondary-soft)",
            color: "var(--brand-secondary)",
            border: "1px solid color-mix(in srgb, var(--brand-secondary) 27%, transparent)",
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          IA
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {title}
        </span>
        <button
          onClick={load}
          disabled={loading}
          title="Regenerar insight"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "var(--text-3)",
            cursor: loading ? "default" : "pointer",
            fontSize: 16,
            padding: "2px 6px",
            borderRadius: 4,
            opacity: loading ? 0.4 : 1,
            transition: "opacity 0.2s",
          }}
          aria-label="Regenerar insight"
        >
          ↻
        </button>
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[100, 80, 65].map((w, i) => (
            <div
              key={i}
              style={{
                height: i === 0 ? 18 : 13,
                width: `${w}%`,
                background: "var(--surface-2)",
                borderRadius: 6,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              margin: "0 0 14px",
              lineHeight: 1.4,
            }}
          >
            {data.headline}
          </p>

          <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.insights ?? []).slice(0, 3).map((bullet, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--text-2)",
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 99,
                    background: "var(--brand-secondary)",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
                {bullet}
              </li>
            ))}
          </ul>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: "var(--brand-secondary)",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              Próximo passo
            </span>
            <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
              {data.proximo_passo}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
