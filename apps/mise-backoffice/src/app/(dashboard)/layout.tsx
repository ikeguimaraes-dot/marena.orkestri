import { TopNav } from '@/components/layout/topnav'
import { createClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import '@/components/mise/mise.css'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let role: 'admin' | 'gerente' | 'cozinheiro' = 'admin'
  let isPinUser = false

  // Local preview only. Configured deployments keep the existing authentication flow.
  const demo = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (demo) return (
    <div className="mise-dashboard">
      <TopNav demo employeeName="Ana Costa" />
      <main className="mise-main" id="main-content">{children}</main>
    </div>
  )

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const session = await getMiseSession()
    if (session) {
      role = session.role
      isPinUser = true
    }
  }

  return (
    <div className="mise-dashboard">
      <TopNav role={role} isPinUser={isPinUser} />
      <main className="mise-main" id="main-content">
        {children}
      </main>
    </div>
  )
}
