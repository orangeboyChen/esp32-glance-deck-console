import { previewCcSwitchImport } from '@/server/source/cc-switch-import'
import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { jsonValueSchema } from '@/lib/api-contracts'
import type { PreviewCcSwitchResponse } from '@/lib/api-contracts'

export const POST = requestJson(jsonValueSchema, async (input) => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  try {
    const preview = previewCcSwitchImport(input)
    const response: PreviewCcSwitchResponse = { preview }
    return { data: response }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'cc_switch_export_invalid', 400)
  }
})
