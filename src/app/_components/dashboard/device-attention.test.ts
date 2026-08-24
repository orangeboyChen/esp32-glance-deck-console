import { describe, expect, test } from 'bun:test'

import { deviceNeedsAttention } from './device-attention'

const onlineDevice = { active_page_id: 'usage', ota_status: null, status: 'online' }

describe('device_needs_attention', () => {
  test('ignores benign terminal OTA states', () => {
    expect(deviceNeedsAttention({ ...onlineDevice, ota_status: 'healthy' })).toBe(false)
    expect(deviceNeedsAttention({ ...onlineDevice, ota_status: 'cancelled' })).toBe(false)
  })

  test('includes active and failed OTA states', () => {
    for (const otaStatus of ['awaiting_confirmation', 'queued', 'sent', 'downloading', 'verifying', 'rebooting', 'failed', 'rolled_back']) {
      expect(deviceNeedsAttention({ ...onlineDevice, ota_status: otaStatus })).toBe(true)
    }
  })

  test('includes device and display alert states', () => {
    expect(deviceNeedsAttention({ ...onlineDevice, status: 'offline' })).toBe(true)
    expect(deviceNeedsAttention({ ...onlineDevice, active_page_id: 'alerts' })).toBe(true)
  })
})
