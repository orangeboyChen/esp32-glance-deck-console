import { NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/types'
import { z } from 'zod'

import { currentAdministrator } from '@/server/auth/session'
import { finishPasskeyRegistration } from '@/server/auth/webauthn'

const responseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({ clientDataJSON: z.string(), attestationObject: z.string(), transports: z.array(z.string()).optional() }),
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.string(), z.unknown()),
})

export const POST = async (request: Request) => {
  const administrator = await currentAdministrator()
  if (!administrator) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const response = responseSchema.safeParse(await request.json())
  if (!response.success) return NextResponse.json({ error: 'invalid_response' }, { status: 400 })

  try {
    await finishPasskeyRegistration(administrator.id, response.data as RegistrationResponseJSON)
    return NextResponse.json({ verified: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'verification_failed' }, { status: 400 })
  }
}
