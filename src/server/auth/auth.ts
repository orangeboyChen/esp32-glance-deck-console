import { createHash, randomBytes } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'

export const hashSecret = (secret: string) => {
  return createHash('sha256').update(secret).digest('hex')
}

export const createApiToken = () => {
  return `gld_${randomBytes(32).toString('base64url')}`
}

export const requireApiScope = async (request: Request, requiredScope: string) => {
  if (await currentAdministrator()) return true
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

  if (!token || !db) return false

  const [apiToken] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token_hash, hashSecret(token)), isNull(apiTokens.revoked_at)))
    .limit(1)

  return Boolean(apiToken?.scopes.includes(requiredScope))
}
