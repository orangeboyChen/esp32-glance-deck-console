import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireApiScope } from '@/server/auth'
import { getDevicePageConfiguration, updateDevicePageConfiguration } from '@/server/device-pages'

const pageConfigurationSchema = z.object({
  enabled_page_ids: z
    .array(z.string().regex(/^[a-z0-9-]{1,64}$/))
    .min(1)
    .max(10),
  desired_page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
})

export const GET = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:read'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { device_id: deviceId } = await params
  const configuration = await getDevicePageConfiguration(deviceId)
  return configuration ? NextResponse.json(configuration) : NextResponse.json({ error: 'device_release_not_found' }, { status: 404 })
}

export const PUT = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:command'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = pageConfigurationSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_page_configuration', issues: body.error.issues }, { status: 400 })
  try {
    const { device_id: deviceId } = await params
    return NextResponse.json(await updateDevicePageConfiguration(deviceId, body.data.enabled_page_ids, body.data.desired_page_id))
  } catch (error) {
    const code = error instanceof Error ? error.message : 'page_configuration_failed'
    const status = code === 'database_unavailable' ? 503 : code === 'device_release_not_found' ? 404 : 400
    return NextResponse.json({ error: code }, { status })
  }
}
