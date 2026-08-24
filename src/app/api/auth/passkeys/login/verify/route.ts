import { NextResponse } from 'next/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/types'
import { createSession } from '@/server/auth/session'
import { finishPasskeyAuthentication } from '@/server/auth/webauthn'
import { serializedPasskeyLoginSchema } from '@/lib/api-contracts'
import type { PasskeyVerifyResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  const response = serializedPasskeyLoginSchema.safeParse(await request.json())
  if (!response.success) {
    return NextResponse.json({ error: 'invalid_response' }, { status: 400 })
  }
  try {
    const administratorId = await finishPasskeyAuthentication(response.data as AuthenticationResponseJSON)
    await createSession(administratorId)
    const verifiedResponse: PasskeyVerifyResponse = { verified: true }
    return NextResponse.json(verifiedResponse)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'verification_failed' }, { status: 401 })
  }
}
