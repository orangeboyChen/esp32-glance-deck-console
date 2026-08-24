import { NextResponse } from 'next/server'

import { beginPasskeyAuthentication } from '@/server/auth/webauthn'

export const POST = async () => {
  try {
    return NextResponse.json(await beginPasskeyAuthentication())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'authentication_unavailable' }, { status: 503 })
  }
}
