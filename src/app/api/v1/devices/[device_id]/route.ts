import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth'
import { db } from '@/server/db'
import { deviceCommands, devices, displayReleases } from '@/server/schema'

export const GET = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:read'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const { device_id: deviceId } = await params
  const [device] = await db
    .select({
      id: devices.id,
      name: devices.name,
      status: devices.status,
      board_model: devices.board_model,
      firmware_version: devices.firmware_version,
      wifi_rssi: devices.wifi_rssi,
      active_page_id: devices.active_page_id,
      desired_page_id: devices.desired_page_id,
      enabled_page_ids: devices.enabled_page_ids,
      power_source: devices.power_source,
      charging: devices.charging,
      battery_percent: devices.battery_percent,
      battery_mv: devices.battery_mv,
      power_updated_at: devices.power_updated_at,
      last_seen_at: devices.last_seen_at,
      release_id: displayReleases.id,
      release_version: displayReleases.version,
    })
    .from(devices)
    .leftJoin(displayReleases, eq(devices.release_id, displayReleases.id))
    .where(eq(devices.id, deviceId))
    .limit(1)
  if (!device) return NextResponse.json({ error: 'device_not_found' }, { status: 404 })
  const commands = await db
    .select()
    .from(deviceCommands)
    .where(eq(deviceCommands.device_id, deviceId))
    .orderBy(desc(deviceCommands.created_at))
    .limit(20)
  return NextResponse.json({ device, commands })
}
