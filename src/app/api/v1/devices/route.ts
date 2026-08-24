import { NextResponse } from 'next/server'

import { requireApiScope } from '@/server/auth/auth'
import { listDevices } from '@/server/device/devices'
import type { ListDevicesResponse } from '@/lib/api-contracts'

export const GET = async (request: Request) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const response: ListDevicesResponse = {
    devices: (await listDevices()).map((device) => ({
      ...device,
      power_updated_at: device.power_updated_at?.toISOString() ?? null,
      last_seen_at: device.last_seen_at?.toISOString() ?? null,
    })),
  }
  return NextResponse.json(response)
}
