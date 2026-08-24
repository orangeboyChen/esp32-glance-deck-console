import { NextResponse } from 'next/server'

import { requireApiScope } from '@/server/auth'

export const GET = async (request: Request) => {
  if (!(await requireApiScope(request, 'devices:read'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: ready\\ndata: {"status":"connected"}\\n\\n'))
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })
}
