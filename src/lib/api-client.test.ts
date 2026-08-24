import { describe, expect, test } from 'bun:test'

import { ApiClient, apiPath, apiUrl } from './api-client'

describe('API client paths', () => {
  test('keeps the API prefix centralized and encodes dynamic segments', () => {
    expect(apiPath('v1', 'devices', 'device/id', 'preview')).toBe('/api/v1/devices/device%2Fid/preview')
  })

  test('serializes query parameters without string concatenation', () => {
    expect(apiUrl(['v1', 'devices'], { cursor: 'a&b', limit: 10, includeOffline: false })).toBe(
      '/api/v1/devices?cursor=a%26b&limit=10&includeOffline=false',
    )
  })

  test('exposes typed resource methods through one fetch transport', async () => {
    const client = new ApiClient()
    const payload = {} as never
    const originalFetch = globalThis.fetch
    const requests: string[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith('/auth/logout')) {
        return new Response(null, { status: 204 })
      }
      if (url.includes('/preview')) {
        return new Response('preview', { headers: { 'content-type': 'text/plain' } })
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } })
    }

    try {
      await client.login(payload)
      await client.setup(payload)
      await client.logout()
      await client.loginPasskeyOptions()
      await client.loginPasskeyVerify(payload)
      await client.registerPasskeyOptions()
      await client.registerPasskeyVerify(payload)
      await client.listPasskeys()
      await client.deletePasskey('pass/key')
      await client.setLocale('zh-CN')
      await client.listAlerts()
      await client.createAlert(payload)
      await client.deleteAlert('alert/id')
      await client.listDevices()
      await client.enrollDevice(payload)
      await client.getDevicePages('device/id')
      await client.updateDevicePages('device/id', payload)
      await client.previewDevice('device/id')
      await client.listFirmwareReleases()
      await client.createRollout(payload)
      await client.updateOtaJob('job/id', payload)
      await client.installOta('device/id', payload)
      await client.listReleases()
      await client.previewRelease(payload)
      await client.publishRelease(payload)
      await client.listSources()
      await client.connectSoruxgpt(payload)
      await client.previewCcSwitchImport(payload)
      await client.createSource(payload)
      await client.testSource('source/id')
      await client.listTokens()
      await client.createToken(payload)
      await client.deleteToken('token/id')
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(requests).toContain('/api/auth/passkeys/pass%2Fkey')
    expect(requests).toContain('/api/v1/devices/device%2Fid/preview')
  })

  test('normalizes JSON API errors', async () => {
    const client = new ApiClient()
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'not_allowed' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })

    try {
      await expect(client.listAlerts()).rejects.toMatchObject({ message: 'not_allowed', status: 403 })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
