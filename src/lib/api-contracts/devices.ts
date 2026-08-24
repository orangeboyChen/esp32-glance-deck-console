export type DashboardDevice = {
  id: string
  name: string
  board_model: string
  status: 'enrolling' | 'online' | 'offline' | 'error'
  firmware_version: string | null
  active_page_id: string
  wifi_rssi: number | null
  power_source: string | null
  charging: boolean | null
  battery_percent: number | null
  battery_mv: number | null
  power_updated_at: string | null
  last_seen_at: string | null
  preview_svg: string | null
  source_values: Record<string, string | number | null> | null
  ota_status: string | null
  ota_job_id: string | null
}
export type ListDevicesResponse = { devices: DashboardDevice[] }
export type EnrollmentRequest = { name: string; pairing_code: string; board_model: 'ESP32-S3-RLCD-4.2' }
export type EnrollmentResponse = { device_id: string }
export type PageConfiguration = {
  active_page_id: string
  desired_page_id: string
  enabled_page_ids: string[]
  available_pages: Array<{ page_id: string }>
}
export type PageConfigurationRequest = Pick<PageConfiguration, 'enabled_page_ids' | 'desired_page_id'>
export type OtaInstallRequest = { firmware_release_id?: string }
export type OtaJobRequest = { action: 'cancel' | 'rollback' }
export type RolloutRequest = { firmware_release_id: string; device_ids: string[]; percentage: number }
export type RolloutResponse = { jobs: Array<{ id: string }>; selected_count: number; eligible_count: number }
import type { JsonObject } from './common'

export type DeviceCommandRequest = {
  action: 'show_page' | 'next_page' | 'previous_page' | 'set_rotation' | 'refresh_release' | 'enter_maintenance'
  payload: JsonObject
}
export type DeviceCommand = {
  id: string
  device_id: string
  action: string
  payload: JsonObject
  status: string
  error_message: string | null
  created_at: string
  confirmed_at: string | null
}
export type DeviceCommandResponse = { command: DeviceCommand }
export type DeviceDetail = {
  id: string
  name: string
  status: string
  board_model: string
  firmware_version: string | null
  wifi_rssi: number | null
  active_page_id: string
  desired_page_id: string | null
  enabled_page_ids: string[] | null
  power_source: string | null
  charging: boolean | null
  battery_percent: number | null
  battery_mv: number | null
  power_updated_at: string | null
  last_seen_at: string | null
  release_id: string | null
  release_version: number | null
}
export type DeviceDetailResponse = { device: DeviceDetail; commands: DeviceCommand[] }
export type OtaJob = {
  id: string
  device_id: string
  firmware_release_id: string
  status: string
  nonce: string
  error_message: string | null
  created_at: string
  completed_at: string | null
}
export type OtaJobResponse = { job: OtaJob }
