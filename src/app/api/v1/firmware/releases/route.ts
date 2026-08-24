import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/server/database/db'
import { currentAdministrator } from '@/server/auth/session'
import { firmwareReleases } from '@/server/database/schema'
import { verifyFirmwareManifest } from '@/server/firmware/firmware-signature'
import { firmwareReleaseRequestSchema } from '@/lib/api-contracts'
import type { CreateFirmwareReleaseResponse, ListFirmwareReleasesResponse } from '@/lib/api-contracts'

export const GET = async () => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const response: ListFirmwareReleasesResponse = {
    releases: (await db.select().from(firmwareReleases).orderBy(desc(firmwareReleases.created_at))).map((release) => ({
      ...release,
      channel: release.channel as 'stable' | 'beta' | 'test',
      verified_at: release.verified_at.toISOString(),
    })),
  }
  return NextResponse.json(response)
}

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
  const body = firmwareReleaseRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_release', issues: body.error.issues }, { status: 400 })
  }
  try {
    if (!verifyFirmwareManifest(body.data)) {
      return NextResponse.json({ error: 'firmware_signature_invalid' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'firmware_signature_invalid' }, { status: 503 })
  }
  const [release] = await db.insert(firmwareReleases).values(body.data).returning()
  const response: CreateFirmwareReleaseResponse = {
    release: {
      ...release,
      channel: release.channel as 'stable' | 'beta' | 'test',
      verified_at: release.verified_at.toISOString(),
      created_at: release.created_at.toISOString(),
    },
  }
  return NextResponse.json(response, { status: 201 })
}
