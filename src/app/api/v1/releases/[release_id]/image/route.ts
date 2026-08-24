import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth/auth'
import { verifyReleaseImageSignature } from '@/server/display/assets'
import { db } from '@/server/database/db'
import { displayReleases } from '@/server/database/schema'
import { ApiRouteError, apiRoute } from '@/lib/api-response'

type ReleaseRouteContext = { params: Promise<{ release_id: string }> }

export const GET = apiRoute<never, ReleaseRouteContext>(async (request, context) => {
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  const { release_id: releaseId } = await context.params
  const url = new URL(request.url)
  const signedRequest = verifyReleaseImageSignature(releaseId, url.searchParams.get('expires_at'), url.searchParams.get('signature'))
  if (!signedRequest && !(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const [release] = await db
    .select({ device_image: displayReleases.device_image, content_sha256: displayReleases.content_sha256 })
    .from(displayReleases)
    .where(eq(displayReleases.id, releaseId))
    .limit(1)
  if (!release) {
    throw new ApiRouteError('release_not_found', 404)
  }
  return new NextResponse(release.device_image, {
    headers: {
      'content-type': 'application/vnd.glance-deck.mono1',
      'cache-control': 'public, immutable, max-age=31536000',
      etag: `"${release.content_sha256}"`,
    },
  })
})
