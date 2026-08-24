import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'
import { asc, desc, inArray } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { publishDeviceRelease } from '@/server/messaging/mqtt'
import { MONO1_IMAGE_FORMAT, renderDeviceBitmap } from '@/server/display/preview'
import { currentAdministrator } from '@/server/auth/session'
import { devices, displayReleasePages, displayReleases } from '@/server/database/schema'
import { releaseRequestSchema } from '@/lib/api-contracts'
import type { ListReleasesResponse, PublishReleaseResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = releaseRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_release', issues: body.error.issues }, { status: 400 })
  }
  const orderedPages = [
    ...body.data.pages.filter((page) => page.page_id !== 'system'),
    ...body.data.pages.filter((page) => page.page_id === 'system'),
  ]
  const renderedPages = orderedPages.map((page, position) => {
    const rendered = renderDeviceBitmap(page.document)
    return { ...page, position, ...rendered, content_sha256: createHash('sha256').update(rendered.device_image).digest('hex') }
  })
  const activePage = renderedPages.find((page) => page.page_id === body.data.active_page_id)
  if (!activePage) {
    return NextResponse.json({ error: 'invalid_release' }, { status: 400 })
  }
  const release = await db.transaction(async (transaction) => {
    const [latestRelease] = await transaction
      .select({ version: displayReleases.version })
      .from(displayReleases)
      .orderBy(desc(displayReleases.version))
      .limit(1)
    const nextVersion = (latestRelease?.version ?? 0) + 1
    const [created] = await transaction
      .insert(displayReleases)
      .values({
        version: nextVersion,
        page_id: activePage.page_id,
        document: activePage.document,
        preview_svg: activePage.preview_svg,
        device_image: activePage.device_image,
        image_format: MONO1_IMAGE_FORMAT,
        image_width: 400,
        image_height: 300,
        content_sha256: activePage.content_sha256,
      })
      .returning()
    await transaction.insert(displayReleasePages).values(
      renderedPages.map((page) => ({
        release_id: created.id,
        page_id: page.page_id,
        position: page.position,
        document: page.document,
        preview_svg: page.preview_svg,
        device_image: page.device_image,
        image_format: MONO1_IMAGE_FORMAT,
        image_width: 400,
        image_height: 300,
        content_sha256: page.content_sha256,
      })),
    )
    const targets = await transaction.select({ id: devices.id }).from(devices).where(inArray(devices.id, body.data.device_ids))
    if (targets.length !== body.data.device_ids.length) {
      throw new Error('device_not_found')
    }
    await transaction
      .update(devices)
      .set({
        release_id: created.id,
        desired_page_id: body.data.active_page_id,
        enabled_page_ids: renderedPages.map((page) => page.page_id),
      })
      .where(inArray(devices.id, body.data.device_ids))
    return { created, targets }
  })
  const metadata = {
    id: release.created.id,
    version: release.created.version,
    active_page_id: body.data.active_page_id,
    pages: renderedPages.map((page) => ({
      page_id: page.page_id,
      image_format: MONO1_IMAGE_FORMAT,
      image_width: 400,
      image_height: 300,
      image_sha256: page.content_sha256,
      image_bytes: page.device_image.length,
    })),
  }
  const published = await Promise.allSettled(release.targets.map(({ id }) => publishDeviceRelease(id, metadata)))
  const failedDevices = release.targets.filter((device, index) => published[index].status === 'rejected').map(({ id }) => id)
  const response: PublishReleaseResponse = { release: metadata, failed_devices: failedDevices }
  return NextResponse.json(response, { status: failedDevices.length ? 202 : 201 })
}

export const GET = async () => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const response: ListReleasesResponse = {
    releases: (await db.select().from(displayReleases).orderBy(asc(displayReleases.version))).map((release) => ({
      id: release.id,
      version: release.version,
      page_id: release.page_id,
      created_at: release.created_at.toISOString(),
    })),
  }
  return NextResponse.json(response)
}
