import { NextResponse } from 'next/server'
import { requireApiScope } from '@/server/auth/auth'
import { getDevicePageConfiguration, updateDevicePageConfiguration } from '@/server/device/device-pages'
import { pageConfigurationRequestSchema } from '@/lib/api-contracts'
import type { PageConfiguration } from '@/lib/api-contracts'

export const GET = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { device_id: deviceId } = await params
  const configuration = await getDevicePageConfiguration(deviceId)
  return configuration ? NextResponse.json(configuration) : NextResponse.json({ error: 'device_release_not_found' }, { status: 404 })
}

export const PUT = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:command'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = pageConfigurationRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_page_configuration', issues: body.error.issues }, { status: 400 })
  }
  try {
    const { device_id: deviceId } = await params
    const response: PageConfiguration = await updateDevicePageConfiguration(deviceId, body.data.enabled_page_ids, body.data.desired_page_id)
    return NextResponse.json(response)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'page_configuration_failed'
    const status = code === 'database_unavailable' ? 503 : code === 'device_release_not_found' ? 404 : 400
    return NextResponse.json({ error: code }, { status })
  }
}
