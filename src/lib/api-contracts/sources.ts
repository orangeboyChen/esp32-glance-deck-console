import type { JsonValue } from './common'

export type Source = {
  id: string
  name: string
  base_url: string
  request_path: string
  method: 'GET' | 'POST'
  mapper: Record<string, string>
  refresh_interval_seconds: number
  status: string
  last_success_at: string | null
  last_error: string | null
}
export type ImportPreview = {
  url: string
  request_path: string
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body: JsonValue
  refresh_interval_seconds: number | null
  extractor_present: boolean
  extractor_target_names: string[]
  secret_variable_names: string[]
  mapping_required: true
}
export type SourceCreateRequest = {
  name: string
  base_url: string
  request_path: string
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body_template?: string
  secrets: Record<string, string>
  mapper: Record<string, string>
  refresh_interval_seconds: number
}
export type ConnectSoruxgptRequest = { token: string }
export type ListSourcesResponse = { sources: Source[] }
export type CreateSourceResponse = { source: Pick<Source, 'id' | 'name'> }
export type ConnectSoruxgptResponse = {
  source: Pick<Source, 'id' | 'name'>
  values?: Record<string, JsonValue>
  error?: string
  existing?: boolean
  refresh_in_progress?: boolean
}
export type PreviewCcSwitchResponse = { preview: ImportPreview }
export type TestSourceResponse = { values: Record<string, JsonValue> }
