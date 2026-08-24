import { createApiToken, hashSecret } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'
import { desc, isNull } from 'drizzle-orm'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import type { CreateTokenResponse, ListTokensResponse, TokenRequest } from '@/lib/api-contracts'
import { tokenRequestSchema } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  return requestJson<TokenRequest, CreateTokenResponse>(tokenRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const token = createApiToken()
    const [record] = await db
      .insert(apiTokens)
      .values({ label: payload.label, token_hash: hashSecret(token), scopes: payload.scopes })
      .returning({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes })
    const response: CreateTokenResponse = { token, record }
    return { data: response, init: { status: 201 } }
  })(request)
}

export const GET = apiRoute<ListTokensResponse>(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const tokens = await db
    .select({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes, created_at: apiTokens.created_at })
    .from(apiTokens)
    .where(isNull(apiTokens.revoked_at))
    .orderBy(desc(apiTokens.created_at))
  const response: ListTokensResponse = {
    tokens: tokens.map((item) => ({ ...item, created_at: item.created_at.toISOString() })),
  }
  return { data: response }
})
