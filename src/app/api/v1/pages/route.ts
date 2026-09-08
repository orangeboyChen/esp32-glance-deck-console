import { asc, eq } from 'drizzle-orm'

import { currentAdministrator } from '@/server/auth/session'
import { db } from '@/server/database/db'
import { displayPageDefinitions, usageSources } from '@/server/database/schema'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import { pageDefinitionRequestSchema } from '@/lib/api-contracts'
import type { ListPageDefinitionsResponse, PageDefinitionRequest, PageProviderType } from '@/lib/api-contracts'
import { pageTemplates as PAGE_TEMPLATES } from '@/lib/page-templates'

const publicDefinition = (page: typeof displayPageDefinitions.$inferSelect) => ({
  ...page,
  provider_type: page.provider_type as PageProviderType,
  document_template: page.document_template as PageDefinitionRequest['document_template'],
  created_at: page.created_at.toISOString(),
  updated_at: page.updated_at.toISOString(),
})

export const GET = apiRoute<ListPageDefinitionsResponse>(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const pages = await db.select().from(displayPageDefinitions).orderBy(asc(displayPageDefinitions.created_at))
  return { data: { pages: pages.map(publicDefinition) } }
})

export const POST = async (request: Request) =>
  requestJson<PageDefinitionRequest, { page: ReturnType<typeof publicDefinition> }>(pageDefinitionRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const template = PAGE_TEMPLATES.find((item) => item.id === payload.template_id && item.provider_type === payload.provider_type)
    if (!template) {
      throw new ApiRouteError('page_template_not_found', 400)
    }
    if (template.requires_source && !payload.source_id) {
      throw new ApiRouteError('page_source_required', 400)
    }
    if (payload.source_id) {
      const [source] = await db
        .select({ id: usageSources.id, last_success_at: usageSources.last_success_at })
        .from(usageSources)
        .where(eq(usageSources.id, payload.source_id))
        .limit(1)
      if (!source) {
        throw new ApiRouteError('source_not_found', 400)
      }
      if (!source.last_success_at) {
        throw new ApiRouteError('source_not_verified', 400)
      }
    }
    const existing = await db.select({ page_id: displayPageDefinitions.page_id }).from(displayPageDefinitions)
    if (existing.length >= 9) {
      throw new ApiRouteError('page_limit_reached', 400)
    }
    try {
      const [page] = await db
        .insert(displayPageDefinitions)
        .values({ ...payload, source_id: payload.source_id ?? null })
        .returning()
      return { data: { page: publicDefinition(page) }, init: { status: 201 } }
    } catch (error) {
      throw new ApiRouteError(error instanceof Error ? error.message : 'page_create_failed', 400)
    }
  })(request)
