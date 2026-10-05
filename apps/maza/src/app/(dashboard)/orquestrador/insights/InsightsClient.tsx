"use client"

import { useState, useTransition } from "react"
import ReactMarkdown from "react-markdown"
import { generateWeeklyInsight, type HosInsight } from "@/lib/orquestrador/actions"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function InsightsClient({ initialInsights }: { initialInsights: HosInsight[] }) {
  const [insights, setInsights] = useState(initialInsights)
  const [selected, setSelected] = useState<HosInsight | null>(insights[0] ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateWeeklyInsight()
      if (!result.ok) {
        setError(result.error ?? "Erro ao gerar insight")
        return
      }
      const newInsight = result.data!
      setInsights((prev) => [newInsight, ...prev])
      setSelected(newInsight)
    })
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Insights Semanais</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Relatórios executivos gerados pela IA com base nas métricas do Orquestrador.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6"
        >
          {isPending ? "Gerando..." : "Gerar relatório"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        {/* Lista de relatórios */}
        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Relatórios anteriores
          </div>
          {insights.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum relatório gerado ainda.</p>
          ) : (
            <ul className="divide-y">
              {insights.map((insight) => (
                <li key={insight.id}>
                  <button
                    onClick={() => setSelected(insight)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                      selected?.id === insight.id ? "bg-muted" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(insight.period_start), "dd MMM", { locale: ptBR })} —{" "}
                      {format(new Date(insight.period_end), "dd MMM yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerado em {format(new Date(insight.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conteúdo do relatório */}
        <div className="rounded-md border bg-card shadow-sm p-6 min-h-[400px]">
          {selected ? (
            <article className="prose prose-sm max-w-none dark:prose-invert [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_strong]:font-semibold">
              <ReactMarkdown>{selected.report_md}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um relatório à esquerda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
