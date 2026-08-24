import { createHmac, timingSafeEqual } from 'node:crypto'

const assetTtlSeconds = 60 * 60

const assetKey = () => {
  const key = process.env.DEVICE_ASSET_SIGNING_KEY
  if (!key) {
    throw new Error('device_asset_signing_key_missing')
  }
  return key
}

const signature = (releaseId: string, pageId: string, expiresAt: number) => {
  return createHmac('sha256', assetKey()).update(`${releaseId}.${pageId}.${expiresAt}`).digest('base64url')
}

export const signedReleasePageImageUrl = (baseUrl: string, releaseId: string, pageId: string) => {
  const expiresAt = Math.floor(Date.now() / 1000) + assetTtlSeconds
  const url = new URL(`/api/v1/releases/${releaseId}/pages/${pageId}/image`, baseUrl)
  url.searchParams.set('expires_at', String(expiresAt))
  url.searchParams.set('signature', signature(releaseId, pageId, expiresAt))
  return url.toString()
}

/** @deprecated Use the page-specific URL for new releases. */
export const signedReleaseImageUrl = (baseUrl: string, releaseId: string) => {
  return signedReleasePageImageUrl(baseUrl, releaseId, 'legacy')
}

export const verifyReleasePageImageSignature = (
  releaseId: string,
  pageId: string,
  expiresAt: string | null,
  providedSignature: string | null,
) => {
  if (!expiresAt || !providedSignature || !/^\d+$/.test(expiresAt)) {
    return false
  }
  const expires = Number(expiresAt)
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    return false
  }
  const expected = Buffer.from(signature(releaseId, pageId, expires))
  const actual = Buffer.from(providedSignature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** @deprecated Verifies the legacy one-page asset endpoint. */
export const verifyReleaseImageSignature = (releaseId: string, expiresAt: string | null, providedSignature: string | null) => {
  return verifyReleasePageImageSignature(releaseId, 'legacy', expiresAt, providedSignature)
}
