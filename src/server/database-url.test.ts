import { describe, expect, test } from 'bun:test'

import { database_dialect_for, development_sqlite_url, resolve_database_url, sqlite_path_for } from './database-url'

describe('database URL configuration', () => {
  test('uses PostgreSQL and SQLite URLs explicitly', () => {
    expect(database_dialect_for('postgresql://localhost/glance_deck')).toBe('postgresql')
    expect(database_dialect_for('sqlite:./data/glance-deck.db')).toBe('sqlite')
    expect(sqlite_path_for('sqlite:./data/glance-deck.db')).toBe('./data/glance-deck.db')
  })

  test('uses SQLite by default in development only', () => {
    expect(resolve_database_url({ NODE_ENV: 'development' })).toBe(development_sqlite_url)
    expect(resolve_database_url({ NODE_ENV: 'production' })).toBeUndefined()
    expect(resolve_database_url({ NODE_ENV: 'development', DATABASE_URL: 'sqlite::memory:' })).toBe('sqlite::memory:')
  })

  test('rejects unsupported database URLs', () => {
    expect(() => database_dialect_for('mysql://localhost/glance_deck')).toThrow('database_url_scheme_unsupported')
    expect(() => sqlite_path_for('sqlite:')).toThrow('sqlite_database_path_required')
  })
})
