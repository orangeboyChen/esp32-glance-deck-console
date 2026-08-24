import { describe, expect, test } from 'bun:test'

import { databaseDialectFor, developmentSqliteUrl, resolveDatabaseUrl, sqlitePathFor } from '@/server/database/database-url'

describe('database URL configuration', () => {
  test('uses PostgreSQL and SQLite URLs explicitly', () => {
    expect(databaseDialectFor('postgresql://localhost/glance_deck')).toBe('postgresql')
    expect(databaseDialectFor('sqlite:./data/glance-deck.db')).toBe('sqlite')
    expect(sqlitePathFor('sqlite:./data/glance-deck.db')).toBe('./data/glance-deck.db')
  })

  test('uses SQLite by default in development only', () => {
    expect(resolveDatabaseUrl({ NODE_ENV: 'development' })).toBe(developmentSqliteUrl)
    expect(resolveDatabaseUrl({ NODE_ENV: 'production' })).toBeUndefined()
    expect(resolveDatabaseUrl({ NODE_ENV: 'development', DATABASE_URL: 'sqlite::memory:' })).toBe('sqlite::memory:')
  })

  test('rejects unsupported database URLs', () => {
    expect(() => databaseDialectFor('mysql://localhost/glance_deck')).toThrow('database_url_scheme_unsupported')
    expect(() => sqlitePathFor('sqlite:')).toThrow('sqlite_database_path_required')
  })
})
