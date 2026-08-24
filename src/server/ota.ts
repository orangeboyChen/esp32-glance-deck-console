import { randomBytes } from 'node:crypto'

import { and, asc, eq } from 'drizzle-orm'

import { databaseDialect, db } from './db'
import { publishDeviceOta } from './mqtt'
import { firmwareReleases, otaJobs } from './schema'

export const dispatchQueuedOtaJobs = async () => {
  if (!db) return 0
  let dispatched = 0
  for (let index = 0; index < 10; index += 1) {
    const processed = await db.transaction(async (transaction) => {
      const query = transaction
        .select({
          id: otaJobs.id,
          device_id: otaJobs.device_id,
          nonce: otaJobs.nonce,
          version: firmwareReleases.version,
          manifest_url: firmwareReleases.manifest_url,
          image_sha256: firmwareReleases.image_sha256,
        })
        .from(otaJobs)
        .innerJoin(firmwareReleases, eq(otaJobs.firmware_release_id, firmwareReleases.id))
        .where(eq(otaJobs.status, 'queued'))
        .orderBy(asc(otaJobs.created_at))
        .limit(1)
      type QueryResult = Awaited<typeof query>
      type LockableQuery = { for: (mode: 'update', options: { skipLocked: true }) => Promise<QueryResult> }
      const [job] =
        databaseDialect === 'postgresql' ? await (query as unknown as LockableQuery).for('update', { skipLocked: true }) : await query
      if (!job) return false

      try {
        await publishDeviceOta(job.device_id, job)
        await transaction
          .update(otaJobs)
          .set({ status: 'sent' })
          .where(and(eq(otaJobs.id, job.id), eq(otaJobs.status, 'queued')))
      } catch (error) {
        await transaction
          .update(otaJobs)
          .set({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'mqtt_publish_failed',
            completed_at: new Date(),
          })
          .where(eq(otaJobs.id, job.id))
      }
      return true
    })
    if (!processed) break
    dispatched += 1
  }
  return dispatched
}

export const createOtaNonce = () => {
  return randomBytes(24).toString('base64url')
}
