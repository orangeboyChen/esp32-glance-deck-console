type UsageValue = string | number | null

export type UsageSnapshot = {
  fetched_at: Date
  values: Record<string, UsageValue>
}

export type DerivedUsage = {
  today_used: number | null
  today_percent: number | null
  week_used: number | null
  week_percent: number | null
}

const startOfDay = (now: Date) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start
}

const startOfWeek = (now: Date) => {
  const start = startOfDay(now)
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  return start
}

const numeric = (value: UsageValue) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const deltaSince = (snapshots: UsageSnapshot[], boundary: Date, currentUsed: number) => {
  const baseline = snapshots.find((snapshot) => snapshot.fetched_at >= boundary)
  const baselineUsed = baseline ? numeric(baseline.values.used) : null
  if (baselineUsed === null || currentUsed < baselineUsed) return null
  return currentUsed - baselineUsed
}

export const deriveUsageMetrics = (current: Record<string, UsageValue>, snapshots: UsageSnapshot[], now = new Date()): DerivedUsage => {
  const currentUsed = numeric(current.used)
  const total = numeric(current.total)
  if (currentUsed === null) {
    return { today_used: null, today_percent: null, week_used: null, week_percent: null }
  }

  const todayUsed = deltaSince(snapshots, startOfDay(now), currentUsed)
  const weekUsed = deltaSince(snapshots, startOfWeek(now), currentUsed)
  const percent = (value: number | null) =>
    value === null || total === null || total <= 0 ? null : Math.min(100, Math.max(0, (value / total) * 100))
  return { today_used: todayUsed, today_percent: percent(todayUsed), week_used: weekUsed, week_percent: percent(weekUsed) }
}
