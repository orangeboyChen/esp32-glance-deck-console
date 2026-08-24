import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { currentAdministrator } from '@/server/auth/session'
import { db } from '@/server/database/db'
import { passkeys } from '@/server/database/schema'
import type { ListPasskeysResponse } from '@/lib/api-contracts'

export const GET = async () => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const records = await db
    .select({ id: passkeys.id, created_at: passkeys.created_at, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.administrator_id, administrator.id))
    .orderBy(passkeys.created_at)
  const response: ListPasskeysResponse = {
    passkeys: records.map((record) => ({ ...record, created_at: record.created_at.toISOString() })),
  }
  return NextResponse.json(response)
}
