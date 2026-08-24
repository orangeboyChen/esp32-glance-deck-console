import { renderDisplayPreview } from '@/server/display/preview'
import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import type { PreviewReleaseResponse } from '@/lib/api-contracts'
import { displayDocumentSchema } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  return requestJson(displayDocumentSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    const response: PreviewReleaseResponse = { preview_svg: renderDisplayPreview(payload), width: 400, height: 300 }
    return { data: response }
  })(request)
}
