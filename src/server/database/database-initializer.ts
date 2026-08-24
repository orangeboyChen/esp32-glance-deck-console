import { join } from 'node:path'

import { migrate as migrateSqlite } from 'drizzle-orm/libsql/migrator'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate as migratePostgresql } from 'drizzle-orm/postgres-js/migrator'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { databaseDialect, db } from '@/server/database/db'

let initialization: Promise<void> | undefined

export const initializeDatabase = () => {
  if (initialization) {
    return initialization
  }
  initialization = (async () => {
    if (!db || !databaseDialect) {
      return
    }
    if (databaseDialect === 'sqlite') {
      await migrateSqlite(db as unknown as LibSQLDatabase, { migrationsFolder: join(process.cwd(), 'drizzle/sqlite') })
      return
    }
    await migratePostgresql(db as PostgresJsDatabase, { migrationsFolder: join(process.cwd(), 'drizzle/postgresql') })
  })()
  return initialization
}
