import { NextResponse } from 'next/server'

import { currentAdministrator } from '@/server/auth/session'
import { beginPasskeyRegistration } from '@/server/auth/webauthn'
import type { PasskeyRegisterOptions } from '@/lib/api-contracts'

export const POST = async () => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const response: PasskeyRegisterOptions = await beginPasskeyRegistration(administrator)
  return NextResponse.json(response)
}
