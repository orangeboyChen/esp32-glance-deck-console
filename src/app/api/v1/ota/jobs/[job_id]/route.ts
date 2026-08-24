import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, otaJobs } from '@/server/database/schema'
import { createOtaNonce } from '@/server/firmware/ota'

const actionSchema = z.object({ action: z.enum(['cancel', 'rollback']) }).default({ action: 'cancel' })

export const PATCH = async (request: Request, { params }: { params: Promise<{ job_id: string }> }) => {
  if (!(await requireApiScope(request, 'ota:install'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const { job_id: jobId } = await params
  const body = actionSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: 'invalid_ota_job_action' }, { status: 400 })
  if (body.data.action === 'rollback') {
    const [job] = await db
      .select({
        device_id: otaJobs.device_id,
        release_id: devices.last_good_firmware_release_id,
        power_source: devices.power_source,
        battery_percent: devices.battery_percent,
      })
      .from(otaJobs)
      .innerJoin(devices, eq(devices.id, otaJobs.device_id))
      .where(eq(otaJobs.id, jobId))
      .limit(1)
    if (!job?.release_id) return NextResponse.json({ error: 'known_good_release_not_found' }, { status: 409 })
    if (job.power_source !== 'usb' && job.power_source !== 'usb_and_battery' && (job.battery_percent ?? 0) < 30)
      return NextResponse.json({ error: 'power_unsafe_for_ota' }, { status: 409 })
    const [rollback] = await db
      .insert(otaJobs)
      .values({ device_id: job.device_id, firmware_release_id: job.release_id, nonce: createOtaNonce() })
      .returning()
    return NextResponse.json({ job: rollback }, { status: 202 })
  }
  const [job] = await db
    .update(otaJobs)
    .set({ status: 'cancelled', completed_at: new Date(), error_message: 'cancelled_by_operator' })
    .where(and(eq(otaJobs.id, jobId), inArray(otaJobs.status, ['queued', 'awaiting_confirmation'])))
    .returning()
  return job ? NextResponse.json({ job }) : NextResponse.json({ error: 'job_not_cancellable' }, { status: 409 })
}
