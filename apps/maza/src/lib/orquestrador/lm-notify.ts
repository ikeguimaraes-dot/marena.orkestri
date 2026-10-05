// Notifier Discord para a Learning Machine (@maza/core).
// O core gera o relatório; este módulo decide como o shell anuncia.

import type { LMNotifyPayload } from "@maza/core/learning-machine";
import { sendDiscordMessage, DISCORD_COLORS } from "@/lib/discord/notify";

export async function notifyLearningMachineDiscord(p: LMNotifyPayload): Promise<void> {
  await sendDiscordMessage("orquestrador", {
    title: `🧠 Learning Machine — Semana ${p.week}/${p.year}`,
    description: p.insights
      ? `${p.insights.headline}\n\n${p.insights.insight_da_semana}`
      : `Relatório semanal gerado. ${p.activeAgents} agentes ativos de ${p.totalAgents}.`,
    color: DISCORD_COLORS.purple,
    fields: [
      {
        name: "Score Operacional",
        value: p.insights?.score_operacional != null ? `${p.insights.score_operacional}/100` : "N/A",
        inline: true,
      },
      { name: "Agentes Ativos", value: `${p.activeAgents}/${p.totalAgents}`, inline: true },
      { name: "Agentes Dormentes", value: `${p.dormantCount}`, inline: true },
    ],
    footer: { text: "Próximo relatório: sexta-feira 08:00 BRT" },
    timestamp: new Date().toISOString(),
  });
}
