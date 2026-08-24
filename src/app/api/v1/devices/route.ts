import { NextResponse } from 'next/server'

import { requireApiScope } from '@/server/auth'
import { listDevices } from '@/server/devices'

export const GET = async (request: Request) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ devices: await listDevices() })
}
