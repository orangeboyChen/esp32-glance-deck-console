import { NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/types'
import { currentAdministrator } from '@/server/auth/session'
import { finishPasskeyRegistration } from '@/server/auth/webauthn'
import { serializedPasskeyRegistrationSchema } from '@/lib/api-contracts'
import type { PasskeyVerifyResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const response = serializedPasskeyRegistrationSchema.safeParse(await request.json())
  if (!response.success) {
    return NextResponse.json({ error: 'invalid_response' }, { status: 400 })
  }

  try {
    await finishPasskeyRegistration(administrator.id, response.data as RegistrationResponseJSON)
    const verifiedResponse: PasskeyVerifyResponse = { verified: true }
    return NextResponse.json(verifiedResponse, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'verification_failed' }, { status: 400 })
  }
}
