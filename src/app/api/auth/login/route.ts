import { NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateAdministrator, createSession } from '@/server/auth/session'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const POST = async (request: Request) => {
  const body = loginSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_login' }, { status: 400 })

  const administrator = await authenticateAdministrator(body.data.email, body.data.password)
  if (!administrator) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })

  await createSession(administrator.id)
  return NextResponse.json({ administrator: { id: administrator.id, email: administrator.email } })
}
