import { asc, eq, sql } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { publishDeviceRelease, type ReleasePageMetadata } from '@/server/messaging/mqtt'
import { devices, displayReleasePages, displayReleases } from '@/server/database/schema'

export type DevicePageConfiguration = {
  device_id: string
  release_id: string
  release_version: number
  /** Last page rendered and reported by the device. */
  active_page_id: string
  /** Console-selected page to render next. */
  desired_page_id: string
  enabled_page_ids: string[]
  pages: ReleasePageMetadata[]
  available_pages: ReleasePageMetadata[]
}

type DeviceRelease = {
  device_id: string
  release_id: string
  release_version: number
  active_page_id: string
  desired_page_id: string | null
  enabled_page_ids: string[] | null
  pages: ReleasePageMetadata[]
}

const systemPageLast = (pageIds: string[]) => {
  return [...pageIds.filter((pageId) => pageId !== 'system'), ...pageIds.filter((pageId) => pageId === 'system')]
}

const getDeviceRelease = async (deviceId: string): Promise<DeviceRelease | undefined> => {
  if (!db) return undefined
  const [device] = await db
    .select({
      id: devices.id,
      release_id: devices.release_id,
      active_page_id: devices.active_page_id,
      desired_page_id: devices.desired_page_id,
      enabled_page_ids: devices.enabled_page_ids,
    })
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1)
  if (!device?.release_id) return undefined

  const [release] = await db
    .select({ id: displayReleases.id, version: displayReleases.version })
    .from(displayReleases)
    .where(eq(displayReleases.id, device.release_id))
    .limit(1)
  if (!release) return undefined

  const pages = await db
    .select({
      page_id: displayReleasePages.page_id,
      image_format: displayReleasePages.image_format,
      image_width: displayReleasePages.image_width,
      image_height: displayReleasePages.image_height,
      image_sha256: displayReleasePages.content_sha256,
      image_bytes: sql<number>`octet_length(${displayReleasePages.device_image})`,
    })
    .from(displayReleasePages)
    .where(eq(displayReleasePages.release_id, release.id))
    .orderBy(asc(displayReleasePages.position))
  if (!pages.length) return undefined
  return {
    device_id: device.id,
    release_id: release.id,
    release_version: release.version,
    active_page_id: device.active_page_id,
    desired_page_id: device.desired_page_id,
    enabled_page_ids: device.enabled_page_ids,
    pages,
  }
}

export const getDevicePageConfiguration = async (deviceId: string): Promise<DevicePageConfiguration | undefined> => {
  const deviceRelease = await getDeviceRelease(deviceId)
  if (!deviceRelease) return undefined
  const availableIds = new Set(deviceRelease.pages.map((page) => page.page_id))
  const enabledPageIds = systemPageLast(
    (deviceRelease.enabled_page_ids?.length ? deviceRelease.enabled_page_ids : deviceRelease.pages.map((page) => page.page_id)).filter(
      (pageId) => availableIds.has(pageId),
    ),
  )
  if (!enabledPageIds.length) return undefined
  const desiredPageId =
    deviceRelease.desired_page_id && enabledPageIds.includes(deviceRelease.desired_page_id)
      ? deviceRelease.desired_page_id
      : enabledPageIds[0]
  const pageById = new Map(deviceRelease.pages.map((page) => [page.page_id, page]))
  return {
    device_id: deviceId,
    release_id: deviceRelease.release_id,
    release_version: deviceRelease.release_version,
    active_page_id: deviceRelease.active_page_id,
    desired_page_id: desiredPageId,
    enabled_page_ids: enabledPageIds,
    pages: enabledPageIds.flatMap((pageId) => pageById.get(pageId) ?? []),
    available_pages: deviceRelease.pages,
  }
}

export const updateDevicePageConfiguration = async (deviceId: string, enabledPageIds: string[], desiredPageId: string) => {
  if (!db) throw new Error('database_unavailable')
  if (
    enabledPageIds.length === 0 ||
    enabledPageIds.length > 10 ||
    new Set(enabledPageIds).size !== enabledPageIds.length ||
    !enabledPageIds.includes(desiredPageId)
  ) {
    throw new Error('device_page_configuration_invalid')
  }
  const deviceRelease = await getDeviceRelease(deviceId)
  if (!deviceRelease) throw new Error('device_release_not_found')
  const pageById = new Map(deviceRelease.pages.map((page) => [page.page_id, page]))
  if (enabledPageIds.some((pageId) => !pageById.has(pageId))) throw new Error('device_page_not_in_release')

  const orderedPageIds = systemPageLast(enabledPageIds)
  const pages = orderedPageIds.map((pageId) => {
    const page = pageById.get(pageId)
    if (!page) throw new Error('device_page_not_in_release')
    return page
  })
  await db.update(devices).set({ enabled_page_ids: orderedPageIds, desired_page_id: desiredPageId }).where(eq(devices.id, deviceId))
  await publishDeviceRelease(deviceId, {
    id: deviceRelease.release_id,
    version: deviceRelease.release_version,
    active_page_id: desiredPageId,
    pages,
  })
  return {
    device_id: deviceId,
    release_id: deviceRelease.release_id,
    release_version: deviceRelease.release_version,
    active_page_id: deviceRelease.active_page_id,
    desired_page_id: desiredPageId,
    enabled_page_ids: orderedPageIds,
    pages,
    available_pages: deviceRelease.pages,
  } satisfies DevicePageConfiguration
}

export const validateDevicePageCommand = async (deviceId: string, action: string, payload: Record<string, unknown>) => {
  if (action !== 'show_page') return
  if (typeof payload.page_id !== 'string') throw new Error('page_id_required')
  const configuration = await getDevicePageConfiguration(deviceId)
  if (!configuration) throw new Error('device_release_not_found')
  if (!configuration.enabled_page_ids.includes(payload.page_id)) throw new Error('page_not_enabled')
}
