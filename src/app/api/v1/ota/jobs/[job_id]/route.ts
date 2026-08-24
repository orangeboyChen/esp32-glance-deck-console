import { and, eq, inArray } from 'drizzle-orm'
import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, otaJobs } from '@/server/database/schema'
import { createOtaNonce } from '@/server/firmware/ota'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import type { OtaJobRequest, OtaJobResponse } from '@/lib/api-contracts'
import { otaJobRequestSchema } from '@/lib/api-contracts'

export const PATCH = async (request: Request, { params }: { params: Promise<{ job_id: string }> }) => {
  const { job_id: jobId } = await params
  return requestJson<OtaJobRequest, OtaJobResponse>(otaJobRequestSchema, async (payload) => {
    if (!(await requireApiScope(request, 'ota:install'))) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    if (payload.action === 'rollback') {
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
      if (!job?.release_id) {
        throw new ApiRouteError('known_good_release_not_found', 409)
      }
      if (job.power_source !== 'usb' && job.power_source !== 'usb_and_battery' && (job.battery_percent ?? 0) < 30) {
        throw new ApiRouteError('power_unsafe_for_ota', 409)
      }
      const [rollback] = await db
        .insert(otaJobs)
        .values({ device_id: job.device_id, firmware_release_id: job.release_id, nonce: createOtaNonce() })
        .returning()
      const response: OtaJobResponse = {
        job: {
          ...rollback,
          created_at: rollback.created_at.toISOString(),
          completed_at: rollback.completed_at?.toISOString() ?? null,
        },
      }
      return { data: response, init: { status: 202 } }
    }
    const [job] = await db
      .update(otaJobs)
      .set({ status: 'cancelled', completed_at: new Date(), error_message: 'cancelled_by_operator' })
      .where(and(eq(otaJobs.id, jobId), inArray(otaJobs.status, ['queued', 'awaiting_confirmation'])))
      .returning()
    if (!job) {
      throw new ApiRouteError('job_not_cancellable', 409)
    }
    const response: OtaJobResponse = {
      job: {
        ...job,
        created_at: job.created_at.toISOString(),
        completed_at: job.completed_at?.toISOString() ?? null,
      },
    }
    return { data: response }
  })(request)
}
