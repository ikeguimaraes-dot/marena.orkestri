import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const execution_id = formData.get('execution_id') as string | null
  const item_id = formData.get('item_id') as string | null

  if (!file || !execution_id || !item_id) {
    return NextResponse.json({ error: 'file, execution_id e item_id são obrigatórios' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const timestamp = Date.now()
  const path = `${execution_id}/${item_id}/${timestamp}.${ext}`

  const supabase = createServiceClient()
  const { error: uploadError } = await supabase.storage
    .from('checklist-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('checklist-photos')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
