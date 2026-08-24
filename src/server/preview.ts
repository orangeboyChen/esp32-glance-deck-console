import { join } from 'node:path'

import { Resvg } from '@resvg/resvg-js'

export const fallbackPreviewSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f2f4ed"/>
  <text x="28" y="52" font-family="Noto Sans CJK" font-size="26" fill="#26322a">WAITING</text>
  <text x="28" y="74" font-family="Noto Sans CJK" font-size="12" fill="#627168">Pair a device, then publish its first release.</text>
  <text x="28" y="145" font-family="Noto Sans CJK" font-size="42" fill="#26322a">—</text>
  <text x="28" y="282" font-family="Noto Sans CJK" font-size="10" font-weight="700" fill="#627168">400 × 300</text>
</svg>`.trim()

export type DisplayIcon = 'usage' | 'battery' | 'wifi' | 'system' | 'home'
export type DisplayProgress = { value: number | string; max: number | string; label?: string; unit?: string }
export type UsageDetail = { remaining?: string; resets_at?: string }

export type DisplayDocument = {
  title: string
  subtitle?: string
  icon?: DisplayIcon
  /** Legacy single-meter document field. New documents use `progresses`. */
  progress?: DisplayProgress
  progresses?: DisplayProgress[]
  usage_details?: UsageDetail[]
  lines?: Array<{ label: string; value: string }>
}

export type RenderedDisplay = {
  device_image: Buffer
  preview_svg: string
}

const escapeXml = (value: string) => {
  return value.replace(
    /[<>&"']/g,
    (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character,
  )
}

export const renderDisplayPreview = (document: DisplayDocument) => {
  const title = escapeXml(document.title)
  const subtitle = document.subtitle ? escapeXml(document.subtitle) : ''
  const progresses = normalizedProgresses(document)
  const isUsageLayout = document.icon === 'usage' && progresses.length === 3
  const icon = document.icon ? renderIcon(document.icon, 28, isUsageLayout ? 18 : 22) : ''
  const titleLeft = document.icon ? (isUsageLayout ? 66 : 70) : 28
  const titleY = isUsageLayout ? 44 : 52
  const subtitleY = isUsageLayout ? 66 : 74
  const progress = progresses
    .map((meter, index) => renderProgress(meter, index, isUsageLayout ? document.usage_details?.[index] : undefined))
    .join('')
  const lineStart = isUsageLayout ? 228 : progresses.length === 3 ? 228 : progresses.length === 2 ? 215 : progresses.length ? 191 : 110
  const lines = (document.lines ?? [])
    .slice(0, progresses.length ? 4 : 7)
    .map((line, index) => {
      const y = lineStart + index * 24
      return `<text x="28" y="${y}" font-family="Noto Sans CJK" font-size="13" fill="#627168">${escapeXml(line.label)}</text><text x="372" y="${y}" text-anchor="end" font-family="Noto Sans CJK" font-size="16" font-weight="700" fill="#26322a">${escapeXml(line.value)}</text>`
    })
    .join('')
  const providerMark = isUsageLayout ? renderOpenaiMark(346, 16) : ''
  const footerStroke = isUsageLayout ? '#26322a' : '#9ba89f'
  const footerText = isUsageLayout ? '#26322a' : '#627168'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f2f4ed"/>${icon}${providerMark}<text x="${titleLeft}" y="${titleY}" font-family="Noto Sans CJK" font-size="26" fill="#26322a">${title}</text><text x="28" y="${subtitleY}" font-family="Noto Sans CJK" font-size="12" fill="#627168">${subtitle}</text>${progress}${lines}<line x1="28" x2="372" y1="266" y2="266" stroke="${footerStroke}"/><text x="28" y="282" font-family="Noto Sans CJK" font-size="10" fill="${footerText}">IMMUTABLE DISPLAY RELEASE</text></svg>`
}

const renderIcon = (icon: DisplayIcon, x: number, y: number) => {
  const stroke = 'stroke="#26322a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"'
  if (icon === 'wifi')
    return `<g transform="translate(${x} ${y})" ${stroke}><path d="M2 12 Q20 -3 38 12"/><path d="M9 20 Q20 10 31 20"/><circle cx="20" cy="28" r="2" fill="#26322a"/></g>`
  if (icon === 'battery')
    return `<g transform="translate(${x} ${y})" ${stroke}><rect x="2" y="8" width="30" height="18" rx="2"/><path d="M35 14v6"/><path d="M7 13h12v8H7z" fill="#26322a"/></g>`
  if (icon === 'system')
    return `<g transform="translate(${x} ${y})" ${stroke}><rect x="4" y="4" width="32" height="24" rx="2"/><path d="M12 35h16M20 28v7"/></g>`
  if (icon === 'home')
    return `<g transform="translate(${x} ${y})" ${stroke}><path d="m4 19 16-14 16 14v16H4z"/><path d="M16 35V23h8v12"/></g>`
  return `<g transform="translate(${x} ${y})" ${stroke}><path d="m3 25 8-8 5 5 13-13"/><path d="M19 6h10v10"/></g>`
}

const normalizedProgresses = (document: DisplayDocument) => {
  return (document.progresses?.length ? document.progresses : document.progress ? [document.progress] : []).slice(0, 3)
}

const renderProgress = (progress: DisplayProgress, index: number, detail?: UsageDetail) => {
  const rawMax = Number(progress.max)
  const rawValue = Number(progress.value)
  const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0
  const value = max > 0 && Number.isFinite(rawValue) ? Math.max(0, Math.min(rawValue, max)) : 0
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  const width = Math.round((344 * percent) / 100)
  const label = progress.label ? `${escapeXml(progress.label)} ` : ''
  const unit = progress.unit ? ` ${escapeXml(progress.unit)}` : ''
  const historicalUsage = detail !== undefined
  const labelY = historicalUsage ? ([96, 150, 204][index] ?? 96) : ([110, 144, 178][index] ?? 110)
  const barY = historicalUsage ? ([102, 156, 210][index] ?? 102) : ([122, 156, 190][index] ?? 122)
  const detailY = barY + 22
  const remaining = detail?.remaining
    ? `<text x="28" y="${detailY}" font-family="Noto Sans CJK" font-size="11" fill="#627168">${escapeXml(detail.remaining)} left</text>`
    : ''
  const resetsAt = detail?.resets_at
    ? `<text x="372" y="${detailY}" text-anchor="end" font-family="Noto Sans CJK" font-size="11" fill="#627168">resets ${escapeXml(detail.resets_at)}</text>`
    : ''
  const amount = historicalUsage && unit.trim() === 'USD' ? `$${value} / $${max} USD` : `${value} / ${max}${unit}`
  return `<text x="28" y="${labelY}" font-family="Noto Sans CJK" font-size="13" fill="#627168">${label}${percent}%</text><text x="372" y="${labelY}" text-anchor="end" font-family="Noto Sans CJK" font-size="13" font-weight="700" fill="#26322a">${amount}</text><rect x="28" y="${barY}" width="344" height="8" rx="4" fill="none" stroke="#26322a" stroke-width="2" shape-rendering="crispEdges"/><rect x="30" y="${barY + 2}" width="${Math.max(0, width - 4)}" height="4" rx="2" fill="#26322a" shape-rendering="crispEdges"/>${remaining}${resetsAt}`
}

const renderOpenaiMark = (x: number, y: number) => {
  const path =
    'M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z'
  return `<path transform="translate(${x} ${y}) scale(1.05)" fill="#26322a" d="${path}"/>`
}

/**
 * Rasterizes text with bundled CJK font subsets before publishing it to
 * a device. Firmware receives pixels, not an SVG or a font name, so its CJK
 * support is independent of the ESP32 font catalog.
 */
export const renderDeviceBitmap = (document: DisplayDocument): RenderedDisplay => {
  const previewSvg = renderDisplayPreview(document)
  const pixels = new Resvg(previewSvg, {
    background: '#f2f4ed',
    font: {
      fontFiles: bundledCjkFontFiles,
      loadSystemFonts: false,
      sansSerifFamily: 'Noto Sans CJK',
    },
    shapeRendering: 2,
    textRendering: 2,
  }).render().pixels
  const deviceImage = Buffer.alloc(MONO1_IMAGE_BYTES)

  for (let pixel = 0; pixel < DISPLAY_WIDTH * DISPLAY_HEIGHT; pixel += 1) {
    const offset = pixel * 4
    const luminance = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000
    const opaque = pixels[offset + 3] > 127
    if (opaque && luminance < 160) deviceImage[pixel >> 3] |= 0x80 >> (pixel & 7)
  }
  return { preview_svg: previewSvg, device_image: deviceImage }
}
export const DISPLAY_WIDTH = 400
export const DISPLAY_HEIGHT = 300
export const MONO1_IMAGE_BYTES = (DISPLAY_WIDTH * DISPLAY_HEIGHT) / 8
export const MONO1_IMAGE_FORMAT = 'mono1-msb'

const bundledCjkFontFiles = [join(process.cwd(), 'assets', 'fonts', 'NotoSansSC-Regular.ttf')]
