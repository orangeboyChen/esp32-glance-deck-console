import { NextResponse } from 'next/server'
import { createApiToken, hashSecret } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'
import { desc, isNull } from 'drizzle-orm'
import type { CreateTokenResponse, ListTokensResponse } from '@/lib/api-contracts'
import { tokenRequestSchema } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = tokenRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_token_request' }, { status: 400 })
  }

  const token = createApiToken()
  const [record] = await db
    .insert(apiTokens)
    .values({
      label: body.data.label,
      token_hash: hashSecret(token),
      scopes: body.data.scopes,
    })
    .returning({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes })

  const response: CreateTokenResponse = { token, record }
  return NextResponse.json(response, { status: 201 })
}

export const GET = async () => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const tokens = await db
    .select({ id: apiTokens.id, label: apiTokens.label, scopes: apiTokens.scopes, created_at: apiTokens.created_at })
    .from(apiTokens)
    .where(isNull(apiTokens.revoked_at))
    .orderBy(desc(apiTokens.created_at))
  const response: ListTokensResponse = {
    tokens: tokens.map((item) => ({ ...item, created_at: item.created_at.toISOString() })),
  }
  return NextResponse.json(response)
}
