import { eq } from 'drizzle-orm'

import { currentAdministrator } from '@/server/auth/session'
import { db } from '@/server/database/db'
import { passkeys } from '@/server/database/schema'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { ListPasskeysResponse } from '@/lib/api-contracts'

export const GET = apiRoute(async () => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const records = await db
    .select({ id: passkeys.id, created_at: passkeys.created_at, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.administrator_id, administrator.id))
    .orderBy(passkeys.created_at)
  const response: ListPasskeysResponse = {
    passkeys: records.map((record) => ({ ...record, created_at: record.created_at.toISOString() })),
  }
  return { data: response }
})
