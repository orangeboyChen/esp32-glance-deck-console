type MappedValue = string | number | null

export function normalize_soruxgpt_token(value: string) {
  return value.trim().replace(/^Bearer\s+/i, '').trim()
}

export function public_soruxgpt_source(source: { id: string; name: string }) {
  return { id: source.id, name: source.name }
}

type SoruxUsageLimit = {
  current_usage: unknown
  expires_at: unknown
  limit_type: unknown
  limit_value: unknown
  next_available_at?: unknown
  product_name?: unknown
  time_unit?: unknown
  time_value?: unknown
}

type NormalizedSoruxUsageLimit = SoruxUsageLimit & { current: number; limit: number }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function number_value(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function string_value(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function format_usage_value(value: number, divisor: number) {
  return Math.round((value / divisor) * 1000) / 1000
}

export function normalize_soruxgpt_codex(value: unknown, now = new Date()): Record<string, MappedValue> {
  const response = record(value)
  const limits: NormalizedSoruxUsageLimit[] = []
  if (Array.isArray(response?.usage_limits)) {
    for (const raw_limit of response.usage_limits) {
      const limit = record(raw_limit) as SoruxUsageLimit | null
      const current = number_value(limit?.current_usage)
      const maximum = number_value(limit?.limit_value)
      if (limit && current !== null && maximum !== null && current >= 0 && maximum > 0) limits.push({ ...limit, current, limit: maximum })
    }
  }
  const active_limits = limits.filter((item) => {
    const expires_at = string_value(item.expires_at)
    if (!expires_at) return true
    const expires_at_ms = Date.parse(expires_at)
    return Number.isFinite(expires_at_ms) && expires_at_ms > now.getTime()
  })
  if (!active_limits.length) throw new Error('soruxgpt_usage_limits_missing')

  const limit_types = new Set(active_limits.map((item) => string_value(item.limit_type)?.toLowerCase() ?? 'units'))
  if (limit_types.size !== 1) throw new Error('soruxgpt_usage_limits_mixed_units')
  const used = active_limits.reduce((total, item) => total + item.current, 0)
  const total = active_limits.reduce((sum, item) => sum + item.limit, 0)
  const limit_type = [...limit_types][0] ?? 'units'
  const currency = limit_type === 'usd'
  const divisor = currency ? 1_000_000 : 1
  const unit = currency ? 'USD' : (limit_type?.toUpperCase() ?? 'units')
  const resets_at = active_limits
    .map((item) => string_value(item.next_available_at) ?? string_value(item.expires_at))
    .map((reset_value) => ({ value: reset_value, timestamp: reset_value ? Date.parse(reset_value) : Number.NaN }))
    .filter((item): item is { value: string; timestamp: number } => item.value !== null && Number.isFinite(item.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)[0]?.value ?? null
  return {
    plan_name: string_value(response?.display_name) ? `SoruxGPT ${response?.display_name}` : 'SoruxGPT Codex',
    used: format_usage_value(used, divisor),
    remaining: format_usage_value(Math.max(0, total - used), divisor),
    total: format_usage_value(total, divisor),
    unit,
    resets_at,
    status: `${active_limits.length} active quota windows`,
  }
}
