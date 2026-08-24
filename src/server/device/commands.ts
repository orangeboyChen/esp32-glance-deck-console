import { and, asc, eq } from 'drizzle-orm'

import { databaseDialect, db } from '@/server/database/db'
import { publishDeviceCommand } from '@/server/messaging/mqtt'
import { deviceCommands } from '@/server/database/schema'

export const dispatchQueuedCommands = async () => {
  if (!db) {
    return 0
  }
  let dispatched = 0
  for (let index = 0; index < 20; index += 1) {
    const processed = await db.transaction(async (transaction) => {
      const query = transaction
        .select()
        .from(deviceCommands)
        .where(eq(deviceCommands.status, 'queued'))
        .orderBy(asc(deviceCommands.created_at))
        .limit(1)
      type QueryResult = Awaited<typeof query>
      type LockableQuery = { for: (mode: 'update', options: { skipLocked: true }) => Promise<QueryResult> }
      const [command] =
        databaseDialect === 'postgresql' ? await (query as unknown as LockableQuery).for('update', { skipLocked: true }) : await query
      if (!command) {
        return false
      }

      try {
        await publishDeviceCommand(command.device_id, command)
        await transaction
          .update(deviceCommands)
          .set({ status: 'sent' })
          .where(and(eq(deviceCommands.id, command.id), eq(deviceCommands.status, 'queued')))
      } catch (error) {
        await transaction
          .update(deviceCommands)
          .set({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'mqtt_publish_failed',
          })
          .where(eq(deviceCommands.id, command.id))
      }
      return true
    })
    if (!processed) {
      break
    }
    dispatched += 1
  }
  return dispatched
}
