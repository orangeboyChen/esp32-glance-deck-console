import { databaseDialect, databaseUrl } from '@/server/database/db'
import * as postgresqlSchema from '@/server/database/schema.postgres'
import * as sqliteSchema from '@/server/database/schema.sqlite'

const schema = databaseDialect === 'sqlite' && databaseUrl ? sqliteSchema : postgresqlSchema

export const administrators = schema.administrators as typeof postgresqlSchema.administrators
export const sessions = schema.sessions as typeof postgresqlSchema.sessions
export const passkeys = schema.passkeys as typeof postgresqlSchema.passkeys
export const webauthnChallenges = schema.webauthnChallenges as typeof postgresqlSchema.webauthnChallenges
export const displayReleases = schema.displayReleases as typeof postgresqlSchema.displayReleases
export const displayReleasePages = schema.displayReleasePages as typeof postgresqlSchema.displayReleasePages
export const usageSources = schema.usageSources as typeof postgresqlSchema.usageSources
export const sourceSnapshots = schema.sourceSnapshots as typeof postgresqlSchema.sourceSnapshots
export const alertRules = schema.alertRules as typeof postgresqlSchema.alertRules
export const displayBindings = schema.displayBindings as typeof postgresqlSchema.displayBindings
export const devices = schema.devices as typeof postgresqlSchema.devices
export const deviceEnrollmentRequests = schema.deviceEnrollmentRequests as typeof postgresqlSchema.deviceEnrollmentRequests
export const deviceCommands = schema.deviceCommands as typeof postgresqlSchema.deviceCommands
export const firmwareReleases = schema.firmwareReleases as typeof postgresqlSchema.firmwareReleases
export const otaJobs = schema.otaJobs as typeof postgresqlSchema.otaJobs
export const apiTokens = schema.apiTokens as typeof postgresqlSchema.apiTokens
export const auditEvents = schema.auditEvents as typeof postgresqlSchema.auditEvents
