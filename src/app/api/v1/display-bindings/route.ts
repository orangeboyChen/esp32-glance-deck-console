import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { displayBindings } from '@/server/database/schema'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import { displayBindingRequestSchema } from '@/lib/api-contracts'
import type { CreateDisplayBindingResponse, DisplayBinding, ListDisplayBindingsResponse } from '@/lib/api-contracts'

export const GET = apiRoute<ListDisplayBindingsResponse>(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const bindings: DisplayBinding[] = (await db.select().from(displayBindings)).map((binding) => ({
    ...binding,
    created_at: binding.created_at.toISOString(),
  }))
  const response: ListDisplayBindingsResponse = { bindings }
  return { data: response }
})

export const POST = async (request: Request) => {
  return requestJson(displayBindingRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const [binding] = await db.insert(displayBindings).values(payload).returning()
    const response: CreateDisplayBindingResponse = {
      binding: { ...binding, created_at: binding.created_at.toISOString() },
    }
    return { data: response, init: { status: 201 } }
  })(request)
}
