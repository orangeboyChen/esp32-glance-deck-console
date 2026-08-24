import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'
import { ApiRouteError, apiRoute, noContentResponse } from '@/lib/api-response'

type TokenRouteContext = { params: Promise<{ token_id: string }> }

export const DELETE = apiRoute<null, TokenRouteContext>(async (request, context) => {
  void request
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const { token_id: tokenId } = await context.params
  const [token] = await db
    .update(apiTokens)
    .set({ revoked_at: new Date() })
    .where(and(eq(apiTokens.id, tokenId), isNull(apiTokens.revoked_at)))
    .returning({ id: apiTokens.id })
  if (!token) {
    throw new ApiRouteError('token_not_found', 404)
  }
  return noContentResponse()
})
