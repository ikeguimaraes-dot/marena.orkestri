import type { OpxEvidenceInput } from './ledger'

// Tipos de evidência suportados — extensível conforme CRIVO e SALDO precisarem.
export type EvidenceKind = 'foto' | 'assinatura' | 'peso' | 'temperatura' | 'texto' | 'json'

export type Evidence =
  | { kind: 'foto';        url: string }
  | { kind: 'assinatura';  url: string }
  | { kind: 'peso';        valor: number; unidade?: 'kg' | 'g' }
  | { kind: 'temperatura'; valor: number; unidade?: 'C' | 'F' }
  | { kind: 'texto';       conteudo: string }
  | { kind: 'json';        data: Record<string, unknown> }

export function toEvidenceInput(e: Evidence): OpxEvidenceInput {
  switch (e.kind) {
    case 'foto':
    case 'assinatura':
      return { kind: e.kind, value: { url: e.url } }
    case 'peso':
      return { kind: e.kind, value: { valor: e.valor, unidade: e.unidade ?? 'kg' } }
    case 'temperatura':
      return { kind: e.kind, value: { valor: e.valor, unidade: e.unidade ?? 'C' } }
    case 'texto':
      return { kind: e.kind, value: { conteudo: e.conteudo } }
    case 'json':
      return { kind: e.kind, value: e.data }
  }
}

// Converte um array de Evidence para o formato que writeOpxEvent() espera.
export function buildEvidences(items: Evidence[]): OpxEvidenceInput[] {
  return items.map(toEvidenceInput)
}
