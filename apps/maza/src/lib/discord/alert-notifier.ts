// Alert notifier — sends MARENA operational alerts to Discord #orquestrador.
// Call notifyAlert() wherever a maza_alerts row is inserted.
// TODO: wire this to maza_alerts insert points once the table has active writers.

import { sendDiscordMessage, DISCORD_COLORS } from './notify'

type AlertSeverity = 'critical' | 'warning'

type AlertPayload = {
  brand_name: string
  description: string
  severity: AlertSeverity
  module: string
}

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { emoji: string; color: number; label: string }
> = {
  critical: { emoji: '🚨', color: DISCORD_COLORS.red,   label: 'Crítico' },
  warning:  { emoji: '⚠️', color: DISCORD_COLORS.amber, label: 'Atenção' },
}

export async function notifyAlert({
  brand_name,
  description,
  severity,
  module,
}: AlertPayload): Promise<void> {
  const { emoji, color, label } = SEVERITY_CONFIG[severity]

  await sendDiscordMessage('orquestrador', {
    title: `${emoji} Alerta ${label} — ${brand_name}`,
    description,
    color,
    fields: [
      { name: 'Marca',   value: brand_name, inline: true },
      { name: 'Módulo',  value: module,     inline: true },
      { name: 'Severity', value: label,     inline: true },
    ],
    timestamp: new Date().toISOString(),
  })
}
