'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">MISE</h1>
          <p className="mt-1 text-sm text-ink-muted">MARENA</p>
          <p className="mt-1 text-sm text-ink-muted">Acesso de gestores do MARENA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-alert-bright">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-faint">
          Cozinheiros usam o{' '}
          <a href="/pin-login" className="text-ink-muted underline">login por PIN</a>
        </p>
      </div>
    </div>
  )
}
