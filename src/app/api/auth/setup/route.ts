import { NextResponse } from 'next/server'
import { z } from 'zod'

import { create_initial_administrator, create_session } from '@/server/session'

const setup_schema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
})

export async function POST(request: Request) {
  const body = setup_schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_setup', issues: body.error.issues }, { status: 400 })

  try {
    const administrator = await create_initial_administrator(body.data.email, body.data.password)
    await create_session(administrator.id)
    return NextResponse.json({ administrator: { id: administrator.id, email: administrator.email } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'administrator_exists') {
      return NextResponse.json({ error: 'already_initialized' }, { status: 409 })
    }
    throw error
  }
}
