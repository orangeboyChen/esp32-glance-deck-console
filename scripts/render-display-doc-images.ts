import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { DISPLAY_HEIGHT, DISPLAY_WIDTH, render_device_bitmap, type Display_document } from '../src/server/preview'

const script_directory = fileURLToPath(new URL('.', import.meta.url))
const image_directory = resolve(script_directory, '../../docs/image')
const background = 242
const foreground = 38

const pages: Record<string, Display_document> = {
  usage: {
    title: 'Usage',
    subtitle: 'Codex subscription',
    icon: 'usage',
    progresses: [
      { label: 'Day', value: 79, max: 776, unit: 'USD' },
      { label: 'Week', value: 618, max: 2054, unit: 'USD' },
      { label: 'Month', value: 2068, max: 8216, unit: 'USD' },
    ],
    lines: [{ label: 'Resets', value: 'Tomorrow' }],
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

function overlay_page_indicator(frame: Buffer, active_index: number, page_count: number) {
  const overlay = Buffer.from(frame)
  const spacing = 14
  const center_x = DISPLAY_WIDTH / 2
  const center_y = DISPLAY_HEIGHT - 22
  const group_width = (page_count - 1) * spacing
  for (let index = 0; index < page_count; index += 1) {
    const circle_x = center_x - group_width / 2 + index * spacing
    for (let y = circle_y_start(center_y); y <= center_y + 4; y += 1) {
      for (let x = circle_x - 4; x <= circle_x + 4; x += 1) {
        const distance = (x - circle_x) ** 2 + (y - center_y) ** 2
        if (distance > 16 || (index !== active_index && distance < 9)) continue
        const offset = y * DISPLAY_WIDTH + x
        overlay[offset >> 3] |= 0x80 >> (offset & 7)
      }
    }
  }
  return overlay
}

function circle_y_start(center_y: number) {
  return center_y - 4
}

async function write_png(name: string, frame: Buffer) {
  const pixels = Buffer.alloc(DISPLAY_WIDTH * DISPLAY_HEIGHT)
  for (let pixel = 0; pixel < pixels.length; pixel += 1) {
    pixels[pixel] = frame[pixel >> 3] & (0x80 >> (pixel & 7)) ? foreground : background
  }
  await writeFile(resolve(image_directory, `${name}.png`), await sharp(pixels, { raw: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, channels: 1 } }).png().toBuffer())
}

await mkdir(image_directory, { recursive: true })
for (const [name, document] of Object.entries(pages)) await write_png(name, render_device_bitmap(document).device_image)
const usage = render_device_bitmap(pages.usage).device_image
await write_png('offline', usage)
await write_png('navigation', overlay_page_indicator(usage, 1, 3))
await write_png('page-indicator', overlay_page_indicator(usage, 1, 3))
