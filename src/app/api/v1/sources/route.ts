import { desc } from 'drizzle-orm'
import { db } from '@/server/database/db'
import { encryptSecret } from '@/server/security/secrets'
import { currentAdministrator } from '@/server/auth/session'
import { usageSources } from '@/server/database/schema'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import { sourceCreateRequestSchema } from '@/lib/api-contracts'
import type { CreateSourceResponse, ListSourcesResponse, SourceCreateRequest } from '@/lib/api-contracts'

export const GET = apiRoute<ListSourcesResponse>(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const sources = await db
    .select({
      id: usageSources.id,
      name: usageSources.name,
      base_url: usageSources.base_url,
      request_path: usageSources.request_path,
      method: usageSources.method,
      mapper: usageSources.mapper,
      refresh_interval_seconds: usageSources.refresh_interval_seconds,
      status: usageSources.status,
      last_success_at: usageSources.last_success_at,
      last_error: usageSources.last_error,
    })
    .from(usageSources)
    .orderBy(desc(usageSources.created_at))
  const response: ListSourcesResponse = {
    sources: sources.map((source) => ({
      ...source,
      method: source.method as 'GET' | 'POST',
      last_success_at: source.last_success_at?.toISOString() ?? null,
    })),
  }
  return { data: response }
})

export const POST = async (request: Request) => {
  return requestJson<SourceCreateRequest, CreateSourceResponse>(sourceCreateRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    try {
      const [source] = await db
        .insert(usageSources)
        .values({ ...payload, secret_ciphertext: encryptSecret(payload.secrets) })
        .returning({ id: usageSources.id, name: usageSources.name })
      const response: CreateSourceResponse = { source }
      return { data: response, init: { status: 201 } }
    } catch (error) {
      throw new ApiRouteError(error instanceof Error ? error.message : 'source_create_failed', 400)
    }
  })(request)
}
