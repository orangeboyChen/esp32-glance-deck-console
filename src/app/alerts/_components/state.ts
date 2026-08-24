import { atom } from 'jotai'

export type Source = { id: string; name: string }
export type Device = { id: string; name: string; active_page_id: string }
export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains'
export type AlertRule = {
  id: string
  name: string
  source_id: string
  source_name?: string
  field: string
  operator: Operator
  threshold: string
  device_ids: string[]
  page_ids: string[]
  severity: string
  message: string
  test_only: boolean
  enabled: boolean
  active: boolean
  created_at: string
}

export const alertFields = ['plan_name', 'used', 'remaining', 'total', 'unit', 'resets_at', 'status'] as const
export const alertsSourcesAtom = atom<Source[]>([])
export const alertsDevicesAtom = atom<Device[]>([])
export const alertRulesAtom = atom<AlertRule[]>([])
export const alertsLoadingAtom = atom(true)
export const alertsSavingAtom = atom(false)
export const alertsErrorAtom = atom<string | null>(null)
export const alertNameAtom = atom('')
export const alertSourceIdAtom = atom('')
export const alertFieldAtom = atom<(typeof alertFields)[number]>('used')
export const alertOperatorAtom = atom<Operator>('gte')
export const alertThresholdAtom = atom('80')
export const alertDeviceIdsAtom = atom<string[]>([])
export const alertPageIdsAtom = atom('alerts')
export const alertSeverityAtom = atom('warning')
export const alertMessageAtom = atom('')
export const alertTestOnlyAtom = atom(false)
