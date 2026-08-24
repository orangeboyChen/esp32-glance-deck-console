import { z } from 'zod'

import { routing } from '@/i18n/routing'

export const jsonValueSchema = z.json()

export const loginRequestSchema = z.object({ email: z.email(), password: z.string().min(1) })
export const setupRequestSchema = z.object({ email: z.email(), password: z.string().min(12).max(128) })
export const serializedPasskeyLoginSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  clientExtensionResults: z.record(z.string(), z.json()),
})
export const serializedPasskeyRegistrationSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(z.string()).optional(),
  }),
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.string(), z.json()),
})
export const localeRequestSchema = z.object({ locale: z.enum(routing.locales) })
export const alertCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
  source_id: z.uuid(),
  field: z.enum(['plan_name', 'used', 'remaining', 'total', 'unit', 'resets_at', 'status']),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains']),
  threshold: z.string().trim().min(1).max(128),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  message: z.string().trim().min(1).max(256),
  device_ids: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
    .min(1)
    .max(50),
  page_ids: z
    .array(z.string().regex(/^[a-z0-9-]{1,64}$/))
    .min(1)
    .max(10),
  enabled: z.boolean().default(true),
  test_only: z.boolean().default(false),
})
export const deviceCommandRequestSchema = z.object({
  action: z.enum(['show_page', 'next_page', 'previous_page', 'set_rotation', 'refresh_release', 'enter_maintenance']),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})
export const otaInstallRequestSchema = z.object({ firmware_release_id: z.uuid().optional() })
export const pageConfigurationRequestSchema = z.object({
  enabled_page_ids: z
    .array(z.string().regex(/^[a-z0-9-]{1,64}$/))
    .min(1)
    .max(10),
  desired_page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
})
export const enrollmentRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
  pairing_code: z.string().regex(/^\d{6}$/),
  board_model: z.literal('ESP32-S3-RLCD-4.2'),
})
export const enrollmentAnnounceRequestSchema = z.object({
  pairing_code: z.string().regex(/^\d{6}$/),
  claim_secret: z.string().regex(/^[a-f0-9]{64}$/),
  board_model: z.literal('ESP32-S3-RLCD-4.2'),
})
export const enrollmentClaimRequestSchema = z.object({
  pairing_code: z.string().regex(/^\d{6}$/),
  claim_secret: z.string().regex(/^[a-f0-9]{64}$/),
})
export const firmwareReleaseRequestSchema = z.object({
  version: z.string().min(1).max(64),
  board_model: z.literal('ESP32-S3-RLCD-4.2'),
  channel: z.enum(['stable', 'beta', 'test']).default('stable'),
  manifest_url: z.url().refine((url) => url.startsWith('https://')),
  image_url: z.url().refine((url) => url.startsWith('https://')),
  image_sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  manifest_signature: z.string().regex(/^[a-fA-F0-9]{128}$/),
})
export const rolloutRequestSchema = z.object({
  firmware_release_id: z.uuid(),
  device_ids: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
    .min(1)
    .max(100),
  percentage: z.number().int().min(1).max(100).default(100),
})
export const otaJobRequestSchema = z.object({ action: z.enum(['cancel', 'rollback']) }).default({ action: 'cancel' })
export const progressSchema = z.object({
  value: z.union([z.number(), z.string().max(48)]),
  max: z.union([z.number(), z.string().max(48)]),
  label: z.string().max(48).optional(),
  unit: z.string().max(16).optional(),
})
export const displayDocumentSchema = z.object({
  title: z.string().min(1).max(48),
  subtitle: z.string().max(80).optional(),
  icon: z.enum(['usage', 'battery', 'wifi', 'system', 'home']).optional(),
  progress: progressSchema.optional(),
  progresses: z.array(progressSchema).min(1).max(3).optional(),
  usage_details: z
    .array(z.object({ remaining: z.string().max(48).optional(), resets_at: z.string().max(48).optional() }))
    .max(3)
    .optional(),
  lines: z
    .array(z.object({ label: z.string().max(48), value: z.string().max(48) }))
    .max(7)
    .optional(),
})
export const releaseRequestSchema = z
  .object({
    active_page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    pages: z
      .array(z.object({ page_id: z.string().regex(/^[a-z0-9-]{1,64}$/), document: displayDocumentSchema }))
      .min(1)
      .max(10),
    device_ids: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).min(1),
  })
  .superRefine((release, context) => {
    if (!release.pages.some((page) => page.page_id === release.active_page_id)) {
      context.addIssue({ code: 'custom', message: 'active_page_not_found', path: ['active_page_id'] })
    }
    const pageIds = new Set(release.pages.map((page) => page.page_id))
    if (pageIds.size !== release.pages.length) {
      context.addIssue({ code: 'custom', message: 'page_ids_must_be_unique', path: ['pages'] })
    }
    if (!pageIds.has('system')) {
      context.addIssue({ code: 'custom', message: 'system_page_required', path: ['pages'] })
    }
  })
export const sourceCreateRequestSchema = z.object({
  name: z.string().min(1).max(128),
  base_url: z.url(),
  request_path: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).default({}),
  body_template: z.string().max(8192).optional(),
  secrets: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), z.string()).default({}),
  mapper: z
    .record(z.string(), z.string().max(256))
    .refine((mapper) =>
      Object.keys(mapper).every((key) =>
        ['plan_name', 'used', 'remaining', 'total', 'unit', 'resets_at', 'status', 'provider'].includes(key),
      ),
    ),
  refresh_interval_seconds: z.number().int().min(60).max(86_400).default(900),
})
export const soruxgptRequestSchema = z.object({ token: z.string().min(1).max(8192) })
export const tokenRequestSchema = z.object({
  label: z.string().min(1).max(128),
  scopes: z.array(z.enum(['devices:read', 'devices:command', 'alerts:read', 'ota:install'])).min(1),
})
export const displayBindingRequestSchema = z.object({
  source_id: z.uuid(),
  page_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  document_template: displayDocumentSchema,
  device_ids: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).min(1),
})
