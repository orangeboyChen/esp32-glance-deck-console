import { NextResponse } from 'next/server'

import { beginPasskeyAuthentication } from '@/server/auth/webauthn'
import type { PasskeyLoginOptions } from '@/lib/api-contracts'

export const POST = async () => {
  try {
    const response: PasskeyLoginOptions = await beginPasskeyAuthentication()
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'authentication_unavailable' }, { status: 503 })
  }
}
