import { and, eq } from 'drizzle-orm'

import { currentAdministrator } from '@/server/auth/session'
import { db } from '@/server/database/db'
import { passkeys } from '@/server/database/schema'
import { ApiRouteError, apiRoute } from '@/lib/api-response'

type PasskeyRouteContext = { params: Promise<{ passkey_id: string }> }

export const DELETE = apiRoute<null, PasskeyRouteContext>(async (request, context) => {
  void request
  const administrator = await currentAdministrator()
  if (!administrator) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  const { passkey_id: passkeyId } = await context.params
  const [removed] = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.administrator_id, administrator.id)))
    .returning({ id: passkeys.id })
  if (!removed) {
    throw new ApiRouteError('passkey_not_found', 404)
  }
  return { data: null, init: { status: 204 } }
})
