import { NextResponse } from 'next/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/types'
import { z } from 'zod'

import { createSession } from '@/server/session'
import { finishPasskeyAuthentication } from '@/server/webauthn'

const responseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  clientExtensionResults: z.record(z.string(), z.unknown()),
})

export const POST = async (request: Request) => {
  const response = responseSchema.safeParse(await request.json())
  if (!response.success) return NextResponse.json({ error: 'invalid_response' }, { status: 400 })
  try {
    const administratorId = await finishPasskeyAuthentication(response.data as AuthenticationResponseJSON)
    await createSession(administratorId)
    return NextResponse.json({ verified: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'verification_failed' }, { status: 401 })
  }
}
