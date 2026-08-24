const attentionOtaStatuses = new Set([
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

export const deviceNeedsAttention = (device: AttentionDevice) => {
  return (
    device.status !== 'online' ||
    device.active_page_id === 'alerts' ||
    (device.ota_status !== null && attentionOtaStatuses.has(device.ota_status))
  )
}
