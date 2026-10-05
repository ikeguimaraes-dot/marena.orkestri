import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const REQUIRED_COLUMNS = ['Item', 'Descrição do Item', 'UM', 'Grande Grupo']

const GRUPOS = [
  { name: 'PRODUCAO ALIMENTOS', slug: 'producao-alimentos' },
  { name: 'PRODUCAO BEBIDAS', slug: 'producao-bebidas' },
]

// Mesmo conjunto do CHECK constraint de ingredients.unidade_padrao — uma UM fora
// desse conjunto quebraria o insert em lote inteiro, então é filtrada antes.
const UNIDADES_VALIDAS = ['kg', 'g', 'l', 'ml', 'un', 'cx', 'fardo', 'duzia']

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'A planilha não tem nenhuma aba.' }, { status: 400 })
    }

    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) as unknown[][]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia.' }, { status: 400 })
    }

    const headers = rows[0].map(h => String(h ?? '').trim())
    const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Colunas obrigatórias ausentes na planilha: ${missing.join(', ')}.` },
        { status: 400 }
      )
    }

    const dataRows = rows.slice(1)
    const total_planilha = dataRows.length

    if (total_planilha === 0) {
      return NextResponse.json({ error: 'Planilha sem nenhuma linha de dados.' }, { status: 400 })
    }

    const idxItem = headers.indexOf('Item')
    const idxNome = headers.indexOf('Descrição do Item')
    const idxUm = headers.indexOf('UM')
    const idxGrupo = headers.indexOf('Grande Grupo')

    const supabase = createServiceClient()

    // Garante que os grupos de destino existam (cria se faltar)
    const { data: existingGroups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
      .in('name', GRUPOS.map(g => g.name))

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 400 })
    }

    const groupIdByName: Record<string, string> = Object.fromEntries(
      (existingGroups ?? []).map(g => [g.name, g.id])
    )

    for (const g of GRUPOS) {
      if (!groupIdByName[g.name]) {
        const { data: created, error: createError } = await supabase
          .from('groups')
          .insert({ name: g.name, slug: g.slug })
          .select('id')
          .single()
        if (createError) {
          return NextResponse.json(
            { error: `Erro ao criar grupo ${g.name}: ${createError.message}` },
            { status: 400 }
          )
        }
        groupIdByName[g.name] = created.id
      }
    }

    const alimentosId = groupIdByName['PRODUCAO ALIMENTOS']
    const bebidasId = groupIdByName['PRODUCAO BEBIDAS']

    // Monta as linhas válidas: pula codigo/nome vazios e UM inválida, dedup por
    // codigo (mantém a última ocorrência caso a planilha repita um Item).
    let ignorados = 0
    const porCodigo = new Map<
      string,
      { codigo: string; nome: string; unidade_padrao: string; group_id: string }
    >()

    for (const row of dataRows) {
      const codigo = String(row[idxItem] ?? '').trim()
      const nome = String(row[idxNome] ?? '').trim()
      const unidade_padrao = String(row[idxUm] ?? '').trim().toLowerCase()
      const grandeGrupo = String(row[idxGrupo] ?? '').trim().toUpperCase()

      if (!codigo || !nome || !UNIDADES_VALIDAS.includes(unidade_padrao)) {
        ignorados++
        continue
      }

      if (porCodigo.has(codigo)) ignorados++
      porCodigo.set(codigo, {
        codigo,
        nome,
        unidade_padrao,
        group_id: grandeGrupo === 'BEBIDAS' ? bebidasId : alimentosId,
      })
    }

    const validRows = Array.from(porCodigo.values())

    // Busca todos os codigos existentes de uma vez, para decidir insert vs update
    // em memória (evita uma query por produto).
    const { data: existing, error: existingError } = await supabase
      .from('ingredients')
      .select('id, codigo')
      .not('codigo', 'is', null)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    const idByCodigo = new Map((existing ?? []).map(e => [e.codigo as string, e.id as string]))

    const toInsert = validRows
      .filter(r => !idByCodigo.has(r.codigo))
      .map(r => ({
        codigo: r.codigo,
        nome: r.nome,
        unidade_padrao: r.unidade_padrao,
        group_id: r.group_id,
        categoria: 'outro',
        custo_padrao: 0,
        ativo: true,
      }))

    const toUpdate = validRows.filter(r => idByCodigo.has(r.codigo))

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('ingredients').insert(toInsert)
      if (insertError) {
        return NextResponse.json({ error: `Erro ao inserir produtos: ${insertError.message}` }, { status: 400 })
      }
    }

    if (toUpdate.length > 0) {
      // Update por linha (não upsert): o upsert reescreveria a linha inteira e
      // violaria o NOT NULL de categoria/custo_padrao/ativo, que não vêm da
      // planilha. Assim só nome/unidade_padrao/group_id são tocados, preservando
      // o resto do cadastro existente.
      const updateResults = await Promise.all(
        toUpdate.map(r =>
          supabase
            .from('ingredients')
            .update({ nome: r.nome, unidade_padrao: r.unidade_padrao, group_id: r.group_id })
            .eq('id', idByCodigo.get(r.codigo)!)
        )
      )
      const failed = updateResults.find(r => r.error)
      if (failed?.error) {
        return NextResponse.json({ error: `Erro ao atualizar produtos: ${failed.error.message}` }, { status: 400 })
      }
    }

    return NextResponse.json({
      inseridos: toInsert.length,
      atualizados: toUpdate.length,
      ignorados,
      total_planilha,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro desconhecido.'
    return NextResponse.json({ error: `Falha ao processar o arquivo: ${message}` }, { status: 400 })
  }
}
