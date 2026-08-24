import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/server/db'
import { encrypt_secret } from '@/server/secrets'
import { current_administrator } from '@/server/session'
import { usage_sources } from '@/server/schema'
import { normalize_soruxgpt_token, public_soruxgpt_source } from '@/server/soruxgpt'
import { refresh_usage_source } from '@/server/usage-source'

const soruxgpt_schema = z.object({ token: z.string().min(1).max(8192) })
const source_name = 'SoruxGPT Codex'

export async function POST(request: Request) {
  if (!await current_administrator()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = soruxgpt_schema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_soruxgpt_token' }, { status: 400 })
  const token = normalize_soruxgpt_token(body.data.token)
  if (!token) return NextResponse.json({ error: 'invalid_soruxgpt_token' }, { status: 400 })

  const configuration = {
    name: source_name,
    base_url: 'https://app.soruxgpt.com',
    request_path: '/api/v1/codex',
    method: 'GET',
    headers: { accept: 'application/json', authorization: 'Bearer {{SORUXGPT_TOKEN}}' },
    mapper: { provider: 'soruxgpt_codex' },
    refresh_interval_seconds: 900,
    secret_ciphertext: encrypt_secret({ SORUXGPT_TOKEN: token }),
  }
  const { source, existing, refresh_in_progress, previous_source } = await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(usage_sources).where(eq(usage_sources.name, source_name)).limit(1)
    if (current?.status === 'refreshing') return { source: public_soruxgpt_source(current as { id: string; name: string }), existing: true, refresh_in_progress: true }
    const updated_source = current
      ? (await transaction.update(usage_sources).set({ ...configuration, status: 'refreshing', last_attempt_at: new Date(), last_error: null }).where(eq(usage_sources.id, current.id)).returning({ id: usage_sources.id, name: usage_sources.name }))[0]
      : (await transaction.insert(usage_sources).values({ ...configuration, status: 'refreshing', last_attempt_at: new Date() }).returning({ id: usage_sources.id, name: usage_sources.name }))[0]
    return { source: updated_source, existing: Boolean(current), refresh_in_progress: false, previous_source: current ?? null }
  })
  if (!source) return NextResponse.json({ error: 'source_create_failed' }, { status: 500 })
  if (refresh_in_progress) return NextResponse.json({ source, error: 'source_refresh_in_progress' }, { status: 409 })
  try {
    return NextResponse.json({ source, values: await refresh_usage_source(source.id, true) }, { status: existing ? 200 : 201 })
  } catch (error) {
    if (previous_source) {
      await db.update(usage_sources).set({
        base_url: previous_source.base_url,
        request_path: previous_source.request_path,
        method: previous_source.method,
        headers: previous_source.headers,
        body_template: previous_source.body_template,
        secret_ciphertext: previous_source.secret_ciphertext,
        mapper: previous_source.mapper,
        refresh_interval_seconds: previous_source.refresh_interval_seconds,
        status: previous_source.status,
        last_attempt_at: previous_source.last_attempt_at,
        last_success_at: previous_source.last_success_at,
        last_error: previous_source.last_error,
      }).where(eq(usage_sources.id, previous_source.id))
    } else {
      await db.delete(usage_sources).where(eq(usage_sources.id, source.id))
    }
    return NextResponse.json({ source, error: error instanceof Error ? error.message : 'soruxgpt_refresh_failed' }, { status: 502 })
  }
}
