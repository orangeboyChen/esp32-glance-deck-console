import { describe, expect, test } from 'bun:test'

import { apiPath, apiUrl } from './api-client'

describe('API client paths', () => {
  test('keeps the API prefix centralized and encodes dynamic segments', () => {
    expect(apiPath('v1', 'devices', 'device/id', 'preview')).toBe('/api/v1/devices/device%2Fid/preview')
  })

  test('serializes query parameters without string concatenation', () => {
    expect(apiUrl(['v1', 'devices'], { cursor: 'a&b', limit: 10, includeOffline: false })).toBe(
      '/api/v1/devices?cursor=a%26b&limit=10&includeOffline=false',
    )
  })
})
