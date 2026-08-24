import { requireApiScope } from '@/server/auth/auth'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { EventReadyPayload } from '@/lib/api-contracts'

export const GET = apiRoute<never>(async (request) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  const stream = new ReadableStream({
    start(controller) {
      const payload: EventReadyPayload = { status: 'connected' }
      controller.enqueue(new TextEncoder().encode(`event: ready\\ndata: ${JSON.stringify(payload)}\\n\\n`))
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })
})
