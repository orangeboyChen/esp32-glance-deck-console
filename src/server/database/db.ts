import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { drizzle as drizzlePostgresql } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { createClient } from '@libsql/client'
import postgres from 'postgres'

import { databaseDialectFor, resolveDatabaseUrl, sqlitePathFor, type DatabaseDialect } from '@/server/database/database-url'

export const databaseUrl = resolveDatabaseUrl()
export const databaseAvailable = Boolean(databaseUrl)
export const databaseDialect: DatabaseDialect | undefined = databaseUrl ? databaseDialectFor(databaseUrl) : undefined

const sqlitePath = databaseUrl && databaseDialect === 'sqlite' ? sqlitePathFor(databaseUrl) : undefined
if (sqlitePath && sqlitePath !== ':memory:') {
  mkdirSync(dirname(sqlitePath), { recursive: true })
}

const postgresqlClient = databaseUrl && databaseDialect === 'postgresql' ? postgres(databaseUrl, { max: 4 }) : undefined
const sqliteClient = sqlitePath ? createClient({ url: sqlitePath === ':memory:' ? 'file::memory:' : `file:${sqlitePath}` }) : undefined

type ApplicationDatabase = PostgresJsDatabase

export const db: ApplicationDatabase | undefined = (
  postgresqlClient ? drizzlePostgresql(postgresqlClient) : sqliteClient ? drizzleSqlite(sqliteClient) : undefined
) as ApplicationDatabase | undefined
