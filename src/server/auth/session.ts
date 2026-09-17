import { randomBytes, createHash } from 'node:crypto'

import argon2 from 'argon2'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from '@/server/database/db'
import { administrators, sessions } from '@/server/database/schema'

const sessionCookieName = '__Host-glance_deck_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30

/**
 * Argon2 verification costs tens of milliseconds of blocking CPU, and the console pays it on every
 * authenticated request: once to render a page and again for each API call the page makes on mount.
 * A single tab switch therefore pays it several times over. Verified tokens are memoised briefly so
 * the cost is incurred once per token per window instead of once per request.
 *
 * This cache holds *only* the outcome of the Argon2 comparison, never the authority to accept a
 * session. Every request still reads the session row from the shared database, so revocation on one
 * replica takes effect on all of them immediately — the cache is what lets a replica skip the
 * password hashing, not what lets it skip the database. Storing the Argon2 result also means a
 * cache hit exposes nothing reusable to anyone who can read process memory: the key is a SHA-256
 * digest of the presented token, and the Argon2 hash itself is held only in the database.
 */
const verifiedSessionTtlMs = 30_000
const verifiedSessionCacheMaxEntries = 1000
const verifiedSessionCache = new Map<string, { tokenHash: string; expiresAt: number }>()

const cacheKeyFor = (token: string) => createHash('sha256').update(token).digest('hex')

const rememberVerifiedSession = (cacheKey: string, tokenHash: string, expiresAtMs: number) => {
  // Map iterates in insertion order, so the first key is the oldest entry: this evicts the
  // least-recently-seen session first, bounding the cache without a second data structure.
  if (verifiedSessionCache.size >= verifiedSessionCacheMaxEntries) {
    const oldestKey = verifiedSessionCache.keys().next()
    if (!oldestKey.done) {
      verifiedSessionCache.delete(oldestKey.value)
    }
  }
  verifiedSessionCache.set(cacheKey, { tokenHash, expiresAt: expiresAtMs })
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

/**
 * A throwaway Argon2id hash verified when no administrator matches the submitted email. Without it an
 * unknown email returns after a single indexed query while a known one pays a full Argon2
 * verification, and that difference is large enough to time remotely and enumerate accounts. The
 * digest is public and matches nobody, so it only ever costs time.
 */
let decoyPasswordHash: string | undefined
const decoyHash = async () => {
  decoyPasswordHash ??= await argon2.hash('glance-deck-decoy-password', { type: argon2.argon2id })
  return decoyPasswordHash
}

export const authenticateAdministrator = async (email: string, password: string) => {
  if (!db) {
    return undefined
  }
  const [administrator] = await db.select().from(administrators).where(eq(administrators.email, email)).limit(1)
  const passwordMatches = await argon2.verify(administrator?.password_hash ?? (await decoyHash()), password)
  if (!administrator || !passwordMatches) {
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

  // The session row is read from the shared database on every request, so a session revoked on any
  // replica stops working everywhere at once. Only the Argon2 comparison below is cached.
  const [candidate] = await db
    .select({ token_hash: sessions.token_hash, expires_at: sessions.expires_at, administrator: administrators })
    .from(sessions)
    .innerJoin(administrators, eq(sessions.administrator_id, administrators.id))
    .where(and(eq(sessions.token_selector, tokenSelector), gt(sessions.expires_at, new Date())))
    .limit(1)

  if (!candidate) {
    verifiedSessionCache.delete(cacheKey)
    return undefined
  }

  const cached = verifiedSessionCache.get(cacheKey)
  const isVerified =
    cached && cached.expiresAt > Date.now() && cached.tokenHash === candidate.token_hash
      ? true
      : await argon2.verify(candidate.token_hash, tokenSecret)
  if (!isVerified) {
    verifiedSessionCache.delete(cacheKey)
    return undefined
  }
  rememberVerifiedSession(cacheKey, candidate.token_hash, Math.min(Date.now() + verifiedSessionTtlMs, candidate.expires_at.getTime()))
  return candidate.administrator
}

export const clearSession = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  const [tokenSelector, tokenSecret, extraPart] = token?.split('.') ?? []
  if (db && tokenSelector && tokenSecret && !extraPart) {
    // Verify the secret before deleting: the selector alone is not a bearer token, so allowing it to
    // revoke the row would let anyone who learns a selector (a log, a leaked backup) log the
    // administrator out.
    const [session] = await db
      .select({ token_hash: sessions.token_hash })
      .from(sessions)
      .where(eq(sessions.token_selector, tokenSelector))
      .limit(1)
    if (session && (await argon2.verify(session.token_hash, tokenSecret).catch(() => false))) {
      await db.delete(sessions).where(eq(sessions.token_selector, tokenSelector))
    }
  }
  // Deleting the shared row is what revokes the session; the local purge is only belt-and-braces,
  // since lookups consult the database on every request anyway.
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
