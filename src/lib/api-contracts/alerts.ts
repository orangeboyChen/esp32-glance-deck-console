export type AlertRule = {
  id: string
  name: string
  source_id: string
  source_name?: string
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains'
  threshold: string
  device_ids: string[]
  page_ids: string[]
  severity: 'info' | 'warning' | 'critical'
  message: string
  test_only: boolean
  enabled: boolean
  active: boolean
  created_at: string
}
export type AlertCreateRequest = {
  name: string
  source_id: string
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains'
  threshold: string
  device_ids: string[]
  page_ids: string[]
  severity: 'info' | 'warning' | 'critical'
  message: string
  test_only: boolean
  enabled: boolean
}
export type ListAlertsResponse = { rules: AlertRule[] }
export type CreateAlertResponse = { rule: AlertRule }
export type DeleteAlertResponse = { rule: Pick<AlertRule, 'id'> }
