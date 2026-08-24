import { NextResponse } from 'next/server'

import { clearSession } from '@/server/auth/session'

export const POST = async () => {
  await clearSession()
  return new NextResponse(null, { status: 204 })
}
