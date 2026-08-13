import { describe, expect, test } from 'bun:test'

import { DISPLAY_HEIGHT, DISPLAY_WIDTH, MONO1_IMAGE_BYTES, fallback_preview_svg, render_device_bitmap, render_display_preview } from './preview'

describe('fallback preview', () => {
  test('uses the physical display dimensions', () => {
    expect(fallback_preview_svg).toContain('width="400"')
    expect(fallback_preview_svg).toContain('height="300"')
  })

  test('renders escaped display document content at the physical size', () => {
    const svg = render_display_preview({ title: 'Usage <today>', subtitle: 'Subscription', lines: [{ label: 'Today', value: '72%' }] })
    expect(svg).toContain('width="400"')
    expect(svg).toContain('height="300"')
    expect(svg).toContain('Usage &lt;today&gt;')
    expect(svg).toContain('Today')
    expect(svg).toContain('72%')
  })

  test('rasterizes Chinese text into a fixed-size firmware bitmap', () => {
    const rendered = render_device_bitmap({ title: '今日用量', subtitle: '订阅窗口', lines: [{ label: '剩余时间', value: '2 小时' }] })
    expect(rendered.device_image).toHaveLength(MONO1_IMAGE_BYTES)
    expect(rendered.device_image.some((byte) => byte !== 0)).toBe(true)
    expect(rendered.preview_svg).toContain('今日用量')
    expect(DISPLAY_WIDTH * DISPLAY_HEIGHT / 8).toBe(MONO1_IMAGE_BYTES)
  })

  test('rasterizes Japanese text into a fixed-size firmware bitmap', () => {
    const rendered = render_device_bitmap({ title: '今日の使用量', subtitle: 'サブスクリプション', lines: [{ label: '残り時間', value: '2 時間' }] })
    expect(rendered.device_image).toHaveLength(MONO1_IMAGE_BYTES)
    expect(rendered.device_image.some((byte) => byte !== 0)).toBe(true)
    expect(rendered.preview_svg).toContain('今日の使用量')
  })

  test('renders semantic icons and a bounded token progress meter', () => {
    const rendered = render_device_bitmap({ title: 'Token balance', icon: 'usage', progress: { value: 72, max: 100, label: 'Used', unit: 'tokens' } })
    expect(rendered.preview_svg).toContain('width="344"')
    expect(rendered.preview_svg).toContain('72%')
    expect(rendered.preview_svg).toContain('m3 25 8-8 5 5 13-13')
    expect(rendered.device_image).toHaveLength(MONO1_IMAGE_BYTES)
  })

  test('clamps an over-limit progress value', () => {
    const rendered = render_display_preview({ title: 'Usage', progress: { value: 200, max: 100 } })
    expect(rendered).toContain('100%')
    expect(rendered).toContain('width="340"')
  })

  test('renders three bounded usage meters at the documented row positions', () => {
    const rendered = render_display_preview({
      title: 'Usage',
      progresses: [
        { label: 'Day', value: 79, max: 776, unit: 'USD' },
        { label: 'Week', value: 618, max: 2054, unit: 'USD' },
        { label: 'Month', value: 2068, max: 8216, unit: 'USD' },
      ],
    })
    expect(rendered).toContain('y="110"')
    expect(rendered).toContain('y="144"')
    expect(rendered).toContain('y="178"')
    expect(rendered).toContain('y="122"')
    expect(rendered).toContain('y="156"')
    expect(rendered).toContain('y="190"')
  })

  test('preserves the historical Usage details layout', () => {
    const rendered = render_display_preview({
      title: 'Usage',
      subtitle: 'Codex',
      icon: 'usage',
      progresses: [
        { label: 'Day', value: 75.2, max: 388, unit: 'USD' },
        { label: 'Week', value: 617.04, max: 1027, unit: 'USD' },
        { label: 'Month', value: 1688.61, max: 4108, unit: 'USD' },
      ],
      usage_details: [
        { remaining: '$312.80', resets_at: '8/13 00:05' },
        { remaining: '$409.96', resets_at: '8/13 02:07' },
        { remaining: '$2419.39', resets_at: '8/26 13:00' },
      ],
    })
    expect(rendered).toContain('x="66" y="44"')
    expect(rendered).toContain('resets 8/13 00:05')
    expect(rendered).toContain('$312.80 left')
    expect(rendered).toContain('translate(346 16)')
    expect(rendered).toContain('y="128"')
    expect(rendered).toContain('y="108" width="61" height="4"')
    expect(rendered).toContain('shape-rendering="crispEdges"')
  })
})
