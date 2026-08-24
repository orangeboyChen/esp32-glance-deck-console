export type Database_dialect = 'postgresql' | 'sqlite'

const development_sqlite_url = 'sqlite:./.data/glance-deck.db'

export function resolve_database_url(environment = process.env): string | undefined {
  if (environment.DATABASE_URL) return environment.DATABASE_URL
  return environment.NODE_ENV === 'development' ? development_sqlite_url : undefined
}

export function database_dialect_for(url: string): Database_dialect {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql'
  if (url.startsWith('sqlite:')) return 'sqlite'
  throw new Error('database_url_scheme_unsupported')
}

export function sqlite_path_for(url: string): string {
  if (database_dialect_for(url) !== 'sqlite') throw new Error('database_url_scheme_unsupported')
  const path = url.slice('sqlite:'.length)
  if (!path) throw new Error('sqlite_database_path_required')
  return path
}

export { development_sqlite_url }
