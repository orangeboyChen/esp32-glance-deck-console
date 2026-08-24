export type FirmwareRelease = {
  id: string
  version: string
  board_model: string
  channel: 'stable' | 'beta' | 'test'
  verified_at: string
  manifest_url: string
}
export type ListFirmwareReleasesResponse = { releases: FirmwareRelease[] }
export type FirmwareReleaseRequest = {
  version: string
  board_model: 'ESP32-S3-RLCD-4.2'
  channel: 'stable' | 'beta' | 'test'
  manifest_url: string
  image_url: string
  image_sha256: string
  manifest_signature: string
}
export type CreateFirmwareReleaseResponse = {
  release: FirmwareRelease & {
    image_url: string
    image_sha256: string
    manifest_signature: string
    created_at: string
  }
}
