// Discord webhook notifications — two-channel embed support.
// Channels: 'orquestrador' (ops alerts, LM reports, deploys) | 'general' (KPI summaries)
// Fails silently — never throws, never blocks caller.

export type DiscordEmbed = {
  title: string
  description?: string
  color: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

// Semantic color palette
export const DISCORD_COLORS = {
  green:  0x2ECC71,
  red:    0xE74C3C,
  amber:  0xF39C12,
  blue:   0x3498DB,
  purple: 0x9B59B6,
} as const

const WEBHOOK_ENV: Record<'orquestrador' | 'general', string> = {
  orquestrador: 'DISCORD_WEBHOOK_ORQUESTRADOR',
  general:      'DISCORD_WEBHOOK_GENERAL',
}

export async function sendDiscordMessage(
  channel: 'orquestrador' | 'general',
  embed: DiscordEmbed,
): Promise<void> {
  const url = process.env[WEBHOOK_ENV[channel]]
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
  } catch (e) {
    console.error(`[discord] sendDiscordMessage(${channel}) failed:`, e)
  }
}
