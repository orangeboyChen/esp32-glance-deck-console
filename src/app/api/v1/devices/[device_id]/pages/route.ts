import { requireApiScope } from '@/server/auth/auth'
import { getDevicePageConfiguration, updateDevicePageConfiguration } from '@/server/device/device-pages'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import { pageConfigurationRequestSchema } from '@/lib/api-contracts'
import type { PageConfiguration, PageConfigurationRequest } from '@/lib/api-contracts'

type DeviceRouteContext = { params: Promise<{ device_id: string }> }

export const GET = apiRoute<PageConfiguration, DeviceRouteContext>(async (request, context) => {
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  const { device_id: deviceId } = await context.params
  const configuration = await getDevicePageConfiguration(deviceId)
  if (!configuration) {
    throw new ApiRouteError('device_release_not_found', 404)
  }
  return { data: configuration }
})

export const PUT = (request: Request, context: DeviceRouteContext) => {
  const { params } = context
  return requestJson<PageConfigurationRequest, PageConfiguration>(pageConfigurationRequestSchema, async (payload, request) => {
    if (!(await requireApiScope(request, 'devices:command'))) {
      throw new ApiRouteError('unauthorized', 401)
    }
    const { device_id: deviceId } = await params
    try {
      const response = await updateDevicePageConfiguration(deviceId, payload.enabled_page_ids, payload.desired_page_id)
      return { data: response }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'page_configuration_failed'
      const status = code === 'database_unavailable' ? 503 : code === 'device_release_not_found' ? 404 : 400
      throw new ApiRouteError(code, status)
    }
  })(request)
}
