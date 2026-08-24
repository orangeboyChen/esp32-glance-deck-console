import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { drizzle as drizzle_sqlite } from 'drizzle-orm/libsql'
import { drizzle as drizzle_postgresql } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { createClient } from '@libsql/client'
import postgres from 'postgres'

import { database_dialect_for, resolve_database_url, sqlite_path_for, type Database_dialect } from './database-url'

export const database_url = resolve_database_url()
export const database_available = Boolean(database_url)
export const database_dialect: Database_dialect | undefined = database_url ? database_dialect_for(database_url) : undefined

const sqlite_path = database_url && database_dialect === 'sqlite' ? sqlite_path_for(database_url) : undefined
if (sqlite_path && sqlite_path !== ':memory:') mkdirSync(dirname(sqlite_path), { recursive: true })

const postgresql_client = database_url && database_dialect === 'postgresql' ? postgres(database_url, { max: 4 }) : undefined
const sqlite_client = sqlite_path ? createClient({ url: sqlite_path === ':memory:' ? 'file::memory:' : `file:${sqlite_path}` }) : undefined

type Application_database = PostgresJsDatabase

export const db: Application_database | undefined = (postgresql_client
  ? drizzle_postgresql(postgresql_client)
  : sqlite_client
    ? drizzle_sqlite(sqlite_client)
    : undefined) as Application_database | undefined
