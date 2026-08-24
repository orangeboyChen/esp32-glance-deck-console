export type DatabaseDialect = 'postgresql' | 'sqlite'

const developmentSqliteUrl = 'sqlite:./.data/glance-deck.db'

export const resolveDatabaseUrl = (environment = process.env): string | undefined => {
  if (environment.DATABASE_URL) {
    return environment.DATABASE_URL
  }
  return environment.NODE_ENV === 'development' ? developmentSqliteUrl : undefined
}

export const databaseDialectFor = (url: string): DatabaseDialect => {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql'
  }
  if (url.startsWith('sqlite:')) {
    return 'sqlite'
  }
  throw new Error('database_url_scheme_unsupported')
}

export const sqlitePathFor = (url: string): string => {
  if (databaseDialectFor(url) !== 'sqlite') {
    throw new Error('database_url_scheme_unsupported')
  }
  const path = url.slice('sqlite:'.length)
  if (!path) {
    throw new Error('sqlite_database_path_required')
  }
  return path
}

export { developmentSqliteUrl }
