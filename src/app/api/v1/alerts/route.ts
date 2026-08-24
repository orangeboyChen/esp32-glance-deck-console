import { desc, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { alertRules, devices } from '@/server/database/schema'
import { currentAdministrator } from '@/server/auth/session'
import { apiResponse } from '@/lib/api-response'
import type { CreateAlertResponse, ListAlertsResponse } from '@/lib/api-contracts'
import { alertCreateRequestSchema } from '@/lib/api-contracts'

export const GET = async (request: Request) => {
  if (!(await requireApiScope(request, 'alerts:read'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const rules = await db.select().from(alertRules).orderBy(desc(alertRules.created_at))
  return apiResponse<ListAlertsResponse>({ rules: rules.map((rule) => ({ ...rule, created_at: rule.created_at.toISOString() })) })
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = alertCreateRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_alert_rule', issues: body.error.issues }, { status: 400 })
  }
  const existingDevices = await db.select({ id: devices.id }).from(devices).where(inArray(devices.id, body.data.device_ids))
  if (existingDevices.length !== body.data.device_ids.length) {
    return NextResponse.json({ error: 'alert_device_not_found' }, { status: 400 })
  }
  const [rule] = await db.insert(alertRules).values(body.data).returning()
  return apiResponse<CreateAlertResponse>({ rule: { ...rule, created_at: rule.created_at.toISOString() } }, { status: 201 })
}
