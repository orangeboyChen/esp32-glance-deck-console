import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'

import { and, desc, eq, gte, inArray, lt, or } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { decryptSecret } from '@/server/security/secrets'
import { publishSourceChanges } from '@/server/source/source-publisher'
import { evaluateAlertRules } from '@/server/alert/alerts'
import { sourceSnapshots, usageSources } from '@/server/database/schema'
import { deriveUsageMetrics } from '@/server/source/usage-stats'
import { normalizeSoruxgptCodex } from '@/server/source/soruxgpt'

const MAX_RESPONSE_BYTES = 256 * 1024
const fields = ['plan_name', 'used', 'remaining', 'total', 'unit', 'resets_at', 'status'] as const
type MappedValue = string | number | null

const jsonPath = (value: unknown, selector: string): MappedValue => {
  const parts = /^\$((?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[\d+\]))*$/.exec(selector)
  if (!parts) throw new Error('mapper_jsonpath_invalid')
  let current: unknown = value
  for (const match of selector.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g)) {
    if (match[1])
      current =
        current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>)[match[1]] : undefined
    else current = Array.isArray(current) ? current[Number(match[2])] : undefined
  }
  if (current === null || typeof current === 'string' || typeof current === 'number') return current
  return null
}

const interpolate = (template: string, secrets: Record<string, string>) => {
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (match, key: string) => {
    if (!(key in secrets)) throw new Error(`secret_template_missing:${key}`)
    return secrets[key]
  })
}

const redactResponse = (value: string, secrets: Record<string, string>) => {
  return Object.values(secrets)
    .filter(Boolean)
    .reduce((result, secret) => result.replaceAll(secret, '[REDACTED]'), value)
}

const isPrivateAddress = (address: string) => {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number)
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 100 && second >= 64 && second <= 127)
    )
  }
  const normalized = address.toLowerCase()
  const firstGroup = Number.parseInt(normalized.split(':')[0] ?? '', 16)
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) ||
    (firstGroup >= 0xff00 && firstGroup <= 0xffff) ||
    normalized.startsWith('2001:db8:')
  )
}

type SafeSourceUrl = {
  url: URL
  address?: string
  family?: 4 | 6
}

const safeUrl = async (baseUrl: string, requestPath: string): Promise<SafeSourceUrl> => {
  const url = new URL(requestPath, baseUrl)
  const localDev = process.env.NODE_ENV !== 'production' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (url.protocol !== 'https:' && !localDev) throw new Error('source_https_required')
  const allowedHosts = (process.env.SOURCE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  if (!localDev && allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('source_host_not_allowlisted')
  }
  if (!localDev) {
    const resolved = await lookup(url.hostname, { all: true })
    if (resolved.length === 0 || resolved.some(({ address }) => isPrivateAddress(address)))
      throw new Error('source_private_address_blocked')
    const target = resolved[0]
    if (!target) throw new Error('source_address_unavailable')
    const family = isIP(target.address)
    if (family !== 4 && family !== 6) throw new Error('source_address_invalid')
    return { url, address: target.address, family }
  }
  return { url }
}

const fetchSource = async (sourceUrl: SafeSourceUrl, method: string, headers: Record<string, string>, body: string | undefined) => {
  if (!sourceUrl.address || !sourceUrl.family) {
    const response = await fetch(sourceUrl.url, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(10_000) })
    return { status: response.status, content_type: response.headers.get('content-type') ?? '', raw: await response.text() }
  }

  return new Promise<{ status: number; content_type: string; raw: string }>((resolve, reject) => {
    const targetAddress = sourceUrl.address
    const targetFamily = sourceUrl.family
    if (!targetAddress || !targetFamily) throw new Error('source_address_unavailable')
    const request = httpsRequest(
      {
        protocol: sourceUrl.url.protocol,
        hostname: sourceUrl.url.hostname,
        port: sourceUrl.url.port || undefined,
        path: `${sourceUrl.url.pathname}${sourceUrl.url.search}`,
        method,
        headers,
        servername: sourceUrl.url.hostname,
        lookup: (hostname, options, callback) => callback(null, targetAddress, targetFamily),
      },
      (response) => {
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_RESPONSE_BYTES) request.destroy(new Error('source_response_too_large'))
          else chunks.push(chunk)
        })
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            content_type: String(response.headers['content-type'] ?? ''),
            raw: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    request.setTimeout(10_000, () => request.destroy(new Error('source_request_timeout')))
    request.once('error', reject)
    request.end(body)
  })
}

export const refreshUsageSource = async (sourceId: string, alreadyClaimed = false) => {
  if (!db) throw new Error('database_unavailable')
  if (!alreadyClaimed) {
    const staleClaimBefore = new Date(Date.now() - 30 * 60 * 1000)
    const [claimed] = await db
      .update(usageSources)
      .set({ status: 'refreshing', last_attempt_at: new Date() })
      .where(
        and(
          eq(usageSources.id, sourceId),
          or(
            inArray(usageSources.status, ['active', 'error']),
            and(eq(usageSources.status, 'refreshing'), lt(usageSources.last_attempt_at, staleClaimBefore)),
          ),
        ),
      )
      .returning({ id: usageSources.id })
    if (!claimed) throw new Error('source_refresh_in_progress')
  }
  const [source] = await db.select().from(usageSources).where(eq(usageSources.id, sourceId)).limit(1)
  if (!source) throw new Error('source_not_found')
  try {
    const secrets = decryptSecret(source.secret_ciphertext)
    const sourceUrl = await safeUrl(source.base_url, source.request_path)
    const headers = Object.fromEntries(
      Object.entries(source.headers as Record<string, string>).map(([key, value]) => [key, interpolate(value, secrets)]),
    )
    const body = source.body_template ? interpolate(source.body_template, secrets) : undefined
    const response = await fetchSource(sourceUrl, source.method, headers, body)
    if (response.status < 200 || response.status >= 300) throw new Error(`source_http_${response.status}`)
    if (!response.content_type.includes('json')) throw new Error('source_content_type_invalid')
    const raw = response.raw
    const parsed: unknown = JSON.parse(raw)
    const values =
      source.mapper.provider === 'soruxgpt_codex'
        ? normalizeSoruxgptCodex(parsed)
        : (Object.fromEntries(
            fields.map((field) => [field, source.mapper[field] ? jsonPath(parsed, source.mapper[field]) : null]),
          ) as Record<string, MappedValue>)
    const previous = await db
      .select({ values: sourceSnapshots.values })
      .from(sourceSnapshots)
      .where(eq(sourceSnapshots.source_id, sourceId))
      .orderBy(desc(sourceSnapshots.fetched_at))
      .limit(1)
    const historyStart = new Date()
    historyStart.setDate(historyStart.getDate() - 7)
    const history = await db
      .select({ values: sourceSnapshots.values, fetched_at: sourceSnapshots.fetched_at })
      .from(sourceSnapshots)
      .where(and(eq(sourceSnapshots.source_id, sourceId), gte(sourceSnapshots.fetched_at, historyStart)))
      .orderBy(sourceSnapshots.fetched_at)
    const persistedValues = { ...values, ...deriveUsageMetrics(values, history) }
    const changed = JSON.stringify(previous[0]?.values ?? null) !== JSON.stringify(persistedValues)
    await db.transaction(async (transaction) => {
      await transaction
        .insert(sourceSnapshots)
        .values({ source_id: sourceId, values: persistedValues, response_preview: redactResponse(raw, secrets).slice(0, 2048) })
      await transaction
        .update(usageSources)
        .set({ status: 'active', last_success_at: new Date(), last_error: null })
        .where(eq(usageSources.id, sourceId))
    })
    if (changed) await publishSourceChanges(sourceId, persistedValues)
    await evaluateAlertRules(sourceId, persistedValues)
    return persistedValues
  } catch (error) {
    const message = error instanceof Error ? error.message : 'source_refresh_failed'
    await db.update(usageSources).set({ status: 'error', last_error: message }).where(eq(usageSources.id, sourceId))
    throw error
  }
}
