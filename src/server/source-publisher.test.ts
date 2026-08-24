import { describe, expect, test } from 'bun:test'

import { renderBoundDocument, templateValue } from './source-publisher'

describe('bound source document rendering', () => {
  test('interpolates only persisted source values and marks unavailable values', () => {
    expect(
      renderBoundDocument(
        {
          title: '{{plan_name}} usage',
          subtitle: 'Resets {{resets_at}}',
          lines: [
            { label: 'Today', value: '{{used}} / {{total}} {{unit}}' },
            { label: 'Remaining', value: '{{remaining}}' },
          ],
        },
        {
          plan_name: 'Pro',
          used: 72,
          total: 100,
          unit: '%',
          remaining: null,
          resets_at: 'tomorrow',
        },
      ),
    ).toEqual({
      title: 'Pro usage',
      subtitle: 'Resets tomorrow',
      icon: 'usage',
      progress: { value: 72, max: 100, label: 'Used', unit: '%' },
      lines: [
        { label: 'Today', value: '72 / 100 %' },
        { label: 'Remaining', value: '—' },
      ],
    })
  })

  test('preserves unsupported interpolation syntax and substitutes a missing value', () => {
    expect(templateValue('{{unknown}} / {{UPPER}} / {{used}}', { used: 8 })).toBe('— / {{UPPER}} / 8')
  })

  test('interpolates all bounded usage meters without retaining legacy progress', () => {
    expect(
      renderBoundDocument(
        {
          title: 'Usage',
          progresses: [
            { label: 'Day', value: '{{day_used}}', max: '{{day_total}}', unit: 'USD' },
            { label: 'Week', value: '{{week_used}}', max: '{{week_total}}', unit: 'USD' },
            { label: 'Month', value: '{{month_used}}', max: '{{month_total}}', unit: 'USD' },
          ],
        },
        {
          day_used: 79,
          day_total: 776,
          week_used: 618,
          week_total: 2054,
          month_used: 2068,
          month_total: 8216,
        },
      ),
    ).toMatchObject({
      title: 'Usage',
      progresses: [
        { label: 'Day', value: 79, max: 776, unit: 'USD' },
        { label: 'Week', value: 618, max: 2054, unit: 'USD' },
        { label: 'Month', value: 2068, max: 8216, unit: 'USD' },
      ],
    })
  })
})
