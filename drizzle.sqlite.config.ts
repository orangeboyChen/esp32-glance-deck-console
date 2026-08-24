import type { Config } from 'drizzle-kit'

export default {
  schema: './src/server/schema.sqlite.ts',
  out: './drizzle/sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL?.startsWith('sqlite:') ? process.env.DATABASE_URL.slice('sqlite:'.length) : './.data/glance-deck.db',
  },
} satisfies Config
