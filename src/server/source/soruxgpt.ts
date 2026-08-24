type MappedValue = string | number | null

export const normalizeSoruxgptToken = (value: string) => {
  return value
    .trim()
    .replace(/^Bearer\s+/i, '')
    .trim()
}

export const publicSoruxgptSource = (source: { id: string; name: string }) => {
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

const record = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

const numberValue = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const stringValue = (value: unknown) => {
  return typeof value === 'string' && value.length > 0 ? value : null
}

const formatUsageValue = (value: number, divisor: number) => {
  return Math.round((value / divisor) * 1000) / 1000
}

export const normalizeSoruxgptCodex = (value: unknown, now = new Date()): Record<string, MappedValue> => {
  const response = record(value)
  const limits: NormalizedSoruxUsageLimit[] = []
  if (Array.isArray(response?.usage_limits)) {
    for (const rawLimit of response.usage_limits) {
      const limit = record(rawLimit) as SoruxUsageLimit | null
      const current = numberValue(limit?.current_usage)
      const maximum = numberValue(limit?.limit_value)
      if (limit && current !== null && maximum !== null && current >= 0 && maximum > 0) {
        limits.push({ ...limit, current, limit: maximum })
      }
    }
  }
  const activeLimits = limits.filter((item) => {
    const expiresAt = stringValue(item.expires_at)
    if (!expiresAt) {
      return true
    }
    const expiresAtMs = Date.parse(expiresAt)
    return Number.isFinite(expiresAtMs) && expiresAtMs > now.getTime()
  })
  if (!activeLimits.length) {
    throw new Error('soruxgpt_usage_limits_missing')
  }

  const limitTypes = new Set(activeLimits.map((item) => stringValue(item.limit_type)?.toLowerCase() ?? 'units'))
  if (limitTypes.size !== 1) {
    throw new Error('soruxgpt_usage_limits_mixed_units')
  }
  const used = activeLimits.reduce((total, item) => total + item.current, 0)
  const total = activeLimits.reduce((sum, item) => sum + item.limit, 0)
  const limitType = [...limitTypes][0] ?? 'units'
  const currency = limitType === 'usd'
  const divisor = currency ? 1_000_000 : 1
  const unit = currency ? 'USD' : (limitType?.toUpperCase() ?? 'units')
  const resetsAt =
    activeLimits
      .map((item) => stringValue(item.next_available_at) ?? stringValue(item.expires_at))
      .map((resetValue) => ({ value: resetValue, timestamp: resetValue ? Date.parse(resetValue) : Number.NaN }))
      .filter((item): item is { value: string; timestamp: number } => item.value !== null && Number.isFinite(item.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp)[0]?.value ?? null
  return {
    plan_name: stringValue(response?.display_name) ? `SoruxGPT ${response?.display_name}` : 'SoruxGPT Codex',
    used: formatUsageValue(used, divisor),
    remaining: formatUsageValue(Math.max(0, total - used), divisor),
    total: formatUsageValue(total, divisor),
    unit,
    resets_at: resetsAt,
    status: `${activeLimits.length} active quota windows`,
  }
}
