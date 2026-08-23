import { describe, expect, test } from 'bun:test'

import { device_needs_attention } from './device-attention'

const online_device = { active_page_id: 'usage', ota_status: null, status: 'online' }

describe('device_needs_attention', () => {
  test('ignores benign terminal OTA states', () => {
    expect(device_needs_attention({ ...online_device, ota_status: 'healthy' })).toBe(false)
    expect(device_needs_attention({ ...online_device, ota_status: 'cancelled' })).toBe(false)
  })

  test('includes active and failed OTA states', () => {
    for (const ota_status of ['awaiting_confirmation', 'queued', 'sent', 'downloading', 'verifying', 'rebooting', 'failed', 'rolled_back']) {
      expect(device_needs_attention({ ...online_device, ota_status })).toBe(true)
    }
  })

  test('includes device and display alert states', () => {
    expect(device_needs_attention({ ...online_device, status: 'offline' })).toBe(true)
    expect(device_needs_attention({ ...online_device, active_page_id: 'alerts' })).toBe(true)
  })
})
