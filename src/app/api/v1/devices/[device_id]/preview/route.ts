import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, displayReleasePages, displayReleases } from '@/server/database/schema'
import { fallbackPreviewSvg } from '@/server/display/preview'
import { ApiRouteError, apiRoute } from '@/lib/api-response'

type PreviewRouteContext = { params: Promise<{ device_id: string }> }

export const GET = apiRoute<never, PreviewRouteContext>(async (request, context) => {
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }

  const { device_id: deviceId } = await context.params
  const [row] = db
    ? await db
        .select({ preview_svg: displayReleasePages.preview_svg })
        .from(devices)
        .leftJoin(displayReleases, eq(devices.release_id, displayReleases.id))
        .leftJoin(
          displayReleasePages,
          and(eq(displayReleasePages.release_id, displayReleases.id), eq(displayReleasePages.page_id, devices.active_page_id)),
        )
        .where(eq(devices.id, deviceId))
        .limit(1)
    : []

  return new NextResponse(row?.preview_svg ?? fallbackPreviewSvg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
  })
})
