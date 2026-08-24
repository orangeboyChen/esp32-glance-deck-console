import { NextResponse } from 'next/server'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { displayBindings } from '@/server/database/schema'
import { displayBindingRequestSchema } from '@/lib/api-contracts'
import type { CreateDisplayBindingResponse, DisplayBinding, ListDisplayBindingsResponse } from '@/lib/api-contracts'

export const GET = async () => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const bindings: DisplayBinding[] = (await db.select().from(displayBindings)).map((binding) => ({
    ...binding,
    created_at: binding.created_at.toISOString(),
  }))
  const response: ListDisplayBindingsResponse = { bindings }
  return NextResponse.json(response)
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = displayBindingRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_display_binding', issues: body.error.issues }, { status: 400 })
  }
  const [binding] = await db.insert(displayBindings).values(body.data).returning()
  const response: CreateDisplayBindingResponse = {
    binding: { ...binding, created_at: binding.created_at.toISOString() },
  }
  return NextResponse.json(response, { status: 201 })
}
