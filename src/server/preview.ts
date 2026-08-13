import { join } from 'node:path'

import { Resvg } from '@resvg/resvg-js'

export const fallback_preview_svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f2f4ed"/>
  <text x="28" y="52" font-family="Noto Sans CJK" font-size="26" fill="#26322a">WAITING</text>
  <text x="28" y="74" font-family="Noto Sans CJK" font-size="12" fill="#627168">Pair a device, then publish its first release.</text>
  <text x="28" y="145" font-family="Noto Sans CJK" font-size="42" fill="#26322a">—</text>
  <text x="28" y="282" font-family="Noto Sans CJK" font-size="10" font-weight="700" fill="#627168">400 × 300</text>
</svg>`.trim()

export type Display_icon = 'usage' | 'battery' | 'wifi' | 'system' | 'home'
export type Display_progress = { value: number | string; max: number | string; label?: string; unit?: string }

export type Display_document = {
  title: string
  subtitle?: string
  icon?: Display_icon
  /** Legacy single-meter document field. New documents use `progresses`. */
  progress?: Display_progress
  progresses?: Display_progress[]
  lines?: Array<{ label: string; value: string }>
}

export type Rendered_display = {
  device_image: Buffer
  preview_svg: string
}

function escape_xml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character)
}

export function render_display_preview(document: Display_document) {
  const title = escape_xml(document.title)
  const subtitle = document.subtitle ? escape_xml(document.subtitle) : ''
  const icon = document.icon ? render_icon(document.icon, 28, 22) : ''
  const title_left = document.icon ? 70 : 28
  const progresses = normalized_progresses(document)
  const progress = progresses.map(render_progress).join('')
  const line_start = progresses.length === 3 ? 228 : progresses.length === 2 ? 215 : progresses.length ? 191 : 110
  const lines = (document.lines ?? []).slice(0, progresses.length ? 4 : 7).map((line, index) => {
    const y = line_start + index * 24
    return `<text x="28" y="${y}" font-family="Noto Sans CJK" font-size="13" fill="#627168">${escape_xml(line.label)}</text><text x="372" y="${y}" text-anchor="end" font-family="Noto Sans CJK" font-size="16" font-weight="700" fill="#26322a">${escape_xml(line.value)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f2f4ed"/>${icon}<text x="${title_left}" y="52" font-family="Noto Sans CJK" font-size="26" fill="#26322a">${title}</text><text x="28" y="74" font-family="Noto Sans CJK" font-size="12" fill="#627168">${subtitle}</text>${progress}${lines}<line x1="28" x2="372" y1="266" y2="266" stroke="#9ba89f"/><text x="28" y="282" font-family="Noto Sans CJK" font-size="10" fill="#627168">IMMUTABLE DISPLAY RELEASE</text></svg>`
}

function render_icon(icon: Display_icon, x: number, y: number) {
  const stroke = 'stroke="#26322a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"'
  if (icon === 'wifi') return `<g transform="translate(${x} ${y})" ${stroke}><path d="M2 12 Q20 -3 38 12"/><path d="M9 20 Q20 10 31 20"/><circle cx="20" cy="28" r="2" fill="#26322a"/></g>`
  if (icon === 'battery') return `<g transform="translate(${x} ${y})" ${stroke}><rect x="2" y="8" width="30" height="18" rx="2"/><path d="M35 14v6"/><path d="M7 13h12v8H7z" fill="#26322a"/></g>`
  if (icon === 'system') return `<g transform="translate(${x} ${y})" ${stroke}><rect x="4" y="4" width="32" height="24" rx="2"/><path d="M12 35h16M20 28v7"/></g>`
  if (icon === 'home') return `<g transform="translate(${x} ${y})" ${stroke}><path d="m4 19 16-14 16 14v16H4z"/><path d="M16 35V23h8v12"/></g>`
  return `<g transform="translate(${x} ${y})" ${stroke}><path d="m3 25 8-8 5 5 13-13"/><path d="M19 6h10v10"/></g>`
}

function normalized_progresses(document: Display_document) {
  return (document.progresses?.length ? document.progresses : document.progress ? [document.progress] : []).slice(0, 3)
}

function render_progress(progress: Display_progress, index: number) {
  const raw_max = Number(progress.max)
  const raw_value = Number(progress.value)
  const max = Number.isFinite(raw_max) && raw_max > 0 ? raw_max : 0
  const value = max > 0 && Number.isFinite(raw_value) ? Math.max(0, Math.min(raw_value, max)) : 0
  const percent = max > 0 ? Math.round(value / max * 100) : 0
  const width = Math.round(344 * percent / 100)
  const label = progress.label ? `${escape_xml(progress.label)} ` : ''
  const unit = progress.unit ? ` ${escape_xml(progress.unit)}` : ''
  const label_y = [110, 144, 178][index] ?? 110
  const bar_y = [122, 156, 190][index] ?? 122
  return `<text x="28" y="${label_y}" font-family="Noto Sans CJK" font-size="13" fill="#627168">${label}${percent}%</text><text x="372" y="${label_y}" text-anchor="end" font-family="Noto Sans CJK" font-size="13" font-weight="700" fill="#26322a">${value} / ${max}${unit}</text><rect x="28" y="${bar_y}" width="344" height="8" rx="4" fill="none" stroke="#26322a" stroke-width="2"/><rect x="30" y="${bar_y + 2}" width="${Math.max(0, width - 4)}" height="4" rx="2" fill="#26322a"/>`
}

/**
 * Rasterizes text with bundled CJK font subsets before publishing it to
 * a device. Firmware receives pixels, not an SVG or a font name, so its CJK
 * support is independent of the ESP32 font catalog.
 */
export function render_device_bitmap(document: Display_document): Rendered_display {
  const preview_svg = render_display_preview(document)
  const pixels = new Resvg(preview_svg, {
    background: '#f2f4ed',
    font: {
      fontFiles: bundled_cjk_font_files,
      loadSystemFonts: false,
      sansSerifFamily: 'Noto Sans CJK',
    },
    shapeRendering: 2,
    textRendering: 2,
  }).render().pixels
  const device_image = Buffer.alloc(MONO1_IMAGE_BYTES)

  for (let pixel = 0; pixel < DISPLAY_WIDTH * DISPLAY_HEIGHT; pixel += 1) {
    const offset = pixel * 4
    const luminance = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000
    const opaque = pixels[offset + 3] > 127
    if (opaque && luminance < 160) device_image[pixel >> 3] |= 0x80 >> (pixel & 7)
  }
  return { preview_svg, device_image }
}
export const DISPLAY_WIDTH = 400
export const DISPLAY_HEIGHT = 300
export const MONO1_IMAGE_BYTES = DISPLAY_WIDTH * DISPLAY_HEIGHT / 8
export const MONO1_IMAGE_FORMAT = 'mono1-msb'

const bundled_cjk_font_files = [join(process.cwd(), 'assets', 'fonts', 'NotoSansSC-Regular.ttf')]
