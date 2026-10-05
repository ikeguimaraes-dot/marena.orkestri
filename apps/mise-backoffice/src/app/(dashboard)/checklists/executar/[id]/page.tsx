import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ExecucaoClient } from './_components/execucao-client'

export default async function ExecutarChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: executionId } = await params
  const supabase = createServiceClient()

  const { data: execucao, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('*')
    .eq('id', executionId)
    .single()

  if (error || !execucao) notFound()
  if (execucao.status === 'concluido') {
    // Already done - redirect to report
    const { redirect } = await import('next/navigation')
    redirect(`/checklists/historico/${executionId}`)
  }

  const { data: template } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .select('*')
    .eq('id', execucao.template_id)
    .single()

  const { data: items } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', execucao.template_id)
    .order('ordem')

  const { data: existingRespostas } = await supabase
    .schema('mise')
    .from('checklist_responses')
    .select('*')
    .eq('execution_id', executionId)

  return (
    <ExecucaoClient
      executionId={executionId}
      templateNome={template?.nome ?? 'Checklist'}
      items={items ?? []}
      existingRespostas={existingRespostas ?? []}
    />
  )
}
