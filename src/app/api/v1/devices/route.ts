import { requireApiScope } from '@/server/auth/auth'
import { listDevices } from '@/server/device/devices'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { ListDevicesResponse } from '@/lib/api-contracts'

export const GET = apiRoute(async (request) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }

  const response: ListDevicesResponse = {
    devices: (await listDevices()).map((device) => ({
      ...device,
      power_updated_at: device.power_updated_at?.toISOString() ?? null,
      last_seen_at: device.last_seen_at?.toISOString() ?? null,
    })),
  }
  return { data: response }
})
