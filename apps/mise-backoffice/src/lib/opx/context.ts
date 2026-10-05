import { getMiseSession } from '@/lib/session'

export interface OpxContext {
  unitId: string
  actorId: string   // employees.id — nunca auth.users.id
  actorName: string
  role: 'admin' | 'gerente' | 'cozinheiro'
}

// Resolve contexto OPX a partir da sessão ativa (gestor Auth ou PIN).
// Retorna null se não houver sessão — cada módulo decide como reagir.
// Não redireciona, não lança.
export async function getOpxContext(unitId: string): Promise<OpxContext | null> {
  const session = await getMiseSession()
  if (!session) return null
  return {
    unitId,
    actorId: session.employeeId,
    actorName: session.employeeName,
    role: session.role,
  }
}
