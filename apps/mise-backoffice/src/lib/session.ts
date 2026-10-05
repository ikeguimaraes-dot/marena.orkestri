import { cookies } from 'next/headers'
import { createClient, createServiceClient } from './supabase/server'

export type MiseSession = {
  sessionId: string
  employeeId: string
  employeeName: string
  role: 'admin' | 'gerente' | 'cozinheiro'
}

// Gestores autenticados via Supabase Auth (email/senha).
// Tenta primeiro; se não há sessão Auth, retorna null para o fallback PIN.
async function getGestorSession(): Promise<MiseSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: employee } = await service
    .from('employees')
    .select('id, nome, role_id')
    .eq('user_id', user.id)
    .single()

  if (!employee) return null

  let role: 'admin' | 'gerente' = 'gerente'
  if (employee.role_id) {
    const { data: roleData } = await service
      .from('roles')
      .select('name, permissions')
      .eq('id', employee.role_id)
      .single()
    if (roleData) {
      const perms = roleData.permissions as string[]
      if (perms.includes('*') || roleData.name === 'founder') role = 'admin'
    }
  }

  return {
    sessionId: user.id,
    employeeId: employee.id,
    employeeName: employee.nome ?? 'Gestor',
    role,
  }
}

export async function getMiseSession(): Promise<MiseSession | null> {
  // 1. Tenta sessão de gestor (Supabase Auth)
  const gestorSession = await getGestorSession()
  if (gestorSession) return gestorSession

  // 2. Fallback: sessão de PIN (cozinheiros / funcionários de piso)
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('mise-session')?.value
  if (!sessionId) return null

  const supabase = createServiceClient()
  const { data: session } = await supabase
    .schema('mise')
    .from('sessions')
    .select('id, employee_id, role, expires_at')
    .eq('id', sessionId)
    .single()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  const { data: employee } = await supabase
    .from('employees')
    .select('nome')
    .eq('id', session.employee_id)
    .single()

  return {
    sessionId: session.id,
    employeeId: session.employee_id,
    employeeName: employee?.nome ?? 'Funcionário',
    role: session.role as 'admin' | 'gerente' | 'cozinheiro',
  }
}
