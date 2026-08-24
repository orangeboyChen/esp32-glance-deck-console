import { randomBytes } from 'node:crypto'

import { connect, type MqttClient } from 'mqtt'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { signedReleasePageImageUrl } from '@/server/display/assets'
import { deviceCommands, devices, firmwareReleases, otaJobs } from '@/server/database/schema'

let mqttClient: MqttClient | undefined
let stateConsumerStarted = false

export const MAX_DEVICE_MQTT_PAYLOAD_BYTES = 8_192

export const validateMqttUrl = (url: string, allowPlaintextInternal = false) => {
  const parsed = new URL(url)
  if (parsed.protocol === 'mqtts:' || parsed.protocol === 'wss:') {
    return parsed
  }
  if (allowPlaintextInternal && (parsed.protocol === 'mqtt:' || parsed.protocol === 'ws:')) {
    return parsed
  }
  throw new Error('mqtt_tls_required')
}

export const commandMessage = (command: { id: string; action: string; payload: unknown }) => {
  return JSON.stringify({ command_id: command.id, action: command.action, payload: command.payload })
}

export const otaMessage = (job: { id: string; nonce: string; version: string; manifest_url: string; image_sha256: string }) => {
  return JSON.stringify({
    job_id: job.id,
    nonce: job.nonce,
    version: job.version,
    manifest_url: job.manifest_url,
    image_sha256: job.image_sha256,
  })
}

export const releaseMessage = (release: { id: string; active_page_id: string; pages: ReleasePageMetadata[] }, baseUrl: string) => {
  if (!baseUrl.startsWith('https://')) {
    throw new Error('device_asset_url_https_required')
  }
  if (release.pages.length === 0 || !release.pages.some((page) => page.page_id === release.active_page_id)) {
    throw new Error('release_pages_invalid')
  }
  const message = JSON.stringify({
    release_id: release.id,
    document_version: 1,
    active_page_id: release.active_page_id,
    pages: release.pages.map((page) => ({ ...page, image_url: signedReleasePageImageUrl(baseUrl, release.id, page.page_id) })),
  })
  if (Buffer.byteLength(message, 'utf8') > MAX_DEVICE_MQTT_PAYLOAD_BYTES) {
    throw new Error('release_message_too_large')
  }
  return message
}

const getClient = () => {
  if (mqttClient) {
    return mqttClient
  }
  const url = process.env.MQTT_URL
  if (!url) {
    throw new Error('mqtt_url_missing')
  }
  const endpoint = validateMqttUrl(url, process.env.MQTT_ALLOW_PLAINTEXT_INTERNAL === 'true')
  mqttClient = connect(endpoint.toString(), {
    reconnectPeriod: 5_000,
    rejectUnauthorized: endpoint.protocol === 'mqtts:' || endpoint.protocol === 'wss:',
  })
  return mqttClient
}

export const publishDeviceCommand = async (
  deviceId: string,
  command: { id: string; action: string; payload: unknown },
  client = getClient(),
) => {
  const topic = `glance_deck/${deviceId}/command`
  const message = commandMessage(command)

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, message, { qos: 1 }, (error) => (error ? reject(error) : resolve()))
  })
}

export const publishDeviceOta = async (
  deviceId: string,
  job: { id: string; nonce: string; version: string; manifest_url: string; image_sha256: string },
  client = getClient(),
) => {
  const topic = `${TOPIC_PREFIX}/${deviceId}/ota`
  const message = otaMessage(job)
  await new Promise<void>((resolve, reject) => {
    client.publish(topic, message, { qos: 1 }, (error) => (error ? reject(error) : resolve()))
  })
}

export const publishDeviceOtaCheckState = async (
  deviceId: string,
  state: {
    status: 'available' | 'up_to_date' | 'failed'
    job_id?: string
    nonce?: string
    version?: string
    manifest_url?: string
    image_sha256?: string
    error_message?: string
  },
  client = getClient(),
) => {
  await new Promise<void>((resolve, reject) =>
    client.publish(`${TOPIC_PREFIX}/${deviceId}/ota/check/state`, JSON.stringify(state), { qos: 1 }, (error) =>
      error ? reject(error) : resolve(),
    ),
  )
}

export type ReleasePageMetadata = {
  page_id: string
  image_format: string
  image_width: number
  image_height: number
  image_sha256: string
  image_bytes: number
}

export const publishDeviceRelease = async (
  deviceId: string,
  release: { id: string; version: number; active_page_id: string; pages: ReleasePageMetadata[] },
  client = getClient(),
) => {
  const baseUrl = process.env.DEVICE_ASSET_URL ?? process.env.APP_URL
  if (!baseUrl) {
    throw new Error('device_asset_url_https_required')
  }
  const message = releaseMessage(release, baseUrl)
  await new Promise<void>((resolve, reject) =>
    client.publish(`${TOPIC_PREFIX}/${deviceId}/release`, message, { qos: 1, retain: true }, (error) =>
      error ? reject(error) : resolve(),
    ),
  )
}

type DeviceStateMessage = {
  version: number
  page_id: string
  wifi_rssi: number
  display_release_id?: string
  command_id?: string
  command_status?: 'confirmed' | 'failed'
  error_message?: string
  firmware_version?: string
  power?: {
    source: 'usb' | 'battery' | 'usb_and_battery' | 'unavailable'
    charging?: boolean
    battery_percent?: number
    battery_mv?: number
  }
}

type OtaStateMessage = {
  job_id: string
  phase: 'downloading' | 'verifying' | 'rebooting' | 'healthy' | 'rolled_back' | 'failed'
  error_message?: string
  progress_percent?: number
}

export const isDeviceState = (value: unknown): value is DeviceStateMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const state = value as Record<string, unknown>
  return (
    typeof state.version === 'number' &&
    typeof state.page_id === 'string' &&
    typeof state.wifi_rssi === 'number' &&
    (state.command_id === undefined || typeof state.command_id === 'string') &&
    (state.command_status === undefined || state.command_status === 'confirmed' || state.command_status === 'failed') &&
    (state.firmware_version === undefined || typeof state.firmware_version === 'string') &&
    (state.power === undefined || isDevicePowerState(state.power))
  )
}

const isDevicePowerState = (value: unknown): value is NonNullable<DeviceStateMessage['power']> => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const power = value as Record<string, unknown>
  const hasValidPercent =
    power.battery_percent === undefined ||
    (typeof power.battery_percent === 'number' &&
      Number.isInteger(power.battery_percent) &&
      power.battery_percent >= 0 &&
      power.battery_percent <= 100)
  const hasValidVoltage =
    power.battery_mv === undefined ||
    (typeof power.battery_mv === 'number' && Number.isInteger(power.battery_mv) && power.battery_mv >= 2_500 && power.battery_mv <= 5_500)
  return (
    (power.source === 'usb' || power.source === 'battery' || power.source === 'usb_and_battery' || power.source === 'unavailable') &&
    (power.charging === undefined || typeof power.charging === 'boolean') &&
    hasValidPercent &&
    hasValidVoltage
  )
}

export const isOtaState = (value: unknown): value is OtaStateMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const message = value as Record<string, unknown>
  const validPhase = ['downloading', 'verifying', 'rebooting', 'healthy', 'rolled_back', 'failed'].includes(String(message.phase))
  return (
    typeof message.job_id === 'string' &&
    validPhase &&
    (message.error_message === undefined || typeof message.error_message === 'string') &&
    (message.progress_percent === undefined ||
      (typeof message.progress_percent === 'number' &&
        Number.isInteger(message.progress_percent) &&
        message.progress_percent >= 0 &&
        message.progress_percent <= 100))
  )
}

export const consumeDeviceState = async (topic: string, payload: Buffer) => {
  const match = /^glance_deck\/([a-z0-9-]{1,64})\/state$/.exec(topic)
  if (!match || !db || payload.length > MAX_DEVICE_MQTT_PAYLOAD_BYTES) {
    return
  }
  let state: unknown
  try {
    state = JSON.parse(payload.toString('utf8'))
  } catch {
    return
  }
  if (!isDeviceState(state)) {
    return
  }
  const deviceId = match[1]
  await db
    .update(devices)
    .set({
      status: 'online',
      active_page_id: state.page_id,
      wifi_rssi: Math.trunc(state.wifi_rssi),
      firmware_version: state.firmware_version,
      power_source: state.power?.source,
      charging: state.power?.charging,
      battery_percent: state.power?.battery_percent,
      battery_mv: state.power?.battery_mv,
      power_updated_at: state.power ? new Date() : undefined,
      last_seen_at: new Date(),
    })
    .where(eq(devices.id, deviceId))

  if (state.command_id && state.command_status) {
    await db
      .update(deviceCommands)
      .set({
        status: state.command_status,
        error_message: state.command_status === 'failed' ? (state.error_message ?? 'device_command_failed') : null,
        confirmed_at: state.command_status === 'confirmed' ? new Date() : null,
      })
      .where(and(eq(deviceCommands.id, state.command_id), eq(deviceCommands.device_id, deviceId), eq(deviceCommands.status, 'sent')))
  }
}

export const consumeOtaState = async (topic: string, payload: Buffer) => {
  const match = /^glance_deck\/([a-z0-9-]{1,64})\/ota\/state$/.exec(topic)
  if (!match || !db || payload.length > MAX_DEVICE_MQTT_PAYLOAD_BYTES) {
    return
  }
  let state: unknown
  try {
    state = JSON.parse(payload.toString('utf8'))
  } catch {
    return
  }
  if (!isOtaState(state)) {
    return
  }
  const phase = state.phase
  await db
    .update(otaJobs)
    .set({
      status: phase,
      error_message: phase === 'failed' ? (state.error_message ?? 'device_ota_failed') : null,
      completed_at: phase === 'healthy' || phase === 'rolled_back' || phase === 'failed' ? new Date() : null,
    })
    .where(and(eq(otaJobs.id, state.job_id), eq(otaJobs.device_id, match[1])))
}

export const consumeOtaCheck = async (topic: string, payload: Buffer, database = db, client?: MqttClient) => {
  const match = new RegExp(`^${TOPIC_PREFIX}/([a-z0-9-]{1,64})/ota/check$`).exec(topic)
  if (!match || !database || payload.length > MAX_DEVICE_MQTT_PAYLOAD_BYTES) {
    return
  }
  let request: unknown
  try {
    request = JSON.parse(payload.toString('utf8'))
  } catch {
    return
  }
  if (!request || typeof request !== 'object' || (request as Record<string, unknown>).version !== 1) {
    return
  }
  const deviceId = match[1]
  const [device] = await database
    .select({ board_model: devices.board_model, firmware_version: devices.firmware_version })
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1)
  const [release] = device
    ? await database
        .select()
        .from(firmwareReleases)
        .where(and(eq(firmwareReleases.board_model, device.board_model), eq(firmwareReleases.channel, 'stable')))
        .orderBy(desc(firmwareReleases.created_at))
        .limit(1)
    : []
  if (!device || !release) {
    await publishDeviceOtaCheckState(deviceId, { status: 'failed', error_message: 'no_compatible_release' }, client)
    return
  }
  if (device.firmware_version === release.version) {
    await publishDeviceOtaCheckState(deviceId, { status: 'up_to_date', version: release.version }, client)
    return
  }
  const [job] = await database
    .insert(otaJobs)
    .values({
      device_id: deviceId,
      firmware_release_id: release.id,
      nonce: randomBytes(24).toString('base64url'),
      status: 'awaiting_confirmation',
    })
    .returning({ id: otaJobs.id, nonce: otaJobs.nonce })
  await publishDeviceOtaCheckState(
    deviceId,
    {
      status: 'available',
      job_id: job.id,
      nonce: job.nonce,
      version: release.version,
      manifest_url: release.manifest_url,
      image_sha256: release.image_sha256,
    },
    client,
  )
}

export const startDeviceStateConsumer = () => {
  if (stateConsumerStarted) {
    return
  }
  const client = getClient()
  stateConsumerStarted = true
  client.subscribe([`${TOPIC_PREFIX}/+/state`, `${TOPIC_PREFIX}/+/ota/state`, `${TOPIC_PREFIX}/+/ota/check`], { qos: 1 })
  client.on('message', (topic, payload) => {
    const handler = topic.endsWith('/ota/state') ? consumeOtaState : topic.endsWith('/ota/check') ? consumeOtaCheck : consumeDeviceState
    void handler(topic, payload).catch((error) => console.error('device MQTT state consume failed', error))
  })
}

const TOPIC_PREFIX = 'glance_deck'
