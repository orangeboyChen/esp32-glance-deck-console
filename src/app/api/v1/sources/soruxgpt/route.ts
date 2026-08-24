import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/server/db'
import { encryptSecret } from '@/server/secrets'
import { currentAdministrator } from '@/server/session'
import { usageSources } from '@/server/schema'
import { normalizeSoruxgptToken, publicSoruxgptSource } from '@/server/soruxgpt'
import { refreshUsageSource } from '@/server/usage-source'

const soruxgptSchema = z.object({ token: z.string().min(1).max(8192) })
const sourceName = 'SoruxGPT Codex'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = soruxgptSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_soruxgpt_token' }, { status: 400 })
  const token = normalizeSoruxgptToken(body.data.token)
  if (!token) return NextResponse.json({ error: 'invalid_soruxgpt_token' }, { status: 400 })

  const configuration = {
    name: sourceName,
    base_url: 'https://app.soruxgpt.com',
    request_path: '/api/v1/codex',
    method: 'GET',
    headers: { accept: 'application/json', authorization: 'Bearer {{SORUXGPT_TOKEN}}' },
    mapper: { provider: 'soruxgpt_codex' },
    refresh_interval_seconds: 900,
    secret_ciphertext: encryptSecret({ SORUXGPT_TOKEN: token }),
  }
  const {
    source,
    existing,
    refresh_in_progress: refreshInProgress,
    previous_source: previousSource,
  } = await db.transaction(async (transaction) => {
    const [current] = await transaction.select().from(usageSources).where(eq(usageSources.name, sourceName)).limit(1)
    if (current?.status === 'refreshing')
      return { source: publicSoruxgptSource(current as { id: string; name: string }), existing: true, refresh_in_progress: true }
    const updatedSource = current
      ? (
          await transaction
            .update(usageSources)
            .set({ ...configuration, status: 'refreshing', last_attempt_at: new Date(), last_error: null })
            .where(eq(usageSources.id, current.id))
            .returning({ id: usageSources.id, name: usageSources.name })
        )[0]
      : (
          await transaction
            .insert(usageSources)
            .values({ ...configuration, status: 'refreshing', last_attempt_at: new Date() })
            .returning({ id: usageSources.id, name: usageSources.name })
        )[0]
    return { source: updatedSource, existing: Boolean(current), refresh_in_progress: false, previous_source: current ?? null }
  })
  if (!source) return NextResponse.json({ error: 'source_create_failed' }, { status: 500 })
  if (refreshInProgress) return NextResponse.json({ source, error: 'source_refresh_in_progress' }, { status: 409 })
  try {
    return NextResponse.json({ source, values: await refreshUsageSource(source.id, true) }, { status: existing ? 200 : 201 })
  } catch (error) {
    if (previousSource) {
      await db
        .update(usageSources)
        .set({
          base_url: previousSource.base_url,
          request_path: previousSource.request_path,
          method: previousSource.method,
          headers: previousSource.headers,
          body_template: previousSource.body_template,
          secret_ciphertext: previousSource.secret_ciphertext,
          mapper: previousSource.mapper,
          refresh_interval_seconds: previousSource.refresh_interval_seconds,
          status: previousSource.status,
          last_attempt_at: previousSource.last_attempt_at,
          last_success_at: previousSource.last_success_at,
          last_error: previousSource.last_error,
        })
        .where(eq(usageSources.id, previousSource.id))
    } else {
      await db.delete(usageSources).where(eq(usageSources.id, source.id))
    }
    return NextResponse.json({ source, error: error instanceof Error ? error.message : 'soruxgpt_refresh_failed' }, { status: 502 })
  }
}
