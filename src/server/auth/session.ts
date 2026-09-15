import { randomBytes, createHash } from 'node:crypto'

import argon2 from 'argon2'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from '@/server/database/db'
import { administrators, sessions } from '@/server/database/schema'

const sessionCookieName = '__Host-glance_deck_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30

type Administrator = typeof administrators.$inferSelect

/**
 * Argon2 verification costs tens of milliseconds of blocking CPU, and the console pays it on every
 * authenticated request: once to render a page and again for each API call the page makes on mount.
 * A single tab switch therefore pays it several times over. Verified tokens are memoised briefly so
 * the cost is incurred once per token per window instead of once per request.
 *
 * Only tokens that already passed Argon2 verification against the database in this process are
 * cached, and the key is a SHA-256 digest of the presented token rather than the token itself, so a
 * cache hit exposes nothing reusable to anyone who can read process memory. Entries never outlive
 * the underlying session row, and `clearSession` purges the entry before clearing the cookie, so
 * logout and revocation still take effect immediately.
 */
const verifiedSessionTtlMs = 30_000
const verifiedSessionCacheMaxEntries = 1000
const verifiedSessionCache = new Map<string, { administrator: Administrator; expiresAt: number }>()

const cacheKeyFor = (token: string) => createHash('sha256').update(token).digest('hex')

const rememberVerifiedSession = (cacheKey: string, administrator: Administrator, expiresAtMs: number) => {
  // Map iterates in insertion order, so the first key is the oldest entry: this evicts the
  // least-recently-seen session first, bounding the cache without a second data structure.
  if (verifiedSessionCache.size >= verifiedSessionCacheMaxEntries) {
    const oldestKey = verifiedSessionCache.keys().next()
    if (!oldestKey.done) {
      verifiedSessionCache.delete(oldestKey.value)
    }
  }
  verifiedSessionCache.set(cacheKey, { administrator, expiresAt: expiresAtMs })
}

export const administratorExists = async () => {
  if (!db) {
    return false
  }
  const [administrator] = await db.select({ id: administrators.id }).from(administrators).limit(1)
  return Boolean(administrator)
}

export const createInitialAdministrator = async (email: string, password: string) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })

  return db.transaction(async (transaction) => {
    const [existingAdministrator] = await transaction.select({ id: administrators.id }).from(administrators).limit(1)
    if (existingAdministrator) {
      throw new Error('administrator_exists')
    }

    const [administrator] = await transaction.insert(administrators).values({ email, password_hash: passwordHash }).returning()
    return administrator
  })
}

export const authenticateAdministrator = async (email: string, password: string) => {
  if (!db) {
    return undefined
  }
  const [administrator] = await db.select().from(administrators).where(eq(administrators.email, email)).limit(1)
  if (!administrator || !(await argon2.verify(administrator.password_hash, password))) {
    return undefined
  }
  return administrator
}

export const createSession = async (administratorId: string) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const tokenSelector = randomBytes(12).toString('base64url')
  const tokenSecret = randomBytes(32).toString('base64url')
  const tokenHash = await argon2.hash(tokenSecret, { type: argon2.argon2id })
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  await db
    .insert(sessions)
    .values({ administrator_id: administratorId, token_selector: tokenSelector, token_hash: tokenHash, expires_at: expiresAt })

  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName, `${tokenSelector}.${tokenSecret}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    expires: expiresAt,
    path: '/',
  })
}

const readSessionToken = async () => {
  const token = (await cookies()).get(sessionCookieName)?.value
  if (!token) {
    return undefined
  }
  const [tokenSelector, tokenSecret] = token.split('.')
  if (!tokenSelector || !tokenSecret || token.split('.').length !== 2) {
    return undefined
  }
  return { token, tokenSecret, tokenSelector }
}

export const currentAdministrator = async () => {
  if (!db) {
    return undefined
  }
  const sessionToken = await readSessionToken()
  if (!sessionToken) {
    return undefined
  }
  const { token, tokenSecret, tokenSelector } = sessionToken

  const cacheKey = cacheKeyFor(token)
  const cached = verifiedSessionCache.get(cacheKey)
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.administrator
    }
    verifiedSessionCache.delete(cacheKey)
  }

  const [candidate] = await db
    .select({
      session_id: sessions.id,
      token_hash: sessions.token_hash,
      expires_at: sessions.expires_at,
      administrator: administrators,
    })
    .from(sessions)
    .innerJoin(administrators, eq(sessions.administrator_id, administrators.id))
    .where(and(eq(sessions.token_selector, tokenSelector), gt(sessions.expires_at, new Date())))
    .limit(1)

  if (!candidate || !(await argon2.verify(candidate.token_hash, tokenSecret))) {
    return undefined
  }

  const sessionExpiryMs = candidate.expires_at.getTime()
  const cacheExpiryMs = Math.min(Date.now() + verifiedSessionTtlMs, sessionExpiryMs)
  if (cacheExpiryMs > Date.now()) {
    rememberVerifiedSession(cacheKey, candidate.administrator, cacheExpiryMs)
  }
  return candidate.administrator
}

export const clearSession = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  const [tokenSelector, tokenSecret, extraPart] = token?.split('.') ?? []
  if (db && tokenSelector && tokenSecret && !extraPart) {
    await db.delete(sessions).where(eq(sessions.token_selector, tokenSelector))
  }
  // Purge before clearing the cookie so a concurrent request can never be served from the cache
  // once the session row is gone.
  if (token) {
    verifiedSessionCache.delete(cacheKeyFor(token))
  }
  cookieStore.delete(sessionCookieName)
}

export const requirePageAdministrator = async () => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    redirect('/login')
  }
  return administrator
}
