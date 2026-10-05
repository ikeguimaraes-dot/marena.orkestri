'use client'
import { useId } from 'react'

export type Colaborador = {
  id: string
  nome: string
  sobrenome: string | null
  funcao: string | null
  cpf: string | null
}

/** Nome completo exibido: nome + sobrenome. */
export function nomeCompleto(c: Colaborador): string {
  return [c.nome, c.sobrenome].filter(Boolean).join(' ').trim()
}

/**
 * Seletor de colaborador com busca (datalist nativo — funciona bem em
 * mobile). Guarda o NOME como texto (compatível com o schema atual) e,
 * quando o nome digitado bate com um colaborador do cadastro, informa o
 * CPF via onSelecionarColaborador (quando existir). Permite digitar um
 * nome livre caso a pessoa não esteja no cadastro.
 */
export function SeletorColaborador({
  colaboradores,
  value,
  onChange,
  onSelecionarColaborador,
  placeholder,
  disabled,
  className,
  id,
}: {
  colaboradores: Colaborador[]
  value: string
  onChange: (nome: string) => void
  onSelecionarColaborador?: (c: Colaborador) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}) {
  const listId = useId()

  function handleChange(nome: string) {
    onChange(nome)
    // Se o texto bate exatamente com um colaborador, dispara o callback
    const match = colaboradores.find(c => nomeCompleto(c) === nome)
    if (match && onSelecionarColaborador) onSelecionarColaborador(match)
  }

  return (
    <>
      <input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={e => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? 'Selecione ou digite o nome'}
        className={className ?? 'w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none disabled:opacity-50'}
      />
      <datalist id={listId}>
        {colaboradores.map(c => (
          <option key={c.id} value={nomeCompleto(c)}>
            {c.funcao ?? ''}
          </option>
        ))}
      </datalist>
    </>
  )
}
