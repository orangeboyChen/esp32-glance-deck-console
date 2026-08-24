import { describe, expect, mock, test } from 'bun:test'

const updates: Array<Record<string, unknown>> = []
const where = mock(async () => undefined)
const set = mock((value: Record<string, unknown>) => {
  updates.push(value)
  return { where }
})
const update = mock(() => ({ set }))

mock.module('@/server/database/db', () => ({
  databaseDialect: 'postgresql',
  databaseUrl: 'postgresql://localhost/glance_deck',
  db: { update },
}))

const { consumeDeviceState, consumeOtaState } = await import('@/server/messaging/mqtt')
const { consumeOtaCheck } = await import('@/server/messaging/mqtt')

describe('MQTT state consumers', () => {
  test('persists valid device state and command confirmation', async () => {
    updates.length = 0
    await consumeDeviceState(
      'glance_deck/desk-1/state',
      Buffer.from(
        JSON.stringify({
          version: 1,
          page_id: 'usage',
          wifi_rssi: -55,
          firmware_version: '1.0.0',
          power: { source: 'usb_and_battery', charging: true, battery_percent: 82, battery_mv: 3975 },
          command_id: 'command-1',
          command_status: 'confirmed',
        }),
      ),
    )
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({
      status: 'online',
      active_page_id: 'usage',
      wifi_rssi: -55,
      firmware_version: '1.0.0',
      power_source: 'usb_and_battery',
      charging: true,
      battery_percent: 82,
      battery_mv: 3975,
      power_updated_at: expect.any(Date),
    })
    expect(updates[1]).toMatchObject({ status: 'confirmed', confirmed_at: expect.any(Date) })
  })

  test('ignores malformed, oversized, and wrong-topic device state', async () => {
    updates.length = 0
    await consumeDeviceState('glance_deck/invalid!/state', Buffer.from('{}'))
    await consumeDeviceState('glance_deck/desk-1/state', Buffer.from('invalid JSON'))
    await consumeDeviceState('glance_deck/desk-1/state', Buffer.alloc(4097))
    await consumeDeviceState('glance_deck/desk-1/state', Buffer.from(JSON.stringify({ version: 1, page_id: 'usage', wifi_rssi: 'bad' })))
    await consumeDeviceState(
      'glance_deck/desk-1/state',
      Buffer.from(JSON.stringify({ version: 1, page_id: 'usage', wifi_rssi: -55, power: { source: 'battery', battery_percent: 101 } })),
    )
    expect(updates).toHaveLength(0)
  })

  test('persists terminal OTA states and applies an error fallback', async () => {
    updates.length = 0
    await consumeOtaState('glance_deck/desk-1/ota/state', Buffer.from(JSON.stringify({ job_id: 'job-1', phase: 'failed' })))
    await consumeOtaState('glance_deck/desk-1/ota/state', Buffer.from(JSON.stringify({ job_id: 'job-2', phase: 'healthy' })))
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({ status: 'failed', error_message: 'device_ota_failed', completed_at: expect.any(Date) })
    expect(updates[1]).toMatchObject({ status: 'healthy', error_message: null, completed_at: expect.any(Date) })
  })

  test('ignores invalid OTA payloads', async () => {
    updates.length = 0
    await consumeOtaState('glance_deck/desk-1/state', Buffer.from('{}'))
    await consumeOtaState('glance_deck/desk-1/ota/state', Buffer.from('bad JSON'))
    await consumeOtaState('glance_deck/desk-1/ota/state', Buffer.from(JSON.stringify({ job_id: 'job-1', phase: 'missing' })))
    expect(updates).toHaveLength(0)
  })

  test('ignores invalid local OTA check requests', async () => {
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) }
    const client = { publish: mock((topic: string, payload: string, options: unknown, callback: (error?: Error) => void) => callback()) }
    await consumeOtaCheck('glance_deck/invalid!/ota/check', Buffer.from('{}'), database as never, client as never)
    await consumeOtaCheck('glance_deck/desk-1/ota/check', Buffer.from('bad'), database as never, client as never)
    expect(client.publish).not.toHaveBeenCalled()
  })
})
