import { getMiseSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'

export type AuthResult =
  | { ok: true; employeeId: string; role: 'admin' | 'gerente' }
  | { ok: false; status: 401 | 403; message: string }

export async function canAccessUnit(unitId: string): Promise<AuthResult> {
  const session = await getMiseSession()
  if (!session) return { ok: false, status: 401, message: 'Não autenticado.' }

  if (session.role === 'cozinheiro') {
    return { ok: false, status: 403, message: 'Cozinheiros não têm acesso ao relatório diário.' }
  }

  if (session.role === 'admin') {
    return { ok: true, employeeId: session.employeeId, role: 'admin' }
  }

  // gerente: verificar se o unit_id corresponde à unidade do funcionário
  const supabase = createServiceClient()
  const { data: emp } = await supabase
    .from('employees')
    .select('unit_id')
    .eq('id', session.employeeId)
    .single()

  if (!emp || emp.unit_id !== unitId) {
    return { ok: false, status: 403, message: 'Sem permissão para esta unidade.' }
  }

  return { ok: true, employeeId: session.employeeId, role: 'gerente' }
}
