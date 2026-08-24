import { dispatchQueuedCommands } from './server/commands'
import { inArray, or, and, eq, lt } from 'drizzle-orm'
import { db } from './server/db'
import { startDeviceStateConsumer } from './server/mqtt'
import { dispatchQueuedOtaJobs } from './server/ota'
import { initializeDatabase } from './server/database-initializer'
import { usageSources } from './server/schema'
import { refreshUsageSource } from './server/usage-source'

const workerName = 'glance-deck-worker'

const tick = async () => {
  try {
    const count = await dispatchQueuedCommands()
    const otaCount = await dispatchQueuedOtaJobs()
    if (count > 0) console.log(`${workerName}: dispatched ${count} device command(s)`)
    if (otaCount > 0) console.log(`${workerName}: dispatched ${otaCount} OTA job(s)`)
  } catch (error) {
    console.error(`${workerName}: command dispatch failed`, error)
  }
  if (!db) return
  const now = Date.now()
  const staleClaimBefore = new Date(now - 30 * 60 * 1000)
  const sources = await db
    .select()
    .from(usageSources)
    .where(
      or(
        inArray(usageSources.status, ['active', 'error']),
        and(eq(usageSources.status, 'refreshing'), lt(usageSources.last_attempt_at, staleClaimBefore)),
      ),
    )
  await Promise.all(
    sources
      .filter((source) => !source.last_attempt_at || now - source.last_attempt_at.getTime() >= source.refresh_interval_seconds * 1000)
      .map(async (source) => {
        try {
          await refreshUsageSource(source.id)
        } catch (error) {
          console.error(`${workerName}: source refresh failed`, error)
        }
      }),
  )
}

await initializeDatabase()
console.log(`${workerName}: ready to process command, source, and OTA jobs`)
startDeviceStateConsumer()
await tick()
setInterval(tick, 1_000)
