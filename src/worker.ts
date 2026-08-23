import { dispatch_queued_commands } from './server/commands'
import { inArray, or, and, eq, lt } from 'drizzle-orm'
import { db } from './server/db'
import { start_device_state_consumer } from './server/mqtt'
import { dispatch_queued_ota_jobs } from './server/ota'
import { usage_sources } from './server/schema'
import { refresh_usage_source } from './server/usage-source'

const worker_name = 'glance-deck-worker'

async function tick() {
  try {
    const count = await dispatch_queued_commands()
    const ota_count = await dispatch_queued_ota_jobs()
    if (count > 0) console.log(`${worker_name}: dispatched ${count} device command(s)`)
    if (ota_count > 0) console.log(`${worker_name}: dispatched ${ota_count} OTA job(s)`)
  } catch (error) {
    console.error(`${worker_name}: command dispatch failed`, error)
  }
  if (!db) return
  const now = Date.now()
  const stale_claim_before = new Date(now - 30 * 60 * 1000)
  const sources = await db.select().from(usage_sources).where(or(inArray(usage_sources.status, ['active', 'error']), and(eq(usage_sources.status, 'refreshing'), lt(usage_sources.last_attempt_at, stale_claim_before))))
  await Promise.all(sources.filter((source) => !source.last_attempt_at || now - source.last_attempt_at.getTime() >= source.refresh_interval_seconds * 1000)
    .map(async (source) => {
      try { await refresh_usage_source(source.id) } catch (error) { console.error(`${worker_name}: source refresh failed`, error) }
    }))
}

console.log(`${worker_name}: ready to process command, source, and OTA jobs`)
start_device_state_consumer()
await tick()
setInterval(tick, 1_000)
