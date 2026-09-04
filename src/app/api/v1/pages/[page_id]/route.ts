import { eq } from 'drizzle-orm'
import { currentAdministrator } from '@/server/auth/session'
import { db } from '@/server/database/db'
import { displayPageDefinitions } from '@/server/database/schema'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { pageDefinitionRequestSchema } from '@/lib/api-contracts'
import type { PageDefinitionRequest } from '@/lib/api-contracts'

const idFromParams = async (context: { params: Promise<{ page_id: string }> }) => (await context.params).page_id
const publicDefinition = (page: typeof displayPageDefinitions.$inferSelect) => ({
  ...page,
  document_template: page.document_template as PageDefinitionRequest['document_template'],
  created_at: page.created_at.toISOString(),
  updated_at: page.updated_at.toISOString(),
})

export const PATCH = async (request: Request, context: { params: Promise<{ page_id: string }> }) =>
  requestJson<PageDefinitionRequest, { page: ReturnType<typeof publicDefinition> }>(pageDefinitionRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const pageId = await idFromParams(context)
    const [page] = await db
      .update(displayPageDefinitions)
      .set({ ...payload, source_id: payload.source_id ?? null, updated_at: new Date() })
      .where(eq(displayPageDefinitions.page_id, pageId))
      .returning()
    if (!page) {
      throw new ApiRouteError('page_not_found', 404)
    }
    return { data: { page: publicDefinition(page) } }
  })(request)

export const DELETE = async (request: Request, context: { params: Promise<{ page_id: string }> }) => {
  void request
  if (!(await currentAdministrator())) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }
  if (!db) {
    return new Response(JSON.stringify({ error: 'database_unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } })
  }
  const pageId = await idFromParams(context)
  await db.delete(displayPageDefinitions).where(eq(displayPageDefinitions.page_id, pageId))
  return new Response(null, { status: 204 })
}
