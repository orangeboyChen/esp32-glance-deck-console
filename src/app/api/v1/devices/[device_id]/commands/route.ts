import { eq } from 'drizzle-orm'
import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { validateDevicePageCommand } from '@/server/device/device-pages'
import { deviceCommands, devices } from '@/server/database/schema'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { deviceCommandRequestSchema } from '@/lib/api-contracts'
import type { DeviceCommandRequest, DeviceCommandResponse } from '@/lib/api-contracts'

export const POST = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  const { device_id: deviceId } = await params
  return requestJson<DeviceCommandRequest, DeviceCommandResponse>(deviceCommandRequestSchema, async (payload) => {
    if (!(await requireApiScope(request, 'devices:command'))) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const [device] = await db.select({ id: devices.id }).from(devices).where(eq(devices.id, deviceId)).limit(1)
    if (!device) {
      throw new ApiRouteError('device_not_found', 404)
    }
    try {
      await validateDevicePageCommand(deviceId, payload.action, payload.payload)
    } catch (error) {
      throw new ApiRouteError(error instanceof Error ? error.message : 'invalid_command', 400)
    }
    const [command] = await db
      .insert(deviceCommands)
      .values({ device_id: deviceId, action: payload.action, payload: payload.payload })
      .returning()

    if (payload.action === 'show_page') {
      await db
        .update(devices)
        .set({ desired_page_id: payload.payload.page_id as string })
        .where(eq(devices.id, deviceId))
    }

    return {
      data: {
        command: {
          ...command,
          payload: command.payload as DeviceCommandRequest['payload'],
          created_at: command.created_at.toISOString(),
          confirmed_at: command.confirmed_at?.toISOString() ?? null,
        },
      },
      init: { status: 202 },
    }
  })(request)
}
