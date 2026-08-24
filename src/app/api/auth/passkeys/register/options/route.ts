import { NextResponse } from 'next/server'

import { currentAdministrator } from '@/server/auth/session'
import { beginPasskeyRegistration } from '@/server/auth/webauthn'

export const POST = async () => {
  const administrator = await currentAdministrator()
  if (!administrator) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await beginPasskeyRegistration(administrator))
}
