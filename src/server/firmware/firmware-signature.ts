import { createPublicKey, verify } from 'node:crypto'

export const firmwareManifestPayload = (input: { version: string; board_model: string; image_url: string; image_sha256: string }) => {
  return JSON.stringify({
    board_model: input.board_model,
    image_sha256: input.image_sha256.toLowerCase(),
    image_url: input.image_url,
    version: input.version,
  })
}

export const verifyFirmwareManifest = (input: {
  version: string
  board_model: string
  image_url: string
  image_sha256: string
  manifest_signature: string
}) => {
  const publicKey = process.env.FIRMWARE_MANIFEST_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('firmware_signing_key_missing')
  }
  try {
    return verify(
      null,
      Buffer.from(firmwareManifestPayload(input)),
      createPublicKey(publicKey),
      Buffer.from(input.manifest_signature, 'hex'),
    )
  } catch {
    return false
  }
}
