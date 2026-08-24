import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/server/database/db'
import { encryptSecret } from '@/server/security/secrets'
import { currentAdministrator } from '@/server/auth/session'
import { usageSources } from '@/server/database/schema'

const sourceSchema = z.object({
  name: z.string().min(1).max(128),
  base_url: z.url(),
  request_path: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).default({}),
  body_template: z.string().max(8192).optional(),
  secrets: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), z.string()).default({}),
  mapper: z
    .record(z.string(), z.string().max(256))
    .refine((mapper) =>
      Object.keys(mapper).every((key) =>
        ['plan_name', 'used', 'remaining', 'total', 'unit', 'resets_at', 'status', 'provider'].includes(key),
      ),
    ),
  refresh_interval_seconds: z.number().int().min(60).max(86_400).default(900),
})

export const GET = async () => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
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
  return NextResponse.json({ sources })
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = sourceSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_source', issues: body.error.issues }, { status: 400 })
  try {
    const [source] = await db
      .insert(usageSources)
      .values({ ...body.data, secret_ciphertext: encryptSecret(body.data.secrets) })
      .returning({ id: usageSources.id, name: usageSources.name })
    return NextResponse.json({ source }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'source_create_failed' }, { status: 400 })
  }
}
