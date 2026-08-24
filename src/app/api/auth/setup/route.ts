import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createInitialAdministrator, createSession } from '@/server/session'

const setupSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
})

export const POST = async (request: Request) => {
  const body = setupSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_setup', issues: body.error.issues }, { status: 400 })

  try {
    const administrator = await createInitialAdministrator(body.data.email, body.data.password)
    await createSession(administrator.id)
    return NextResponse.json({ administrator: { id: administrator.id, email: administrator.email } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'administrator_exists') {
      return NextResponse.json({ error: 'already_initialized' }, { status: 409 })
    }
    throw error
  }
}
