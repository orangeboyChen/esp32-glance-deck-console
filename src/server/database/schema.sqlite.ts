import { blob, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const identifier = (name: string) =>
  text(name)
    .$defaultFn(() => crypto.randomUUID())
    .notNull()
const createdAt = () => integer({ mode: 'timestamp_ms' }).defaultNow().notNull()
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>()

export const administrators = sqliteTable(
  'administrators',
  {
    id: identifier('id').primaryKey(),
    email: text('email').notNull(),
    password_hash: text('password_hash').notNull(),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex('administrators_email_unique').on(table.email)],
)
export const sessions = sqliteTable(
  'sessions',
  {
    id: identifier('id').primaryKey(),
    administrator_id: text('administrator_id')
      .references(() => administrators.id, { onDelete: 'cascade' })
      .notNull(),
    token_selector: text('token_selector'),
    token_hash: text('token_hash').notNull(),
    expires_at: timestamp('expires_at').notNull(),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex('sessions_token_selector_unique').on(table.token_selector)],
)
export const passkeys = sqliteTable(
  'passkeys',
  {
    id: identifier('id').primaryKey(),
    administrator_id: text('administrator_id')
      .references(() => administrators.id, { onDelete: 'cascade' })
      .notNull(),
    credential_id: text('credential_id').notNull(),
    public_key: text('public_key').notNull(),
    counter: integer('counter').default(0).notNull(),
    transports: json<string[]>('transports'),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex('passkeys_credential_id_unique').on(table.credential_id)],
)
export const webauthnChallenges = sqliteTable('webauthn_challenges', {
  id: identifier('id').primaryKey(),
  administrator_id: text('administrator_id').references(() => administrators.id, { onDelete: 'cascade' }),
  challenge: text('challenge').notNull(),
  purpose: text('purpose').notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: createdAt(),
})
export const displayReleases = sqliteTable('display_releases', {
  id: identifier('id').primaryKey(),
  version: integer('version').notNull(),
  page_id: text('page_id').notNull(),
  document: json<unknown>('document').notNull(),
  preview_svg: text('preview_svg').notNull(),
  device_image: blob('device_image', { mode: 'buffer' }).notNull(),
  image_format: text('image_format').default('mono1-msb').notNull(),
  image_width: integer('image_width').default(400).notNull(),
  image_height: integer('image_height').default(300).notNull(),
  content_sha256: text('content_sha256').notNull(),
  created_at: createdAt(),
})
export const displayReleasePages = sqliteTable(
  'display_release_pages',
  {
    release_id: text('release_id')
      .references(() => displayReleases.id, { onDelete: 'cascade' })
      .notNull(),
    page_id: text('page_id').notNull(),
    position: integer('position').notNull(),
    document: json<unknown>('document').notNull(),
    preview_svg: text('preview_svg').notNull(),
    device_image: blob('device_image', { mode: 'buffer' }).notNull(),
    image_format: text('image_format').default('mono1-msb').notNull(),
    image_width: integer('image_width').default(400).notNull(),
    image_height: integer('image_height').default(300).notNull(),
    content_sha256: text('content_sha256').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.release_id, table.page_id] }),
    uniqueIndex('display_release_pages_position_unique').on(table.release_id, table.position),
  ],
)
export const usageSources = sqliteTable('usage_sources', {
  id: identifier('id').primaryKey(),
  name: text('name').notNull(),
  base_url: text('base_url').notNull(),
  request_path: text('request_path').notNull(),
  method: text('method').default('GET').notNull(),
  headers: json<Record<string, string>>('headers').default({}).notNull(),
  body_template: text('body_template'),
  secret_ciphertext: text('secret_ciphertext').notNull(),
  mapper: json<Record<string, string>>('mapper').notNull(),
  refresh_interval_seconds: integer('refresh_interval_seconds').default(900).notNull(),
  status: text('status', { enum: ['active', 'paused', 'error', 'refreshing'] })
    .default('active')
    .notNull(),
  last_attempt_at: timestamp('last_attempt_at'),
  last_success_at: timestamp('last_success_at'),
  last_error: text('last_error'),
  created_at: createdAt(),
})
export const sourceSnapshots = sqliteTable('source_snapshots', {
  id: identifier('id').primaryKey(),
  source_id: text('source_id')
    .references(() => usageSources.id, { onDelete: 'cascade' })
    .notNull(),
  values: json<Record<string, string | number | null>>('values').notNull(),
  response_preview: text('response_preview'),
  fetched_at: timestamp('fetched_at').defaultNow().notNull(),
})
export const alertRules = sqliteTable('alert_rules', {
  id: identifier('id').primaryKey(),
  name: text('name').notNull(),
  source_id: text('source_id')
    .references(() => usageSources.id, { onDelete: 'cascade' })
    .notNull(),
  field: text('field').notNull(),
  operator: text('operator', { enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains'] }).notNull(),
  threshold: text('threshold').notNull(),
  severity: text('severity').default('warning').notNull(),
  message: text('message').notNull(),
  device_ids: json<string[]>('device_ids').notNull(),
  page_ids: json<string[]>('page_ids').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  test_only: integer('test_only', { mode: 'boolean' }).default(false).notNull(),
  active: integer('active', { mode: 'boolean' }).default(false).notNull(),
  last_value: json<unknown>('last_value'),
  last_evaluated_at: timestamp('last_evaluated_at'),
  last_triggered_at: timestamp('last_triggered_at'),
  created_at: createdAt(),
})
export const displayBindings = sqliteTable('display_bindings', {
  id: identifier('id').primaryKey(),
  source_id: text('source_id')
    .references(() => usageSources.id, { onDelete: 'cascade' })
    .notNull(),
  page_id: text('page_id').notNull(),
  document_template: json<unknown>('document_template').notNull(),
  device_ids: json<string[]>('device_ids').notNull(),
  created_at: createdAt(),
})
export const displayPageDefinitions = sqliteTable(
  'display_page_definitions',
  {
    id: identifier('id').primaryKey(),
    page_id: text('page_id').notNull(),
    name: text('name').notNull(),
    provider_type: text('provider_type').notNull(),
    template_id: text('template_id').notNull(),
    source_id: text('source_id').references(() => usageSources.id, { onDelete: 'set null' }),
    document_template: json<unknown>('document_template').notNull(),
    created_at: createdAt(),
    updated_at: createdAt(),
  },
  (table) => [uniqueIndex('display_page_definitions_page_id_unique').on(table.page_id)],
)
export const firmwareReleases = sqliteTable(
  'firmware_releases',
  {
    id: identifier('id').primaryKey(),
    version: text('version').notNull(),
    board_model: text('board_model').notNull(),
    channel: text('channel').default('stable').notNull(),
    manifest_url: text('manifest_url').notNull(),
    image_url: text('image_url').notNull(),
    image_sha256: text('image_sha256').notNull(),
    manifest_signature: text('manifest_signature').notNull(),
    verified_at: timestamp('verified_at').defaultNow().notNull(),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex('firmware_releases_version_board_unique').on(table.version, table.board_model)],
)
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  board_model: text('board_model').default('ESP32-S3-RLCD-4.2').notNull(),
  status: text('status', { enum: ['enrolling', 'online', 'offline', 'error'] })
    .default('enrolling')
    .notNull(),
  firmware_version: text('firmware_version'),
  last_good_firmware_release_id: text('last_good_firmware_release_id').references(() => firmwareReleases.id),
  wifi_rssi: integer('wifi_rssi'),
  active_page_id: text('active_page_id').default('system').notNull(),
  desired_page_id: text('desired_page_id'),
  enabled_page_ids: json<string[]>('enabled_page_ids'),
  power_source: text('power_source'),
  charging: integer('charging', { mode: 'boolean' }),
  battery_percent: integer('battery_percent'),
  battery_mv: integer('battery_mv'),
  power_updated_at: timestamp('power_updated_at'),
  release_id: text('release_id').references(() => displayReleases.id),
  last_seen_at: timestamp('last_seen_at'),
  enrollment_code_hash: text('enrollment_code_hash'),
  enrollment_expires_at: timestamp('enrollment_expires_at'),
  mqtt_username: text('mqtt_username'),
  mqtt_password_ciphertext: text('mqtt_password_ciphertext'),
  created_at: createdAt(),
})
export const deviceEnrollmentRequests = sqliteTable(
  'device_enrollment_requests',
  {
    id: identifier('id').primaryKey(),
    pairing_code_hash: text('pairing_code_hash').notNull(),
    claim_secret_hash: text('claim_secret_hash').notNull(),
    board_model: text('board_model').notNull(),
    claimed_device_id: text('claimed_device_id').references(() => devices.id, { onDelete: 'set null' }),
    expires_at: timestamp('expires_at').notNull(),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex('device_enrollment_requests_pairing_code_unique').on(table.pairing_code_hash)],
)
export const deviceCommands = sqliteTable('device_commands', {
  id: identifier('id').primaryKey(),
  device_id: text('device_id')
    .references(() => devices.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  payload: json<unknown>('payload').notNull(),
  status: text('status', { enum: ['queued', 'sent', 'confirmed', 'failed'] })
    .default('queued')
    .notNull(),
  error_message: text('error_message'),
  created_at: createdAt(),
  confirmed_at: timestamp('confirmed_at'),
})
export const otaJobs = sqliteTable('ota_jobs', {
  id: identifier('id').primaryKey(),
  device_id: text('device_id')
    .references(() => devices.id, { onDelete: 'cascade' })
    .notNull(),
  firmware_release_id: text('firmware_release_id')
    .references(() => firmwareReleases.id)
    .notNull(),
  status: text('status', {
    enum: [
      'awaiting_confirmation',
      'queued',
      'sent',
      'downloading',
      'verifying',
      'rebooting',
      'healthy',
      'rolled_back',
      'failed',
      'cancelled',
    ],
  })
    .default('queued')
    .notNull(),
  nonce: text('nonce').notNull(),
  error_message: text('error_message'),
  created_at: createdAt(),
  completed_at: timestamp('completed_at'),
})
export const apiTokens = sqliteTable('api_tokens', {
  id: identifier('id').primaryKey(),
  label: text('label').notNull(),
  token_hash: text('token_hash').notNull(),
  scopes: json<string[]>('scopes').notNull(),
  revoked_at: timestamp('revoked_at'),
  created_at: createdAt(),
})
export const auditEvents = sqliteTable('audit_events', {
  id: identifier('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  metadata: json<unknown>('metadata').notNull(),
  created_at: createdAt(),
})
