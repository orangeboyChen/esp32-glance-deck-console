import { and, desc, eq, inArray } from 'drizzle-orm'

import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { devices, displayReleasePages, displayReleases, sourceSnapshots, usageSources } from '@/server/database/schema'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { DisplayDocument, DisplayResponse, JsonObject } from '@/lib/api-contracts'

type DisplayRouteContext = { params: Promise<{ device_id: string }> }

export const GET = apiRoute<DisplayResponse, DisplayRouteContext>(async (request, context) => {
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await requireApiScope(request, 'devices:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }

  const { device_id: deviceId } = await context.params
  const [display] = await db
    .select({
      release_id: displayReleases.id,
      version: displayReleases.version,
      page_id: displayReleasePages.page_id,
      document: displayReleasePages.document,
      image_format: displayReleasePages.image_format,
      image_width: displayReleasePages.image_width,
      image_height: displayReleasePages.image_height,
      device_image: displayReleasePages.device_image,
      content_sha256: displayReleasePages.content_sha256,
      created_at: displayReleases.created_at,
    })
    .from(devices)
    .innerJoin(displayReleases, eq(devices.release_id, displayReleases.id))
    .innerJoin(
      displayReleasePages,
      and(eq(displayReleasePages.release_id, displayReleases.id), eq(displayReleasePages.page_id, devices.active_page_id)),
    )
    .where(eq(devices.id, deviceId))
    .limit(1)

  if (!display) {
    throw new ApiRouteError('display_not_found', 404)
  }
  const snapshots = await db
    .select({
      values: sourceSnapshots.values,
      fetched_at: sourceSnapshots.fetched_at,
      source_name: usageSources.name,
      mapper: usageSources.mapper,
    })
    .from(sourceSnapshots)
    .innerJoin(usageSources, eq(sourceSnapshots.source_id, usageSources.id))
    .where(inArray(usageSources.status, ['active', 'refreshing']))
    .orderBy(desc(sourceSnapshots.fetched_at))
    .limit(100)
  const soruxgptSnapshot = snapshots.find((snapshot) => snapshot.mapper?.provider === 'soruxgpt_codex')
  const freshSoruxgptSnapshot =
    soruxgptSnapshot && Date.now() - soruxgptSnapshot.fetched_at.getTime() <= 30 * 60 * 1000 ? soruxgptSnapshot : null
  const latestSnapshot = freshSoruxgptSnapshot ? undefined : snapshots[0]
  const snapshot = freshSoruxgptSnapshot ?? latestSnapshot
  const { device_image: deviceImage, ...document } = display
  const response: DisplayResponse = {
    ...document,
    document: document.document as DisplayDocument,
    created_at: document.created_at.toISOString(),
    image_bytes: deviceImage.length,
    source: snapshot
      ? {
          values: snapshot.values as JsonObject,
          fetched_at: snapshot.fetched_at.toISOString(),
          source_name: snapshot.source_name,
          mapper: snapshot.mapper as JsonObject,
        }
      : null,
    stale: !snapshot || Date.now() - snapshot.fetched_at.getTime() > 30 * 60 * 1000,
  }
  return { data: response }
})
