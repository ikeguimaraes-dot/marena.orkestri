'use client'

import { useTransition } from 'react'

type Props = {
  jobId: string
  jobType: string
  approveAction: (jobId: string) => Promise<{ success: boolean; action_taken: string; message: string }>
}

export function ApproveJobButton({ jobId, jobType, approveAction }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approveAction(jobId)
    })
  }

  return (
    <button
      onClick={handleApprove}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 py-1.5 text-xs"
      aria-label={`Aprovar job ${jobType}`}
    >
      {isPending ? '…' : '✓ Aprovar'}
    </button>
  )
}
