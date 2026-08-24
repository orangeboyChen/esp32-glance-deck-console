import { NextResponse } from 'next/server'

import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, firmwareReleases, otaJobs } from '@/server/database/schema'
import { createOtaNonce } from '@/server/firmware/ota'
import { and, desc, eq } from 'drizzle-orm'
import { otaInstallRequestSchema } from '@/lib/api-contracts'
import type { OtaJobResponse } from '@/lib/api-contracts'

export const POST = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'ota:install'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }

  const body = otaInstallRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_ota_request' }, { status: 400 })
  }
  const { device_id: deviceId } = await params
  const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
  if (!device) {
    return NextResponse.json({ error: 'device_or_release_not_found' }, { status: 404 })
  }
  const releaseQuery = body.data.firmware_release_id
    ? db.select().from(firmwareReleases).where(eq(firmwareReleases.id, body.data.firmware_release_id)).limit(1)
    : db
        .select()
        .from(firmwareReleases)
        .where(and(eq(firmwareReleases.channel, 'stable'), eq(firmwareReleases.board_model, device.board_model)))
        .orderBy(desc(firmwareReleases.created_at))
        .limit(1)
  const [release] = await releaseQuery
  if (!release) {
    return NextResponse.json({ error: 'device_or_release_not_found' }, { status: 404 })
  }
  if (release.board_model !== device.board_model) {
    return NextResponse.json({ error: 'incompatible_release' }, { status: 409 })
  }
  const [duplicate] = await db
    .select({ id: otaJobs.id })
    .from(otaJobs)
    .where(and(eq(otaJobs.device_id, deviceId), eq(otaJobs.firmware_release_id, release.id), eq(otaJobs.status, 'queued')))
    .limit(1)
  if (duplicate) {
    return NextResponse.json({ error: 'ota_already_queued', job: duplicate }, { status: 409 })
  }
  const hasExternalPower = device.power_source === 'usb' || device.power_source === 'usb_and_battery'
  if (!hasExternalPower && (device.battery_percent === null || device.battery_percent === undefined || device.battery_percent < 30)) {
    return NextResponse.json({ error: 'power_unsafe_for_ota' }, { status: 409 })
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

  const response: OtaJobResponse = {
    job: {
      ...job,
      created_at: job.created_at.toISOString(),
      completed_at: job.completed_at?.toISOString() ?? null,
    },
  }
  return NextResponse.json(response, { status: 202 })
}
