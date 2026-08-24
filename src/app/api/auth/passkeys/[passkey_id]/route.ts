import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { currentAdministrator } from '@/server/session'
import { db } from '@/server/db'
import { passkeys } from '@/server/schema'

export const DELETE = async (request: Request, { params }: { params: Promise<{ passkey_id: string }> }) => {
  const administrator = await currentAdministrator()
  if (!administrator) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const { passkey_id: passkeyId } = await params
  const [removed] = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.administrator_id, administrator.id)))
    .returning({ id: passkeys.id })
  if (!removed) return NextResponse.json({ error: 'passkey_not_found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
