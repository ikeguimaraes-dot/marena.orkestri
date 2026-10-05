import { createHash, timingSafeEqual } from 'node:crypto'

export type IntegrationAuthResult =
  | { ok: true; allowedUnits: Set<string> }
  | { ok: false; reason: 'invalid_token' | 'misconfigured' }

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function configuredHashes(): Buffer[] {
  return [
    process.env.KPH_INTEGRATION_API_KEY_HASH,
    process.env.KPH_INTEGRATION_NEXT_API_KEY_HASH,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      try {
        const hash = Buffer.from(value.trim(), 'hex')
        return hash.length === 32 ? [hash] : []
      } catch {
        return []
      }
    })
}

export function authenticateKphIntegration(authorization: string | null): IntegrationAuthResult {
  const hashes = configuredHashes()
  if (hashes.length === 0) return { ok: false, reason: 'misconfigured' }

  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i)
  if (!match || !match[1]) return { ok: false, reason: 'invalid_token' }

  const candidate = sha256(match[1])
  let valid = false
  for (const hash of hashes) valid = timingSafeEqual(candidate, hash) || valid
  if (!valid) return { ok: false, reason: 'invalid_token' }

  const allowed = (process.env.KPH_INTEGRATION_ALLOWED_UNITS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return { ok: true, allowedUnits: new Set(allowed) }
}
