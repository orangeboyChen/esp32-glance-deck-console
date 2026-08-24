import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, firmwareReleases, otaJobs } from '@/server/database/schema'
import { createOtaNonce } from '@/server/firmware/ota'
import { and, desc, eq } from 'drizzle-orm'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { otaInstallRequestSchema } from '@/lib/api-contracts'
import type { OtaInstallRequest, OtaJobResponse } from '@/lib/api-contracts'

export const POST = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  const { device_id: deviceId } = await params
  return requestJson<OtaInstallRequest, OtaJobResponse>(otaInstallRequestSchema, async (payload) => {
    if (!(await requireApiScope(request, 'ota:install'))) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
    if (!device) {
      throw new ApiRouteError('device_or_release_not_found', 404)
    }
    const releaseQuery = payload.firmware_release_id
      ? db.select().from(firmwareReleases).where(eq(firmwareReleases.id, payload.firmware_release_id)).limit(1)
      : db
          .select()
          .from(firmwareReleases)
          .where(and(eq(firmwareReleases.channel, 'stable'), eq(firmwareReleases.board_model, device.board_model)))
          .orderBy(desc(firmwareReleases.created_at))
          .limit(1)
    const [release] = await releaseQuery
    if (!release) {
      throw new ApiRouteError('device_or_release_not_found', 404)
    }
    if (release.board_model !== device.board_model) {
      throw new ApiRouteError('incompatible_release', 409)
    }
    const [duplicate] = await db
      .select({ id: otaJobs.id })
      .from(otaJobs)
      .where(and(eq(otaJobs.device_id, deviceId), eq(otaJobs.firmware_release_id, release.id), eq(otaJobs.status, 'queued')))
      .limit(1)
    if (duplicate) {
      throw new ApiRouteError('ota_already_queued', 409)
    }
    const hasExternalPower = device.power_source === 'usb' || device.power_source === 'usb_and_battery'
    if (!hasExternalPower && (device.battery_percent === null || device.battery_percent === undefined || device.battery_percent < 30)) {
      throw new ApiRouteError('power_unsafe_for_ota', 409)
    }
    const [previousRelease] = device.firmware_version
      ? await db
          .select({ id: firmwareReleases.id })
          .from(firmwareReleases)
          .where(and(eq(firmwareReleases.board_model, device.board_model), eq(firmwareReleases.version, device.firmware_version)))
          .limit(1)
      : []
    if (previousRelease) {
      await db.update(devices).set({ last_good_firmware_release_id: previousRelease.id }).where(eq(devices.id, deviceId))
    }
    const [job] = await db
      .insert(otaJobs)
      .values({ device_id: deviceId, firmware_release_id: release.id, nonce: createOtaNonce() })
      .returning()
    return {
      data: { job: { ...job, created_at: job.created_at.toISOString(), completed_at: job.completed_at?.toISOString() ?? null } },
      init: { status: 202 },
    }
  })(request)
}
