import type { NfeDirection, ParsedNfe } from "./parser"

// Saídas costumam ter poucos itens. Limitar também o trabalho e os bytes
// impede que notas grandes tornem os lotes maiores demais.
const MAX_BATCH_BYTES = 2_500_000
const MAX_BATCH_ITEMS = 300

export function splitNfeBatches(notes: ParsedNfe[], direction: NfeDirection) {
  const maxNotes = direction === "saida" ? 100 : 20
  const encoder = new TextEncoder()
  const batches: ParsedNfe[][] = []
  let batch: ParsedNfe[] = []
  let batchBytes = 2
  let batchItems = 0
  for (const note of notes) {
    const bytes = encoder.encode(JSON.stringify(note)).byteLength + 1
    // Uma nota permanece inteira, mesmo quando excede sozinha o alvo do lote.
    if (batch.length && (batch.length >= maxNotes || batchBytes + bytes > MAX_BATCH_BYTES || batchItems + note.itens.length > MAX_BATCH_ITEMS)) {
      batches.push(batch)
      batch = []
      batchBytes = 2
      batchItems = 0
    }
    batch.push(note)
    batchBytes += bytes
    batchItems += note.itens.length
  }
  if (batch.length) batches.push(batch)
  return batches
}
