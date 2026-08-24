import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { apiTokens } from '@/server/database/schema'

export const DELETE = async (request: Request, { params }: { params: Promise<{ token_id: string }> }) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const { token_id: tokenId } = await params
  const [token] = await db
    .update(apiTokens)
    .set({ revoked_at: new Date() })
    .where(and(eq(apiTokens.id, tokenId), isNull(apiTokens.revoked_at)))
    .returning({ id: apiTokens.id })
  if (!token) return NextResponse.json({ error: 'token_not_found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
