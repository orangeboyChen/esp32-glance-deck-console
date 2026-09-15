import { afterEach, describe, expect, mock, test } from 'bun:test'

type Rule = {
  id: string
  source_id: string
  field: string
  operator: string
  threshold: string
  device_ids: string[]
  page_ids: string[]
  severity: string
  message: string
  test_only: boolean
  enabled: boolean
  active: boolean
  restore_page_ids: Record<string, string>
}
type Device = {
  id: string
  active_page_id: string
  desired_page_id: string | null
  release_id: string | null
  enabled_page_ids: string[] | null
}
type InsertedRow = { table: unknown; values: Record<string, unknown>[] }
type UpdatedRow = { table: unknown; set: Record<string, unknown> }

let ruleRows: Rule[] = []
let deviceRows: Device[] = []
let pageRows: { release_id: string; page_id: string }[] = []
let inserted: InsertedRow[] = []
let updated: UpdatedRow[] = []

const awaited = <T>(value: T) => {
  const chain = {
    where: () => chain,
    orderBy: () => chain,
    limit: async () => value,
    then: (resolve: (resolved: T) => unknown) => Promise.resolve(value).then(resolve),
  }
  return chain
}

// Table identity is only known after the schema module is imported, so the query mock compares
// against lazily captured references instead of the imported bindings.
const tables: Record<string, unknown> = {}

const database = {
  select: () => ({
    from: (table: unknown) => {
      if (table === tables.alertRules) {
        return awaited(ruleRows)
      }
      if (table === tables.devices) {
        return awaited(deviceRows)
      }
      if (table === tables.displayReleasePages) {
        return awaited(pageRows)
      }
      return awaited([])
    },
  }),
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted.push({ table, values: Array.isArray(values) ? values : [values] })
      return Promise.resolve()
    },
  }),
  update: (table: unknown) => ({
    set: (set: Record<string, unknown>) => {
      updated.push({ table, set })
      return { where: async () => undefined }
    },
  }),
}

mock.module('@/server/database/db', () => ({
  databaseDialect: 'postgresql',
  databaseUrl: 'postgresql://localhost/glance_deck',
  db: database,
}))

const { alertRules, deviceCommands, devices, displayReleasePages } = await import('@/server/database/schema')
Object.assign(tables, { alertRules, devices, deviceCommands, displayReleasePages })

const { evaluateAlertRules, restoreAlertRulePages, matchesAlert } = await import('@/server/alert/alerts')

const mkRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: 'rule-1',
  source_id: 'source-1',
  field: 'used',
  operator: 'gte',
  threshold: '80',
  device_ids: ['deck-a'],
  page_ids: ['alerts'],
  severity: 'warning',
  message: 'watch out',
  test_only: false,
  enabled: true,
  active: false,
  restore_page_ids: {},
  ...overrides,
})

const mkDevice = (overrides: Partial<Device> = {}): Device => ({
  id: 'deck-a',
  active_page_id: 'usage',
  desired_page_id: 'usage',
  release_id: 'release-1',
  enabled_page_ids: ['usage', 'alerts', 'system'],
  ...overrides,
})

const reset = ({ rules = [mkRule()], devices = [mkDevice()], pages = mkPages() } = {}) => {
  ruleRows = rules
  deviceRows = devices
  pageRows = pages
  inserted = []
  updated = []
}

const mkPages = () => [
  { release_id: 'release-1', page_id: 'usage' },
  { release_id: 'release-1', page_id: 'alerts' },
  { release_id: 'release-1', page_id: 'system' },
]

const ruleUpdates = () => updated.filter((row) => row.table === tables.alertRules).map((row) => row.set)
const commands = () => inserted.filter((row) => row.table === tables.deviceCommands).flatMap((row) => row.values)
const deviceUpdates = () => updated.filter((row) => row.table === tables.devices).map((row) => row.set)

describe('alert threshold evaluation', () => {
  test('compares numeric values with inclusive boundaries', () => {
    expect(matchesAlert(80, 'gte', '80')).toBe(true)
    expect(matchesAlert(79, 'gte', '80')).toBe(false)
    expect(matchesAlert('12.5', 'lt', '13')).toBe(true)
    expect(matchesAlert('not-a-number', 'gt', '1')).toBe(false)
    expect(matchesAlert(5, 'gt', '4')).toBe(true)
    expect(matchesAlert(5, 'lt', '4')).toBe(false)
    expect(matchesAlert(5, 'lte', '5')).toBe(true)
    expect(matchesAlert(5, 'neq', '4')).toBe(true)
    expect(matchesAlert(5, 'eq', '5')).toBe(true)
    expect(matchesAlert(' ', 'gt', '1')).toBe(false)
  })

  test('compares text and supports contains', () => {
    expect(matchesAlert('Critical quota', 'contains', 'quota')).toBe(true)
    expect(matchesAlert('ready', 'eq', 'ready')).toBe(true)
    expect(matchesAlert('ready', 'neq', 'ready')).toBe(false)
    expect(matchesAlert(null, 'eq', '')).toBe(true)
    expect(matchesAlert('ready', 'contains', 'NOT')).toBe(false)
    expect(matchesAlert(null, 'contains', 'ready')).toBe(false)
    expect(matchesAlert(5, 'eq', 'not-a-number')).toBe(false)
    expect(matchesAlert(5, 'neq', 'not-a-number')).toBe(true)
  })
})

describe('alert page takeover and restoration', () => {
  afterEach(() => {
    reset({ rules: [], devices: [], pages: [] })
  })

  test('shows the alert page and records the page it replaced', async () => {
    reset()
    const summary = await evaluateAlertRules('source-1', { used: 95 })
    expect(summary).toEqual({ evaluated: 1, triggered: 1, restored: 0 })
    expect(commands()).toEqual([{ device_id: 'deck-a', action: 'show_page', payload: { page_id: 'alerts' } }])
    expect(ruleUpdates()).toEqual([
      {
        active: true,
        last_value: 95,
        last_evaluated_at: expect.any(Date),
        restore_page_ids: { 'deck-a': 'usage' },
        last_triggered_at: expect.any(Date),
      },
    ])
    expect(deviceUpdates()).toEqual([{ desired_page_id: 'alerts' }])
  })

  test('re-evaluating an already active rule issues no further commands', async () => {
    reset({ rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })] })
    const summary = await evaluateAlertRules('source-1', { used: 96 })
    expect(summary).toEqual({ evaluated: 1, triggered: 0, restored: 0 })
    expect(commands()).toEqual([])
  })

  test('sends only page_id so the firmware accepts the command', async () => {
    // The firmware parses CommandPayload with deny_unknown_fields and declares nothing but page_id
    // and rotation_seconds, so any other key makes it discard the command entirely.
    const allowedPayloadKeys = ['page_id', 'rotation_seconds']
    reset()
    await evaluateAlertRules('source-1', { used: 95 })
    for (const command of commands()) {
      expect(Object.keys(command.payload).sort()).toEqual(allowedPayloadKeys.filter((key) => key in command.payload))
    }
    await reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts' })],
    })
    await evaluateAlertRules('source-1', { used: 10 })
    for (const command of commands()) {
      expect(command.payload).toEqual({ page_id: 'usage' })
    }
  })

  test('returns the device to the recorded page once the value falls below the threshold', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts' })],
    })
    const summary = await evaluateAlertRules('source-1', { used: 10 })
    expect(summary).toEqual({ evaluated: 1, triggered: 0, restored: 1 })
    expect(commands()).toEqual([{ device_id: 'deck-a', action: 'show_page', payload: { page_id: 'usage' } }])
    expect(ruleUpdates()[0].restore_page_ids).toEqual({})
    expect(deviceUpdates()).toEqual([{ desired_page_id: 'usage' }])
  })

  test('keeps a page the device moved to on its own when the alert clears', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'system', desired_page_id: 'system' })],
    })
    await evaluateAlertRules('source-1', { used: 10 })
    expect(commands()).toEqual([{ device_id: 'deck-a', action: 'show_page', payload: { page_id: 'system' } }])
  })

  test('falls back to another page when the recorded page is no longer renderable', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts', enabled_page_ids: ['alerts', 'system'] })],
    })
    await evaluateAlertRules('source-1', { used: 10 })
    expect(commands()).toEqual([{ device_id: 'deck-a', action: 'show_page', payload: { page_id: 'system' } }])
  })

  test('uses every release page when the device has no enabled subset', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts', enabled_page_ids: null })],
    })
    await evaluateAlertRules('source-1', { used: 10 })
    expect(commands()[0].payload.page_id).toBe('usage')
  })

  test('skips a device whose release has no other page to return to', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts', enabled_page_ids: ['alerts'] })],
      pages: [{ release_id: 'release-1', page_id: 'alerts' }],
    })
    const summary = await evaluateAlertRules('source-1', { used: 10 })
    expect(commands()).toEqual([])
    expect(summary.restored).toBe(0)
  })

  test('test_only rules track state without issuing commands', async () => {
    reset({ rules: [mkRule({ test_only: true })] })
    const summary = await evaluateAlertRules('source-1', { used: 95 })
    expect(summary).toEqual({ evaluated: 1, triggered: 1, restored: 0 })
    expect(commands()).toEqual([])
    expect(ruleUpdates()[0].restore_page_ids).toEqual({})
  })

  test('a rule without a target page never takes over the display', async () => {
    reset({ rules: [mkRule({ page_ids: [] })] })
    const summary = await evaluateAlertRules('source-1', { used: 95 })
    expect(summary).toEqual({ evaluated: 1, triggered: 1, restored: 0 })
    expect(commands()).toEqual([])
  })

  test('records no restore page when the device already shows the alert page', async () => {
    reset({ devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts' })] })
    await evaluateAlertRules('source-1', { used: 95 })
    expect(ruleUpdates()[0].restore_page_ids).toEqual({})
  })

  test('restores each device to its own pre-alert page', async () => {
    reset({
      rules: [mkRule({ active: true, device_ids: ['deck-a', 'deck-b'], restore_page_ids: { 'deck-a': 'usage', 'deck-b': 'system' } })],
      devices: [
        mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts' }),
        mkDevice({ id: 'deck-b', active_page_id: 'alerts', desired_page_id: 'alerts' }),
      ],
    })
    await evaluateAlertRules('source-1', { used: 10 })
    expect(commands().map((command) => [command.device_id, command.payload.page_id])).toEqual([
      ['deck-a', 'usage'],
      ['deck-b', 'system'],
    ])
  })

  test('clearing an active rule returns the device to its recorded page', async () => {
    reset({
      rules: [mkRule({ active: true, restore_page_ids: { 'deck-a': 'usage' } })],
      devices: [mkDevice({ active_page_id: 'alerts', desired_page_id: 'alerts' })],
    })
    const restored = await restoreAlertRulePages(ruleRows[0])
    expect(restored).toBe(1)
    expect(commands()).toEqual([{ device_id: 'deck-a', action: 'show_page', payload: { page_id: 'usage' } }])
    expect(ruleUpdates()).toEqual([{ restore_page_ids: {} }])
  })

  test('clearing a rule without a target page is a no-op', async () => {
    reset({ rules: [mkRule({ page_ids: [] })] })
    expect(await restoreAlertRulePages(ruleRows[0])).toBe(0)
    expect(commands()).toEqual([])
  })

  test('reports no rules when none are configured', async () => {
    reset({ rules: [] })
    expect(await evaluateAlertRules('source-1', { used: 95 })).toEqual({ evaluated: 0, triggered: 0, restored: 0 })
  })
})
