import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth/auth'
import { verifyReleasePageImageSignature } from '@/server/display/assets'
import { db } from '@/server/database/db'
import { displayReleasePages } from '@/server/database/schema'
import { ApiRouteError, apiRoute } from '@/lib/api-response'

type ReleasePageRouteContext = { params: Promise<{ release_id: string; page_id: string }> }

export const GET = apiRoute<never, ReleasePageRouteContext>(async (request, context) => {
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  const { release_id: releaseId, page_id: pageId } = await context.params
  const url = new URL(request.url)
  const signedRequest = verifyReleasePageImageSignature(
    releaseId,
    pageId,
    url.searchParams.get('expires_at'),
    url.searchParams.get('signature'),
  )
  if (!signedRequest && !(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const [page] = await db
    .select({ device_image: displayReleasePages.device_image, content_sha256: displayReleasePages.content_sha256 })
    .from(displayReleasePages)
    .where(and(eq(displayReleasePages.release_id, releaseId), eq(displayReleasePages.page_id, pageId)))
    .limit(1)
  if (!page) {
    throw new ApiRouteError('release_page_not_found', 404)
  }
  return new NextResponse(page.device_image, {
    headers: {
      'content-type': 'application/vnd.glance-deck.mono1',
      'cache-control': 'public, immutable, max-age=31536000',
      etag: `"${page.content_sha256}"`,
    },
  })
})
