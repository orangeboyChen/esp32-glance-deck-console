import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth/auth'
import { verifyReleaseImageSignature } from '@/server/display/assets'
import { db } from '@/server/database/db'
import { displayReleases } from '@/server/database/schema'

export const GET = async (request: Request, { params }: { params: Promise<{ release_id: string }> }) => {
  const { release_id: releaseId } = await params
  const url = new URL(request.url)
  const signedRequest = verifyReleaseImageSignature(releaseId, url.searchParams.get('expires_at'), url.searchParams.get('signature'))
  if (!signedRequest && !(await requireApiScope(request, 'devices:read'))) {
    return new NextResponse('unauthorized', { status: 401 })
  }
  if (!db) {
    return new NextResponse('database_unavailable', { status: 503 })
  }
  const [release] = await db
    .select({ device_image: displayReleases.device_image, content_sha256: displayReleases.content_sha256 })
    .from(displayReleases)
    .where(eq(displayReleases.id, releaseId))
    .limit(1)
  if (!release) {
    return new NextResponse('release_not_found', { status: 404 })
  }
  return new NextResponse(release.device_image, {
    headers: {
      'content-type': 'application/vnd.glance-deck.mono1',
      'cache-control': 'public, immutable, max-age=31536000',
      etag: `"${release.content_sha256}"`,
    },
  })
}
