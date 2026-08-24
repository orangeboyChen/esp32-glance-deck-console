import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderDeviceBitmap, type DisplayDocument } from '../src/server/display/preview'

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const imageDirectory = resolve(scriptDirectory, '../../docs/image')
const background = 242
const foreground = 38

const pages: Record<string, DisplayDocument> = {
  usage: {
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
  },
  home: {
    title: 'Home',
    subtitle: 'Good morning',
    icon: 'home',
    lines: [
      { label: 'Calendar', value: '2 events' },
      { label: 'Temperature', value: '24 C' },
      { label: 'Humidity', value: '48%' },
    ],
  },
  system: {
    title: 'System',
    subtitle: 'Last verified page retained',
    icon: 'system',
    lines: [
      { label: 'Wi-Fi', value: 'Reconnect' },
      { label: 'Last update', value: '09:30' },
      { label: 'Power', value: 'Battery N/A' },
      { label: 'Firmware', value: '0.1.0' },
    ],
  },
}

const overlayPageIndicator = (frame: Buffer, activeIndex: number, pageCount: number) => {
  const overlay = Buffer.from(frame)
  const spacing = 14
  const centerX = DISPLAY_WIDTH / 2
  const centerY = DISPLAY_HEIGHT - 22
  const groupWidth = (pageCount - 1) * spacing
  for (let index = 0; index < pageCount; index += 1) {
    const circleX = centerX - groupWidth / 2 + index * spacing
    for (let y = circleYStart(centerY); y <= centerY + 4; y += 1) {
      for (let x = circleX - 4; x <= circleX + 4; x += 1) {
        const distance = (x - circleX) ** 2 + (y - centerY) ** 2
        const offset = y * DISPLAY_WIDTH + x
        if (distance <= 16) {
          overlay[offset >> 3] &= ~(0x80 >> (offset & 7))
        }
        if (distance <= 16 && (index === activeIndex || distance >= 9)) {
          overlay[offset >> 3] |= 0x80 >> (offset & 7)
        }
      }
    }
  }
  return overlay
}

const circleYStart = (centerY: number) => {
  return centerY - 4
}

const writePng = async (name: string, frame: Buffer) => {
  const pixels = Buffer.alloc(DISPLAY_WIDTH * DISPLAY_HEIGHT)
  for (let pixel = 0; pixel < pixels.length; pixel += 1) {
    pixels[pixel] = frame[pixel >> 3] & (0x80 >> (pixel & 7)) ? foreground : background
  }
  await writeFile(
    resolve(imageDirectory, `${name}.png`),
    await sharp(pixels, { raw: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, channels: 1 } })
      .png()
      .toBuffer(),
  )
}

await mkdir(imageDirectory, { recursive: true })
for (const [name, document] of Object.entries(pages)) {
  await writePng(name, renderDeviceBitmap(document).device_image)
}
const usage = renderDeviceBitmap(pages.usage).device_image
await writePng('offline', usage)
await writePng('navigation', overlayPageIndicator(usage, 1, 3))
await writePng('page-indicator', overlayPageIndicator(usage, 1, 3))
