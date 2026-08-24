import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/server/database/db'
import { encryptSecret } from '@/server/security/secrets'
import { currentAdministrator } from '@/server/auth/session'
import { usageSources } from '@/server/database/schema'
import { sourceCreateRequestSchema } from '@/lib/api-contracts'
import type { CreateSourceResponse, ListSourcesResponse } from '@/lib/api-contracts'

export const GET = async () => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const sources = await db
    .select({
      id: usageSources.id,
      name: usageSources.name,
      base_url: usageSources.base_url,
      request_path: usageSources.request_path,
      method: usageSources.method,
      mapper: usageSources.mapper,
      refresh_interval_seconds: usageSources.refresh_interval_seconds,
      status: usageSources.status,
      last_success_at: usageSources.last_success_at,
      last_error: usageSources.last_error,
    })
    .from(usageSources)
    .orderBy(desc(usageSources.created_at))
  const response: ListSourcesResponse = {
    sources: sources.map((source) => ({
      ...source,
      method: source.method as 'GET' | 'POST',
      last_success_at: source.last_success_at?.toISOString() ?? null,
    })),
  }
  return NextResponse.json(response)
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = sourceCreateRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_source', issues: body.error.issues }, { status: 400 })
  }
  try {
    const [source] = await db
      .insert(usageSources)
      .values({ ...body.data, secret_ciphertext: encryptSecret(body.data.secrets) })
      .returning({ id: usageSources.id, name: usageSources.name })
    const response: CreateSourceResponse = { source }
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'source_create_failed' }, { status: 400 })
  }
}
