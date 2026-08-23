const attention_ota_statuses = new Set([
  'awaiting_confirmation',
  'queued',
  'sent',
  'downloading',
  'verifying',
  'rebooting',
  'failed',
  'rolled_back',
])

type AttentionDevice = {
  active_page_id: string
  ota_status: string | null
  status: string
}

export function device_needs_attention(device: AttentionDevice) {
  return device.status !== 'online'
    || device.active_page_id === 'alerts'
    || (device.ota_status !== null && attention_ota_statuses.has(device.ota_status))
}
