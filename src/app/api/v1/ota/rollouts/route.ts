import { eq, inArray } from 'drizzle-orm'
import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, firmwareReleases, otaJobs } from '@/server/database/schema'
import { createOtaNonce } from '@/server/firmware/ota'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import type { RolloutRequest, RolloutResponse } from '@/lib/api-contracts'
import { rolloutRequestSchema } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  return requestJson<RolloutRequest, RolloutResponse>(rolloutRequestSchema, async (payload) => {
    if (!(await requireApiScope(request, 'ota:install'))) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const [release] = await db.select().from(firmwareReleases).where(eq(firmwareReleases.id, payload.firmware_release_id)).limit(1)
    const candidates = await db
      .select({
        id: devices.id,
        board_model: devices.board_model,
        power_source: devices.power_source,
        battery_percent: devices.battery_percent,
      })
      .from(devices)
      .where(inArray(devices.id, payload.device_ids))
    if (!release) {
      throw new ApiRouteError('firmware_release_not_found', 404)
    }
    if (candidates.length !== payload.device_ids.length) {
      throw new ApiRouteError('device_not_found', 404)
    }
    const eligible = candidates.filter(
      (device) =>
        device.board_model === release.board_model &&
        (device.power_source === 'usb' || device.power_source === 'usb_and_battery' || (device.battery_percent ?? 0) >= 30),
    )
    const targetCount = Math.max(1, Math.ceil((eligible.length * payload.percentage) / 100))
    const selected = eligible.slice(0, targetCount)
    if (!selected.length) {
      throw new ApiRouteError('no_power_safe_devices', 409)
    }
    const jobs = await db
      .insert(otaJobs)
      .values(selected.map((device) => ({ device_id: device.id, firmware_release_id: release.id, nonce: createOtaNonce() })))
      .returning()
    const response: RolloutResponse = {
      jobs: jobs.map(({ id }) => ({ id })),
      selected_count: selected.length,
      eligible_count: eligible.length,
    }
    return { data: response, init: { status: 202 } }
  })(request)
}
