import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { describe, expect, test } from 'bun:test'

const runner = `
  import { initializeDatabase } from './src/server/database/database-initializer'
  import { eq } from 'drizzle-orm'
  import { db } from './src/server/database/db'
  import { administrators, displayReleases, sessions } from './src/server/database/schema'
  await initializeDatabase()
  await initializeDatabase()
  const [administrator] = await db.insert(administrators).values({ email: 'owner@example.com', password_hash: 'hash' }).returning()
  await db.insert(sessions).values({ administrator_id: administrator.id, token_hash: 'token', expires_at: new Date(Date.now() + 60_000) })
  const [release] = await db.insert(displayReleases).values({ version: 1, page_id: 'system', document: { title: 'System' }, preview_svg: '<svg/>', device_image: Buffer.from([1, 2, 3]), image_format: 'mono1-msb', image_width: 400, image_height: 300, content_sha256: 'a'.repeat(64) }).returning()
  const [storedRelease] = await db.select().from(displayReleases)
  await db.delete(administrators).where(eq(administrators.id, administrator.id))
  const records = await db.select().from(sessions)
  console.log(JSON.stringify({ sessionCount: records.length, title: storedRelease.document.title, imageBytes: storedRelease.device_image.length, releaseId: release.id }))
`

describe('SQLite database initialization', () => {
  test('creates and reuses a SQLite schema through Drizzle migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'glance-deck-sqlite-'))
    const databaseUrl = `sqlite:${join(directory, 'console.db')}`
    try {
      const result = spawnSync('bun', ['--bun', '-e', runner], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
      })
      if (result.status !== 0) {
        throw new Error(result.error?.message ?? result.stderr.toString())
      }
      expect(JSON.parse(result.stdout.toString())).toMatchObject({ sessionCount: 0, title: 'System', imageBytes: 3 })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
