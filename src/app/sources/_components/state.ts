import { atom } from 'jotai'

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
  body: unknown
  refresh_interval_seconds: number | null
  extractor_present: boolean
  extractor_target_names: string[]
  secret_variable_names: string[]
  mapping_required: true
}

export const defaultMapper = '{\n  "used": "$.used",\n  "total": "$.total",\n  "unit": "$.unit"\n}'

export const sourcesAtom = atom<Source[]>([])
export const sourcesLoadingAtom = atom(true)
export const sourcesSavingAtom = atom(false)
export const sourceTestingIdAtom = atom<string | null>(null)
export const soruxgptTokenAtom = atom('')
export const soruxgptConnectingAtom = atom(false)
export const soruxgptErrorAtom = atom<string | null>(null)
export const sourceImportTextAtom = atom('')
export const sourceImportPreviewAtom = atom<ImportPreview | null>(null)
export const sourceImportingAtom = atom(false)
export const sourceNameAtom = atom('')
export const sourceBaseUrlAtom = atom('')
export const sourceRequestPathAtom = atom('')
export const sourceMethodAtom = atom<'GET' | 'POST'>('GET')
export const sourceHeadersAtom = atom('{}')
export const sourceBodyTemplateAtom = atom('')
export const sourceSecretsAtom = atom('{}')
export const sourceMapperAtom = atom(defaultMapper)
export const sourceIntervalAtom = atom('900')
export const sourcesErrorAtom = atom<string | null>(null)
