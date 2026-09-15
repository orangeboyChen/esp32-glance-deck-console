import { and, count, desc, eq, gte, inArray } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { alertRules, devices, displayReleasePages, displayReleases, otaJobs, sourceSnapshots, usageSources } from '@/server/database/schema'

export type DeviceSummary = {
  id: string
  name: string
  board_model: string
  status: 'enrolling' | 'online' | 'offline' | 'error'
  firmware_version: string | null
  active_page_id: string
  wifi_rssi: number | null
  power_source: string | null
  charging: boolean | null
  battery_percent: number | null
  battery_mv: number | null
  power_updated_at: Date | null
  last_seen_at: Date | null
  preview_svg: string | null
  source_values: Record<string, string | number | null> | null
  ota_status: string | null
  ota_job_id: string | null
}

/**
 * Splits ids into batches so a single statement never exceeds a driver's bound-parameter limit.
 * Batching by id keeps all of one device's rows in the same batch, so per-device ordering is
 * preserved across batches.
 */
const chunk = <T>(values: T[], size: number): T[][] => {
  const batches: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size))
  }
  return batches
}

export const listDevices = async (): Promise<DeviceSummary[]> => {
  const database = db
  if (!database) {
    return []
  }

  const rows = await database
    .select({
      id: devices.id,
      name: devices.name,
      board_model: devices.board_model,
      status: devices.status,
      firmware_version: devices.firmware_version,
      active_page_id: devices.active_page_id,
      wifi_rssi: devices.wifi_rssi,
      power_source: devices.power_source,
      charging: devices.charging,
      battery_percent: devices.battery_percent,
      battery_mv: devices.battery_mv,
      power_updated_at: devices.power_updated_at,
      last_seen_at: devices.last_seen_at,
      preview_svg: displayReleasePages.preview_svg,
    })
    .from(devices)
    .leftJoin(displayReleases, eq(devices.release_id, displayReleases.id))
    .leftJoin(
      displayReleasePages,
      and(eq(displayReleasePages.release_id, displayReleases.id), eq(displayReleasePages.page_id, devices.active_page_id)),
    )

  const [snapshots, latestOtaJobs] = await Promise.all([
    database
      .select({ values: sourceSnapshots.values, fetched_at: sourceSnapshots.fetched_at, mapper: usageSources.mapper })
      .from(sourceSnapshots)
      .innerJoin(usageSources, eq(sourceSnapshots.source_id, usageSources.id))
      .where(inArray(usageSources.status, ['active', 'refreshing']))
      .orderBy(desc(sourceSnapshots.fetched_at))
      .limit(100),
    // One query for every device instead of one per device: the original per-device loop made the
    // dashboard cost N+1 round trips, which dominates once there are real devices. Ids are chunked
    // because drivers cap the number of bound parameters in a single statement.
    rows.length
      ? Promise.all(
          chunk(rows.map((row) => row.id), 500).map((deviceIds) =>
            database
              .select({ device_id: otaJobs.device_id, id: otaJobs.id, status: otaJobs.status })
              .from(otaJobs)
              .where(inArray(otaJobs.device_id, deviceIds))
              .orderBy(desc(otaJobs.created_at)),
          ),
        ).then((batches) => batches.flat())
      : Promise.resolve([]),
  ])
  const soruxgptSnapshot = snapshots.find((snapshot) => snapshot.mapper?.provider === 'soruxgpt_codex')
  const freshSoruxgptSnapshot =
    soruxgptSnapshot && Date.now() - soruxgptSnapshot.fetched_at.getTime() <= 30 * 60 * 1000 ? soruxgptSnapshot : null
  const latestSnapshot = freshSoruxgptSnapshot ? undefined : snapshots[0]
  const snapshot = freshSoruxgptSnapshot ?? latestSnapshot

  // Rows arrive newest-first, so the first job seen for a device is its current one.
  const otaJobByDevice = new Map<string, { id: string; status: string | null }>()
  for (const job of latestOtaJobs) {
    if (!otaJobByDevice.has(job.device_id)) {
      otaJobByDevice.set(job.device_id, job)
    }
  }

  return rows.map((row) => {
    const otaJob = otaJobByDevice.get(row.id)
    return { ...row, source_values: snapshot?.values ?? null, ota_status: otaJob?.status ?? null, ota_job_id: otaJob?.id ?? null }
  })
}

export const dashboardSummary = async () => {
  if (!db) {
    return { active_alerts: 0, source_updates_today: 0 }
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const [[active], [updates]] = await Promise.all([
    db.select({ value: count() }).from(alertRules).where(eq(alertRules.active, true)),
    db.select({ value: count() }).from(sourceSnapshots).where(gte(sourceSnapshots.fetched_at, startOfDay)),
  ])
  return { active_alerts: active?.value ?? 0, source_updates_today: updates?.value ?? 0 }
}
