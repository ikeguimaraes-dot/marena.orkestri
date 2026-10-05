import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

type Severidade = 'critica' | 'alta' | 'media'

interface Anomalia {
  tipo: string
  descricao: string
  severidade: Severidade
}

function detectarAnomalias(
  base: number,
  liquido: number,
  empSalarioBase: number,
  empAtivo: boolean
): Anomalia[] {
  const anomalias: Anomalia[] = []

  if (liquido <= 0) {
    anomalias.push({
      tipo: 'liquido_zerado',
      descricao: `Salário líquido R$ ${liquido.toFixed(2)} ≤ 0`,
      severidade: 'critica',
    })
  }

  if (liquido > base) {
    anomalias.push({
      tipo: 'desconto_negativo',
      descricao: `Líquido R$ ${liquido.toFixed(2)} > base R$ ${base.toFixed(2)} (desconto negativo)`,
      severidade: 'alta',
    })
  }

  if (empSalarioBase > 0) {
    const variacao = Math.abs(base - empSalarioBase) / empSalarioBase
    if (variacao > 0.1) {
      anomalias.push({
        tipo: 'salario_divergente',
        descricao: `Base no holerite R$ ${base.toFixed(2)} difere ${(variacao * 100).toFixed(1)}% do cadastro R$ ${empSalarioBase.toFixed(2)}`,
        severidade: 'alta',
      })
    }
  }

  if (!empAtivo) {
    anomalias.push({
      tipo: 'colaborador_inativo',
      descricao: 'Colaborador inativo com holerite em rascunho',
      severidade: 'critica',
    })
  }

  return anomalias
}

export async function runFolhaValidator(): Promise<{ created: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', 'folha_validator')
    .eq('is_active', true)
    .single()

  if (!job) throw new Error('Job folha_validator não encontrado')

  const now = new Date()
  const competencia = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  // Holerites rascunho do mês atual com dados do colaborador
  const { data: payslips, error } = await (supabase as any)
    .from('payslips')
    .select(`
      id,
      employee_id,
      competencia,
      salario_base,
      liquido,
      employee:employees(nome, sobrenome, funcao, salario_base, ativo, unit:units(name))
    `)
    .eq('status', 'rascunho')
    .eq('competencia', `${competencia}-01`)

  if (error) throw new Error(error.message)

  // Runs abertos para deduplicação: chave = employee_id::competencia::tipo_anomalia
  const { data: openRuns } = await (supabase as any)
    .from('hos_runs')
    .select('payload')
    .eq('job_id', job.id)
    .in('status', ['pending', 'awaiting_approval'])

  const openKeys = new Set<string>(
    (openRuns ?? []).map(
      (r: any) =>
        `${r.payload?.employee_id}::${r.payload?.competencia}::${r.payload?.tipo_anomalia}`
    )
  )

  let created = 0

  for (const payslip of payslips ?? []) {
    const emp = payslip.employee
    if (!emp) continue

    const base = parseFloat(payslip.salario_base)
    const liquido = parseFloat(payslip.liquido)
    if (isNaN(base) || isNaN(liquido)) {
      console.error(`[folha-validator] Valor inválido para employee ${payslip.employee_id}`)
      continue
    }

    const nomeCompleto = [emp.nome, emp.sobrenome].filter(Boolean).join(' ')
    const unidade = emp.unit?.name ?? 'N/A'
    const empSalarioBase = parseFloat(emp.salario_base ?? '0')

    const anomalias = detectarAnomalias(base, liquido, empSalarioBase, emp.ativo ?? true)

    for (const anomalia of anomalias) {
      const dedupeKey = `${payslip.employee_id}::${competencia}::${anomalia.tipo}`
      if (openKeys.has(dedupeKey)) continue

      const title = `⚠️ Folha ${competencia} — ${nomeCompleto}: ${anomalia.descricao}`

      const { error: insertErr } = await (supabase as any)
        .from('hos_runs')
        .insert({
          job_id: job.id,
          status: 'awaiting_approval',
          triggered_by: 'cron',
          title,
          payload: {
            employee_id: payslip.employee_id,
            nome: nomeCompleto,
            funcao: emp.funcao ?? 'N/A',
            unidade,
            competencia,
            salario_base: payslip.salario_base,
            liquido: payslip.liquido,
            anomalia: anomalia.descricao,
            tipo_anomalia: anomalia.tipo,
            severidade: anomalia.severidade,
          },
          logs: [{ ts: new Date().toISOString(), msg: title }],
        })

      if (insertErr) {
        console.error('[folha-validator] Erro ao criar run:', insertErr.message)
      } else {
        openKeys.add(dedupeKey)
        created++
      }
    }
  }

  if (created > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendDiscordMessage('orquestrador', {
      title: 'Folha Validator',
      description: `${created} anomalia(s) detectada(s) na folha de ${competencia.slice(0, 7)}.\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0xE74C3C,
    })
  }

  return { created }
}
