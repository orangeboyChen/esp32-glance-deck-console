import { atom } from 'jotai'

export type FirmwareRelease = {
  id: string
  version: string
  board_model: string
  channel: 'stable' | 'beta' | 'test'
  verified_at: string
  manifest_url: string
}
export type Device = {
  id: string
  name: string
  board_model: string
  firmware_version: string | null
  status: string
  ota_status: string | null
  ota_job_id: string | null
  power_source: string | null
  battery_percent: number | null
}

export const firmwareReleasesAtom = atom<FirmwareRelease[]>([])
export const firmwareDevicesAtom = atom<Device[]>([])
export const firmwareLoadingAtom = atom(true)
export const firmwareErrorAtom = atom<string | null>(null)
export const firmwareSelectionAtom = atom<{ release: FirmwareRelease; device: Device } | null>(null)
export const firmwareInstallingAtom = atom(false)
export const rolloutReleaseIdAtom = atom('')
export const rolloutPercentageAtom = atom('100')
export const rolloutDeviceIdsAtom = atom<string[]>([])
export const rolloutBusyAtom = atom(false)
