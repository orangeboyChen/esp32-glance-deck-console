import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/server/database/db'
import { alertRules } from '@/server/database/schema'
import { currentAdministrator } from '@/server/auth/session'
import type { DeleteAlertResponse } from '@/lib/api-contracts'

export const DELETE = async (request: Request, { params }: { params: Promise<{ alert_id: string }> }) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const { alert_id: alertId } = await params
  const [rule] = await db
    .update(alertRules)
    .set({ enabled: false, active: false })
    .where(eq(alertRules.id, alertId))
    .returning({ id: alertRules.id })
  if (!rule) {
    return NextResponse.json({ error: 'alert_not_found' }, { status: 404 })
  }
  const response: DeleteAlertResponse = { rule }
  return NextResponse.json(response)
}
