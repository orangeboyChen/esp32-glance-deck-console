import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireApiScope } from '@/server/auth'
import { db } from '@/server/db'
import { validateDevicePageCommand } from '@/server/device-pages'
import { deviceCommands, devices } from '@/server/schema'

const commandSchema = z.object({
  action: z.enum(['show_page', 'next_page', 'previous_page', 'set_rotation', 'refresh_release', 'enter_maintenance']),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const POST = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:command'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })

  const body = commandSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_command', issues: body.error.issues }, { status: 400 })

  const { device_id: deviceId } = await params
  const [device] = await db.select({ id: devices.id }).from(devices).where(eq(devices.id, deviceId)).limit(1)
  if (!device) return NextResponse.json({ error: 'device_not_found' }, { status: 404 })
  try {
    await validateDevicePageCommand(deviceId, body.data.action, body.data.payload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid_command' }, { status: 400 })
  }
  const [command] = await db
    .insert(deviceCommands)
    .values({
      device_id: deviceId,
      action: body.data.action,
      payload: body.data.payload,
    })
    .returning()

  if (body.data.action === 'show_page') {
    await db
      .update(devices)
      .set({ desired_page_id: body.data.payload.page_id as string })
      .where(eq(devices.id, deviceId))
  }

  return NextResponse.json({ command }, { status: 202 })
}
