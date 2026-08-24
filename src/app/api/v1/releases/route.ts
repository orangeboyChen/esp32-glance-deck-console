import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'
import { asc, desc, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/server/database/db'
import { publishDeviceRelease } from '@/server/messaging/mqtt'
import { MONO1_IMAGE_FORMAT, renderDeviceBitmap } from '@/server/display/preview'
import { currentAdministrator } from '@/server/auth/session'
import { devices, displayReleasePages, displayReleases } from '@/server/database/schema'

const progressSchema = z.object({
  value: z.union([z.number(), z.string().max(48)]),
  max: z.union([z.number(), z.string().max(48)]),
  label: z.string().max(48).optional(),
  unit: z.string().max(16).optional(),
})
const documentSchema = z.object({
  title: z.string().min(1).max(48),
  subtitle: z.string().max(80).optional(),
  icon: z.enum(['usage', 'battery', 'wifi', 'system', 'home']).optional(),
  progress: progressSchema.optional(),
  progresses: z.array(progressSchema).min(1).max(3).optional(),
  usage_details: z
    .array(z.object({ remaining: z.string().max(48).optional(), resets_at: z.string().max(48).optional() }))
    .max(3)
    .optional(),
  lines: z
    .array(z.object({ label: z.string().max(48), value: z.string().max(48) }))
    .max(7)
    .optional(),
})
const pageSchema = z.object({ page_id: z.string().regex(/^[a-z0-9-]{1,64}$/), document: documentSchema })
const releaseSchema = z
  .object({
    active_page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    pages: z.array(pageSchema).min(1).max(10),
    device_ids: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).min(1),
  })
  .superRefine((release, context) => {
    if (!release.pages.some((page) => page.page_id === release.active_page_id)) {
      context.addIssue({ code: 'custom', message: 'active_page_not_found', path: ['active_page_id'] })
    }
    const pageIds = new Set(release.pages.map((page) => page.page_id))
    if (pageIds.size !== release.pages.length) context.addIssue({ code: 'custom', message: 'page_ids_must_be_unique', path: ['pages'] })
    if (!pageIds.has('system')) context.addIssue({ code: 'custom', message: 'system_page_required', path: ['pages'] })
  })

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const body = releaseSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_release', issues: body.error.issues }, { status: 400 })
  const orderedPages = [
    ...body.data.pages.filter((page) => page.page_id !== 'system'),
    ...body.data.pages.filter((page) => page.page_id === 'system'),
  ]
  const renderedPages = orderedPages.map((page, position) => {
    const rendered = renderDeviceBitmap(page.document)
    return { ...page, position, ...rendered, content_sha256: createHash('sha256').update(rendered.device_image).digest('hex') }
  })
  const activePage = renderedPages.find((page) => page.page_id === body.data.active_page_id)
  if (!activePage) return NextResponse.json({ error: 'invalid_release' }, { status: 400 })
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
    if (targets.length !== body.data.device_ids.length) throw new Error('device_not_found')
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
  return NextResponse.json({ release: metadata, failed_devices: failedDevices }, { status: failedDevices.length ? 202 : 201 })
}

export const GET = async () => {
  if (!(await currentAdministrator())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json({ releases: await db.select().from(displayReleases).orderBy(asc(displayReleases.version)) })
}
