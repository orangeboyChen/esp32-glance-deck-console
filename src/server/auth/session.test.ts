import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

/**
 * The session cache is only reachable through `next/headers`, so it is driven from a subprocess
 * against a real SQLite database, matching the existing database-initializer test. The subprocess
 * mocks `next/headers` to supply the session cookie that would normally arrive on the request.
 */
const script = `
  import { mock } from 'bun:test'

  let cookieValue
  mock.module('next/headers', () => ({
    cookies: async () => ({ get: () => (cookieValue ? { name: 'session', value: cookieValue } : undefined), set: () => {}, delete: () => {} }),
  }))

  const { currentAdministrator, clearSession } = await import('./src/server/auth/session')
  const { initializeDatabase } = await import('./src/server/database/database-initializer')
  await initializeDatabase()
  const { db } = await import('./src/server/database/db')
  const { administrators, sessions } = await import('./src/server/database/schema')
  const argon2 = (await import('argon2')).default
  const { randomBytes } = await import('node:crypto')

  const [administrator] = await db.insert(administrators).values({ email: 'owner@example.com', password_hash: 'hash' }).returning()
  const selector = randomBytes(12).toString('base64url')
  const secret = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    administrator_id: administrator.id,
    token_selector: selector,
    token_hash: await argon2.hash(secret, { type: argon2.argon2id }),
    expires_at: new Date(Date.now() + 60_000),
  })

  const timings = []
  const resolveRepeatedly = async (count) => {
    for (let index = 0; index < count; index += 1) {
      const started = performance.now()
      const resolved = await currentAdministrator()
      timings.push({ ms: performance.now() - started, id: resolved?.id ?? null })
    }
  }

  const noCookie = await currentAdministrator()

  cookieValue = selector + '.' + secret
  const first = await currentAdministrator()
  // The first lookup must actually verify the Argon2 hash; later ones should be served from cache.
  await resolveRepeatedly(5)

  await clearSession()
  const afterLogout = await currentAdministrator()

  console.log(JSON.stringify({
    noCookie: noCookie?.id ?? null,
    firstId: first?.id ?? null,
    ids: timings.map((entry) => entry.id),
    slowestMs: Math.max(...timings.map((entry) => entry.ms)),
    afterLogout: afterLogout?.id ?? null,
  }))
`

describe('session verification cache', () => {
  test('reuses a verified session and drops it on logout', () => {
    const directory = mkdtempSync(join(tmpdir(), 'glance-deck-session-'))
    const databaseUrl = `sqlite:${join(directory, 'console.db')}`
    try {
      const result = spawnSync('bun', ['--bun', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
      })
      if (result.status !== 0) {
        throw new Error(result.error?.message ?? result.stderr.toString())
      }
      const output = JSON.parse(result.stdout.toString())
      expect(output.noCookie).toBeNull()
      expect(output.firstId).toBeTruthy()
      // Repeat lookups are served from the cache, so they must not pay for Argon2 again.
      expect(output.slowestMs).toBeLessThan(5)
      expect(new Set(output.ids).size).toBe(1)
      expect(output.ids[0]).toBe(output.firstId)
      // Revocation is immediate: the cached entry is purged along with the session row.
      expect(output.afterLogout).toBeNull()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
