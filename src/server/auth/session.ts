import { randomBytes } from 'node:crypto'

import argon2 from 'argon2'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from '@/server/database/db'
import { administrators, sessions } from '@/server/database/schema'

const sessionCookieName = '__Host-glance_deck_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30

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

export const currentAdministrator = async () => {
  if (!db) {
    return undefined
  }
  const token = (await cookies()).get(sessionCookieName)?.value
  if (!token) {
    return undefined
  }
  const [tokenSelector, tokenSecret] = token.split('.')
  if (!tokenSelector || !tokenSecret || token.split('.').length !== 2) {
    return undefined
  }

  const [candidate] = await db
    .select({ session_id: sessions.id, token_hash: sessions.token_hash, administrator: administrators })
    .from(sessions)
    .innerJoin(administrators, eq(sessions.administrator_id, administrators.id))
    .where(and(eq(sessions.token_selector, tokenSelector), gt(sessions.expires_at, new Date())))
    .limit(1)

  return candidate && (await argon2.verify(candidate.token_hash, tokenSecret)) ? candidate.administrator : undefined
}

export const clearSession = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  const [tokenSelector, tokenSecret, extraPart] = token?.split('.') ?? []
  if (db && tokenSelector && tokenSecret && !extraPart) {
    await db.delete(sessions).where(eq(sessions.token_selector, tokenSelector))
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
