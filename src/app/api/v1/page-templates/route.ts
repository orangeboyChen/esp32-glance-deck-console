import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import { pageTemplates } from '@/lib/page-templates'
import type { PageTemplate } from '@/lib/api-contracts'

export const GET = apiRoute<{ templates: PageTemplate[] }>(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  return { data: { templates: pageTemplates } }
})
