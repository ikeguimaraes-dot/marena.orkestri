import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Máscara de moeda (estilo caixa eletrônico) ----
// Guardamos no estado o valor numérico como string com ponto decimal
// (ex: "1234.56"); exibimos com milhar e vírgula travada (ex: "1.234,56").
// Modelo: os dígitos entram pela DIREITA, sempre com 2 casas.
// Ex: "1" -> 0,01; "1234" -> 12,34; "123456" -> 1.234,56.

/** Converte a string do estado (número puro) para exibição BR: "1234.5" -> "1.234,50" */
export function moedaParaExibicao(valorEstado: string): string {
  if (valorEstado === '' || valorEstado == null) return ''
  const n = parseFloat(valorEstado)
  if (isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Recebe o que o usuário digitou, extrai só os dígitos e interpreta como centavos
 *  (entra pela direita, vírgula travada). Retorna { estado, exibicao }:
 *  estado = "1234.56" (pro form/banco), exibicao = "1.234,56". */
export function moedaAoDigitar(input: string): { estado: string; exibicao: string } {
  const digitos = input.replace(/\D/g, '')
  if (digitos === '') return { estado: '', exibicao: '' }
  const valor = parseInt(digitos, 10) / 100
  return {
    estado: valor.toFixed(2),
    exibicao: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }
}
