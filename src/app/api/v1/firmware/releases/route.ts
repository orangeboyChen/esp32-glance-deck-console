import { desc } from 'drizzle-orm'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { firmwareReleases } from '@/server/database/schema'
import { verifyFirmwareManifest } from '@/server/firmware/firmware-signature'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import { firmwareReleaseRequestSchema } from '@/lib/api-contracts'
import type { CreateFirmwareReleaseResponse, FirmwareReleaseRequest, ListFirmwareReleasesResponse } from '@/lib/api-contracts'

export const GET = apiRoute(async () => {
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const response: ListFirmwareReleasesResponse = {
    releases: (await db.select().from(firmwareReleases).orderBy(desc(firmwareReleases.created_at))).map((release) => ({
      ...release,
      channel: release.channel as 'stable' | 'beta' | 'test',
      verified_at: release.verified_at.toISOString(),
    })),
  }
  return { data: response }
})

export const POST = async (request: Request) => {
  return requestJson<FirmwareReleaseRequest, CreateFirmwareReleaseResponse>(firmwareReleaseRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    try {
      if (!verifyFirmwareManifest(payload)) {
        throw new ApiRouteError('firmware_signature_invalid', 400)
      }
    } catch (error) {
      if (error instanceof ApiRouteError) {
        throw error
      }
      throw new ApiRouteError(error instanceof Error ? error.message : 'firmware_signature_invalid', 503)
    }
    const [release] = await db.insert(firmwareReleases).values(payload).returning()
    const response: CreateFirmwareReleaseResponse = {
      release: {
        ...release,
        channel: release.channel as 'stable' | 'beta' | 'test',
        verified_at: release.verified_at.toISOString(),
        created_at: release.created_at.toISOString(),
      },
    }
    return { data: response, init: { status: 201 } }
  })(request)
}
