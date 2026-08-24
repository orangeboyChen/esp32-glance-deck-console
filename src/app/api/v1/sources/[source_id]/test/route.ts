import { currentAdministrator } from '@/server/auth/session'
import { refreshUsageSource } from '@/server/source/usage-source'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { TestSourceResponse } from '@/lib/api-contracts'

type SourceRouteContext = { params: Promise<{ source_id: string }> }

export const POST = apiRoute<TestSourceResponse, SourceRouteContext>(async (request, context) => {
  void request
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  try {
    const response: TestSourceResponse = { values: await refreshUsageSource((await context.params).source_id) }
    return { data: response }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'source_test_failed', 400)
  }
})
