import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth'
import { db } from '@/server/db'
import { devices, displayReleasePages, displayReleases } from '@/server/schema'
import { fallbackPreviewSvg } from '@/server/preview'

export const GET = async (request: Request, { params }: { params: Promise<{ device_id: string }> }) => {
  if (!(await requireApiScope(request, 'devices:read'))) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const { device_id: deviceId } = await params
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
}
