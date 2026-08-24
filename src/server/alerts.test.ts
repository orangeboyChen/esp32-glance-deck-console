import { describe, expect, test } from 'bun:test'

import { matchesAlert } from './alerts'

describe('alert threshold evaluation', () => {
  test('compares numeric values with inclusive boundaries', () => {
    expect(matchesAlert(80, 'gte', '80')).toBe(true)
    expect(matchesAlert(79, 'gte', '80')).toBe(false)
    expect(matchesAlert('12.5', 'lt', '13')).toBe(true)
    expect(matchesAlert('not-a-number', 'gt', '1')).toBe(false)
  })

  test('compares text and supports contains', () => {
    expect(matchesAlert('Critical quota', 'contains', 'quota')).toBe(true)
    expect(matchesAlert('ready', 'eq', 'ready')).toBe(true)
    expect(matchesAlert('ready', 'neq', 'ready')).toBe(false)
    expect(matchesAlert(null, 'eq', '')).toBe(true)
  })
})
