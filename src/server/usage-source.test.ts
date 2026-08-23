import { describe, expect, test } from 'bun:test'

import { normalize_soruxgpt_codex } from './soruxgpt'

describe('SoruxGPT Codex usage normalization', () => {
  test('aggregates active quota windows and converts USD micro-units', () => {
    expect(normalize_soruxgpt_codex({
      display_name: 'Codex',
      usage_limits: [
        { current_usage: 100_000_000, limit_value: 388_000_000, limit_type: 'usd', time_unit: 'day', time_value: 1, expires_at: '2026-08-30T00:00:00Z' },
        { current_usage: 837_000_000, limit_value: 1_027_000_000, limit_type: 'usd', time_unit: 'week', time_value: 1, next_available_at: '2026-08-16T00:00:00Z' },
      ],
    }, new Date('2026-08-15T00:00:00Z'))).toEqual({
      plan_name: 'SoruxGPT Codex', used: 937, remaining: 478, total: 1415, unit: 'USD', resets_at: '2026-08-16T00:00:00Z', status: '2 active quota windows',
    })
  })

  test('rejects responses without usable quota windows', () => {
    expect(() => normalize_soruxgpt_codex({ usage_limits: [] })).toThrow('soruxgpt_usage_limits_missing')
  })

  test('ignores an expired window even when it has the higher consumption ratio', () => {
    expect(normalize_soruxgpt_codex({
      usage_limits: [
        { current_usage: 99, limit_value: 100, expires_at: '2026-08-14T00:00:00Z' },
        { current_usage: 50, limit_value: 100, expires_at: '2026-08-16T00:00:00Z' },
      ],
    }, new Date('2026-08-15T00:00:00Z'))).toMatchObject({ used: 50, total: 100 })
  })

  test('rejects active limits with incompatible units', () => {
    expect(() => normalize_soruxgpt_codex({ usage_limits: [
      { current_usage: 1_000_000, limit_value: 2_000_000, limit_type: 'usd' },
      { current_usage: 10, limit_value: 100, limit_type: 'requests' },
    ] }, new Date('2026-08-15T00:00:00Z'))).toThrow('soruxgpt_usage_limits_mixed_units')
  })

  test('rejects expired limits with malformed expiration timestamps', () => {
    expect(() => normalize_soruxgpt_codex({ usage_limits: [
      { current_usage: 1, limit_value: 2, expires_at: 'not-a-date' },
    ] }, new Date('2026-08-15T00:00:00Z'))).toThrow('soruxgpt_usage_limits_missing')
  })

  test('omits malformed reset timestamps', () => {
    expect(normalize_soruxgpt_codex({ usage_limits: [
      { current_usage: 1, limit_value: 2, next_available_at: 'not-a-date' },
    ] }, new Date('2026-08-15T00:00:00Z')).resets_at).toBeNull()
  })
})
