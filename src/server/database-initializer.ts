import { join } from 'node:path'

import { migrate as migrate_sqlite } from 'drizzle-orm/libsql/migrator'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate as migrate_postgresql } from 'drizzle-orm/postgres-js/migrator'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { database_dialect, db } from './db'

let initialization: Promise<void> | undefined

export function initialize_database() {
  if (initialization) return initialization
  initialization = (async () => {
    if (!db || !database_dialect) return
    if (database_dialect === 'sqlite') {
      await migrate_sqlite(db as unknown as LibSQLDatabase, { migrationsFolder: join(process.cwd(), 'drizzle/sqlite') })
      return
    }
    await migrate_postgresql(db as PostgresJsDatabase, { migrationsFolder: join(process.cwd(), 'drizzle/postgresql') })
  })()
  return initialization
}
