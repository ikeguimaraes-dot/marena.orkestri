import { listInsights } from "@/lib/orquestrador/actions"
import { InsightsClient } from "./InsightsClient"

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
  const insights = await listInsights()

  return (
    <div className="flex-1 p-8 pt-6">
      <InsightsClient initialInsights={insights} />
    </div>
  )
}
