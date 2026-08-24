import { describe, expect, test } from 'bun:test'

import {
  commandMessage,
  isDeviceState,
  isOtaState,
  MAX_DEVICE_MQTT_PAYLOAD_BYTES,
  otaMessage,
  releaseMessage,
  validateMqttUrl,
} from './mqtt'

describe('MQTT transport validation', () => {
  test('requires TLS outside an explicit trusted-internal exception', () => {
    expect(validateMqttUrl('mqtts://broker.example').protocol).toBe('mqtts:')
    expect(() => validateMqttUrl('mqtt://broker.example')).toThrow('mqtt_tls_required')
    expect(validateMqttUrl('mqtt://broker.example', true).protocol).toBe('mqtt:')
  })

  test('serializes command and OTA messages without changing payloads', () => {
    expect(JSON.parse(commandMessage({ id: 'command-1', action: 'show_page', payload: { page_id: 'usage' } }))).toEqual({
      command_id: 'command-1',
      action: 'show_page',
      payload: { page_id: 'usage' },
    })
    expect(
      JSON.parse(
        otaMessage({
          id: 'job-1',
          nonce: 'nonce',
          version: '1.2.3',
          manifest_url: 'https://releases.example/manifest.json',
          image_sha256: 'abc',
        }),
      ),
    ).toEqual({
      job_id: 'job-1',
      nonce: 'nonce',
      version: '1.2.3',
      manifest_url: 'https://releases.example/manifest.json',
      image_sha256: 'abc',
    })
  })

  test('builds only complete HTTPS release documents', () => {
    process.env.DEVICE_ASSET_SIGNING_KEY = 'unit-test-key'
    const release = {
      id: 'release-1',
      active_page_id: 'usage',
      pages: [
        {
          page_id: 'usage',
          image_format: 'mono1-msb',
          image_width: 400,
          image_height: 300,
          image_sha256: 'a'.repeat(64),
          image_bytes: 15000,
        },
      ],
    }
    const message = JSON.parse(releaseMessage(release, 'https://console.example'))
    expect(message.pages[0].image_url).toContain('/api/v1/releases/release-1/pages/usage/image')
    expect(() => releaseMessage({ ...release, pages: [] }, 'https://console.example')).toThrow('release_pages_invalid')
    expect(() => releaseMessage(release, 'http://console.example')).toThrow('device_asset_url_https_required')
  })

  test('rejects a release document beyond the device memory limit', () => {
    process.env.DEVICE_ASSET_SIGNING_KEY = 'unit-test-key'
    const oversizedBaseUrl = `https://${'a'.repeat(MAX_DEVICE_MQTT_PAYLOAD_BYTES)}.example`
    const release = {
      id: 'release-1',
      active_page_id: 'usage',
      pages: [
        {
          page_id: 'usage',
          image_format: 'mono1-msb',
          image_width: 400,
          image_height: 300,
          image_sha256: 'a'.repeat(64),
          image_bytes: 15000,
        },
      ],
    }
    expect(() => releaseMessage(release, oversizedBaseUrl)).toThrow('release_message_too_large')
  })

  test('accepts only complete device and OTA state messages', () => {
    expect(isDeviceState({ version: 1, page_id: 'usage', wifi_rssi: -60 })).toBe(true)
    expect(isDeviceState({ version: '1', page_id: 'usage', wifi_rssi: -60 })).toBe(false)
    expect(isDeviceState({ version: 1, page_id: 'usage', wifi_rssi: -60, command_status: 'queued' })).toBe(false)
    expect(isOtaState({ job_id: 'job-1', phase: 'healthy' })).toBe(true)
    expect(isOtaState({ job_id: 'job-1', phase: 'unknown' })).toBe(false)
    expect(isOtaState({ job_id: 3, phase: 'failed', error_message: 'bad' })).toBe(false)
    expect(isOtaState({ job_id: 'job-1', phase: 'failed', error_message: 3 })).toBe(false)
  })
})
