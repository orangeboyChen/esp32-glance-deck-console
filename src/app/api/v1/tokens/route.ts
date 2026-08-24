import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createApiToken, hashSecret } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'
import { desc, isNull } from 'drizzle-orm'

const tokenSchema = z.object({
  label: z.string().min(1).max(128),
  scopes: z.array(z.enum(['devices:read', 'devices:command', 'alerts:read', 'ota:install'])).min(1),
})

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = tokenSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_token_request' }, { status: 400 })

  const token = createApiToken()
  const [record] = await db
    .insert(apiTokens)
    .values({
      label: body.data.label,
      token_hash: hashSecret(token),
      scopes: body.data.scopes,
    })
    .returning({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes })

  return NextResponse.json({ token, record }, { status: 201 })
}

export const GET = async () => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const tokens = await db
    .select({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes, created_at: apiTokens.created_at })
    .from(apiTokens)
    .where(isNull(apiTokens.revoked_at))
    .orderBy(desc(apiTokens.created_at))
  return NextResponse.json({ tokens })
}
