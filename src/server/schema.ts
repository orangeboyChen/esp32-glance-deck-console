import { database_dialect, database_url } from './db'
import * as postgresql_schema from './schema.postgres'
import * as sqlite_schema from './schema.sqlite'

const schema = database_dialect === 'sqlite' && database_url ? sqlite_schema : postgresql_schema

export const administrators: any = schema.administrators
export const sessions: any = schema.sessions
export const passkeys: any = schema.passkeys
export const webauthn_challenges: any = schema.webauthn_challenges
export const display_releases: any = schema.display_releases
export const display_release_pages: any = schema.display_release_pages
export const usage_sources: any = schema.usage_sources
export const source_snapshots: any = schema.source_snapshots
export const alert_rules: any = schema.alert_rules
export const display_bindings: any = schema.display_bindings
export const devices: any = schema.devices
export const device_enrollment_requests: any = schema.device_enrollment_requests
export const device_commands: any = schema.device_commands
export const firmware_releases: any = schema.firmware_releases
export const ota_jobs: any = schema.ota_jobs
export const api_tokens: any = schema.api_tokens
export const audit_events: any = schema.audit_events
