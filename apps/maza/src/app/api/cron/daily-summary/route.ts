// Vercel Cron endpoint — Daily KPI summary → Discord #general.
// Schedule: 0 12 * * * (every day at 12:00 UTC = 09:00 BRT)
// Configured in vercel.json at the repo root.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage, DISCORD_COLORS } from '@/lib/discord/notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET ?? ''}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  try {
    // Fetch KPI data in parallel
    const [dreRes, headcountRes, eventosRes, alertasRes] = await Promise.allSettled([
      (supabase as any)
        .from('v_dre_consolidado')
        .select('marca, receita_bruta, cmv, ebitda')
        .order('receita_bruta', { ascending: false })
        .limit(5),
      (supabase as any)
        .from('v_headcount_por_marca')
        .select('marca, total_colaboradores, total_ativos'),
      (supabase as any)
        .from('v_eventos_kpi')
        .select('evento, criado_em')
        .order('criado_em', { ascending: false })
        .limit(3),
      (supabase as any)
        .from('v_alertas')
        .select('severity, count')
        .eq('status', 'open'),
    ])

    const dreData = dreRes.status === 'fulfilled' ? (dreRes.value.data ?? []) : []
    const headcountData = headcountRes.status === 'fulfilled' ? (headcountRes.value.data ?? []) : []
    const eventosData = eventosRes.status === 'fulfilled' ? (eventosRes.value.data ?? []) : []
    const alertasData = alertasRes.status === 'fulfilled' ? (alertasRes.value.data ?? []) : []

    // Build embed fields
    const fields: { name: string; value: string; inline?: boolean }[] = []

    // Receita by brand (top 3)
    if (dreData.length > 0) {
      const receitaLines = dreData
        .slice(0, 3)
        .map((r: any) => {
          const receita = r.receita_bruta != null
            ? `R$${Number(r.receita_bruta).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
            : 'N/A'
          return `${r.marca}: ${receita}`
        })
        .join('\n')
      fields.push({ name: '💰 Receita (top marcas)', value: receitaLines, inline: false })
    }

    // Headcount total
    if (headcountData.length > 0) {
      const totalAtivos = headcountData.reduce((sum: number, r: any) => sum + (r.total_ativos ?? 0), 0)
      const totalColaboradores = headcountData.reduce((sum: number, r: any) => sum + (r.total_colaboradores ?? 0), 0)
      fields.push({
        name: '👥 Headcount',
        value: `${totalAtivos} ativos / ${totalColaboradores} total`,
        inline: true,
      })
    }

    // Open alerts
    if (alertasData.length > 0) {
      const criticalCount = alertasData.find((a: any) => a.severity === 'critical')?.count ?? 0
      const warningCount  = alertasData.find((a: any) => a.severity === 'warning')?.count  ?? 0
      fields.push({
        name: '🚨 Alertas abertos',
        value: `${criticalCount} críticos · ${warningCount} atenção`,
        inline: true,
      })
    }

    // Recent events
    if (eventosData.length > 0) {
      const eventosLines = eventosData
        .map((e: any) => `• ${e.evento}`)
        .join('\n')
      fields.push({ name: '📅 Eventos recentes', value: eventosLines, inline: false })
    }

    if (fields.length === 0) {
      fields.push({ name: 'Status', value: 'Sem dados disponíveis para hoje.', inline: false })
    }

    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    await sendDiscordMessage('general', {
      title: `📊 Marena — Resumo ${today}`,
      color: DISCORD_COLORS.blue,
      fields,
      footer: { text: 'Marena · Resumo Diário Automático' },
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, fields_sent: fields.length })
  } catch (e) {
    console.error('[cron/daily-summary] error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
