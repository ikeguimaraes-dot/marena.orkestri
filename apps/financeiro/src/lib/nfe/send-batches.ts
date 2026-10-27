import type { NfeImportPayload, NfeImportResult } from "@/app/financeiro/dre/cmv/actions"

/** Only retry a confirmed transaction rollback, never an uncertain network failure. */
export async function* sendNfeBatches(
  batches: NfeImportPayload["notas"][],
  context: Omit<NfeImportPayload, "notas" | "adiarRecalculo">,
  send: (payload: NfeImportPayload) => Promise<NfeImportResult>,
) {
  const queue = [...batches]
  let processed = 0
  while (queue.length) {
    const notas = queue.shift()!
    const response = await send({ ...context, notas, adiarRecalculo: true, rejeitadas: processed === 0 ? context.rejeitadas : 0 })
    if (!response.ok) {
      const rollbackTimeout = response.error?.startsWith("Falha ao salvar; a versão anterior foi preservada:")
        && response.error.includes("canceling statement due to statement timeout")
      if (rollbackTimeout && notas.length > 1) {
        const middle = Math.ceil(notas.length / 2)
        queue.unshift(notas.slice(0, middle), notas.slice(middle))
        continue
      }
      throw new Error(rollbackTimeout
        ? `A nota ${notas[0]?.numero ?? notas[0]?.chave} excedeu o tempo de gravação mesmo isolada. Os lotes anteriores estão salvos.`
        : response.error ?? "Falha na importação.")
    }
    processed += notas.length
    yield { response, processed }
  }
}
