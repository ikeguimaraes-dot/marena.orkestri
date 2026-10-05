import { createServiceClient } from '@/lib/supabase/server'
import { PinLoginClient } from './_components/pin-login-client'

export default async function PinLoginPage() {
  const supabase = createServiceClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, nome')
    .eq('ativo', true)
    .eq('mise_ativo', true)
    .order('nome')

  const { data: pinsData } = await supabase
    .schema('mise')
    .from('user_pins')
    .select('employee_id')

  const employeesWithPin = new Set(pinsData?.map(p => p.employee_id) ?? [])
  const filtered = (employees ?? []).filter(e => employeesWithPin.has(e.id))

  return <PinLoginClient employees={filtered} />
}
