import { createHash } from 'node:crypto'

import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { publishDeviceRelease } from '../messaging/mqtt'
import { MONO1_IMAGE_FORMAT, renderDeviceBitmap, type DisplayDocument } from '@/server/display/preview'
import { devices, displayBindings, displayReleasePages, displayReleases } from '@/server/database/schema'

type SourceValues = Record<string, string | number | null>
type PublishSourceDependencies = {
  database?: NonNullable<typeof db>
  publishRelease?: typeof publishDeviceRelease
}

const systemDocument: DisplayDocument = {
  title: 'System',
  subtitle: 'Last verified page retained',
  icon: 'system',
  lines: [
    { label: 'Wi-Fi', value: 'Reconnect' },
    { label: 'Last update', value: '09:30' },
    { label: 'Power', value: 'Battery N/A' },
    { label: 'Firmware', value: '0.1.0' },
  ],
}

export const templateValue = (value: string, values: SourceValues) => {
  return value.replace(/\{\{([a-z_]+)\}\}/g, (match, key: string) => String(values[key] ?? '—'))
}

export const renderBoundDocument = (template: DisplayDocument, values: SourceValues): DisplayDocument => {
  const used = typeof values.used === 'number' ? values.used : Number(values.used)
  const total = typeof values.total === 'number' ? values.total : Number(values.total)
  const inferredProgress =
    Number.isFinite(used) && Number.isFinite(total)
      ? { value: used, max: total, label: 'Used', unit: String(values.unit ?? '') }
      : undefined
  const progresses = template.progresses?.map((progress) => ({
    value: Number(templateValue(String(progress.value), values)),
    max: Number(templateValue(String(progress.max), values)),
    label: progress.label ? templateValue(progress.label, values) : undefined,
    unit: progress.unit ? templateValue(progress.unit, values) : undefined,
  }))
  return {
    title: templateValue(template.title, values),
    subtitle: template.subtitle ? templateValue(template.subtitle, values) : undefined,
    icon: template.icon ?? (inferredProgress ? 'usage' : undefined),
    progress: progresses?.length
      ? undefined
      : template.progress
        ? {
            value: Number(templateValue(String(template.progress.value), values)),
            max: Number(templateValue(String(template.progress.max), values)),
            label: template.progress.label ? templateValue(template.progress.label, values) : undefined,
            unit: template.progress.unit ? templateValue(template.progress.unit, values) : undefined,
          }
        : inferredProgress,
    progresses,
    usage_details: template.usage_details?.map((detail) => ({
      remaining: detail.remaining ? templateValue(detail.remaining, values) : undefined,
      resets_at: detail.resets_at ? templateValue(detail.resets_at, values) : undefined,
    })),
    lines: template.lines?.map((line) => ({ label: templateValue(line.label, values), value: templateValue(line.value, values) })),
  }
}

export const publishSourceChanges = async (sourceId: string, values: SourceValues, dependencies: PublishSourceDependencies = {}) => {
  const database = dependencies.database ?? db
  const publishRelease = dependencies.publishRelease ?? publishDeviceRelease
  if (!database) {
    return 0
  }
  const bindings = await database.select().from(displayBindings).where(eq(displayBindings.source_id, sourceId))
  let published = 0

  for (const binding of bindings) {
    const document = renderBoundDocument(binding.document_template, values)
    const rendered = renderDeviceBitmap(document)
    const contentSha256 = createHash('sha256').update(rendered.device_image).digest('hex')
    const includeSystem = binding.page_id !== 'system'
    const systemRendered = includeSystem ? renderDeviceBitmap(systemDocument) : undefined
    const systemContentSha256 = systemRendered ? createHash('sha256').update(systemRendered.device_image).digest('hex') : undefined
    const assigned = await database
      .select({ id: devices.id, release_id: devices.release_id })
      .from(devices)
      .where(inArray(devices.id, binding.device_ids))
    if (assigned.length !== binding.device_ids.length) {
      throw new Error('display_binding_device_not_found')
    }

    const existing =
      assigned.length > 0
        ? await database
            .select({ id: displayReleases.id })
            .from(displayReleases)
            .where(
              and(
                inArray(
                  displayReleases.id,
                  assigned.map((device) => device.release_id).filter((releaseId): releaseId is string => Boolean(releaseId)),
                ),
                eq(displayReleases.content_sha256, contentSha256),
              ),
            )
            .limit(1)
        : []
    if (existing[0] && assigned.every((device) => device.release_id === existing[0].id)) {
      continue
    }

    const created = await database.transaction(async (transaction) => {
      const [latestRelease] = await transaction
        .select({ version: displayReleases.version })
        .from(displayReleases)
        .orderBy(desc(displayReleases.version))
        .limit(1)
      const nextVersion = (latestRelease?.version ?? 0) + 1
      const releases = await transaction
        .insert(displayReleases)
        .values({
          version: nextVersion,
          page_id: binding.page_id,
          document,
          preview_svg: rendered.preview_svg,
          device_image: rendered.device_image,
          image_format: MONO1_IMAGE_FORMAT,
          image_width: 400,
          image_height: 300,
          content_sha256: contentSha256,
        })
        .returning()
      const [release] = releases
      const pages = [
        {
          release_id: release.id,
          page_id: binding.page_id,
          position: 0,
          document,
          preview_svg: rendered.preview_svg,
          device_image: rendered.device_image,
          image_format: MONO1_IMAGE_FORMAT,
          image_width: 400,
          image_height: 300,
          content_sha256: contentSha256,
        },
      ]
      if (systemRendered && systemContentSha256) {
        pages.push({
          release_id: release.id,
          page_id: 'system',
          position: 1,
          document: systemDocument,
          preview_svg: systemRendered.preview_svg,
          device_image: systemRendered.device_image,
          image_format: MONO1_IMAGE_FORMAT,
          image_width: 400,
          image_height: 300,
          content_sha256: systemContentSha256,
        })
      }
      await transaction.insert(displayReleasePages).values(pages)
      await transaction
        .update(devices)
        .set({
          release_id: release.id,
          desired_page_id: binding.page_id,
          enabled_page_ids: includeSystem ? [binding.page_id, 'system'] : ['system'],
        })
        .where(inArray(devices.id, binding.device_ids))
      return release
    })
    const baseUrl = process.env.DEVICE_ASSET_URL ?? process.env.APP_URL
    if (!baseUrl?.startsWith('https://')) {
      throw new Error('device_asset_url_https_required')
    }
    await Promise.all(
      binding.device_ids.map((deviceId: string) =>
        publishRelease(deviceId, {
          id: created.id,
          version: created.version,
          active_page_id: created.page_id,
          pages: [
            {
              page_id: created.page_id,
              image_format: created.image_format,
              image_width: created.image_width,
              image_height: created.image_height,
              image_sha256: created.content_sha256,
              image_bytes: rendered.device_image.length,
            },
            ...(systemRendered && systemContentSha256
              ? [
                  {
                    page_id: 'system',
                    image_format: MONO1_IMAGE_FORMAT,
                    image_width: 400,
                    image_height: 300,
                    image_sha256: systemContentSha256,
                    image_bytes: systemRendered.device_image.length,
                  },
                ]
              : []),
          ],
        }),
      ),
    )
    published += binding.device_ids.length
  }
  return published
}
