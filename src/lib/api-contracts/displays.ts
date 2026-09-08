import type { JsonObject } from './common'

export type DisplayDocument = {
  title: string
  subtitle?: string
  icon?: 'usage' | 'battery' | 'wifi' | 'system' | 'home'
  progress?: { value: number | string; max: number | string; label?: string; unit?: string }
  progresses?: Array<{ value: number | string; max: number | string; label?: string; unit?: string }>
  usage_details?: Array<{ remaining?: string; resets_at?: string }>
  lines?: Array<{ label: string; value: string }>
}
export type DisplayPage = { page_id: string; document: DisplayDocument }
export type PageProviderType = 'soruxgpt' | 'codex' | 'system' | 'custom'
export type PageTemplate = {
  id: string
  provider_type: PageProviderType
  name: string
  description: string
  requires_source: boolean
  default_document: DisplayDocument
}
export type PageDefinition = {
  id: string
  page_id: string
  name: string
  provider_type: PageProviderType
  template_id: string
  source_id: string | null
  document_template: DisplayDocument
  created_at: string
  updated_at: string
}
export type ListPageDefinitionsResponse = { pages: PageDefinition[] }
export type PageDefinitionRequest = {
  page_id: string
  name: string
  provider_type: PageProviderType
  template_id: string
  source_id?: string | null
  document_template: DisplayDocument
}
export type ReleaseRequest = { active_page_id: string; pages: DisplayPage[]; device_ids: string[] }
export type ListReleasesResponse = { releases: Array<{ id: string; version: number; page_id: string; created_at: string }> }
export type PreviewReleaseResponse = { preview_svg: string; width: number; height: number }
export type PublishReleaseResponse = { release: JsonObject; failed_devices: string[] }
export type DisplaySourceSnapshot = { values: JsonObject; fetched_at: string; source_name: string; mapper: JsonObject }
export type DisplayResponse = {
  release_id: string
  version: number
  page_id: string
  document: DisplayDocument
  image_format: string
  image_width: number
  image_height: number
  content_sha256: string
  created_at: string
  image_bytes: number
  source: DisplaySourceSnapshot | null
  stale: boolean
}
export type DisplayBinding = {
  id: string
  source_id: string
  page_id: string
  document_template: DisplayDocument
  device_ids: string[]
  created_at: string
}
export type ListDisplayBindingsResponse = { bindings: DisplayBinding[] }
export type CreateDisplayBindingResponse = { binding: DisplayBinding }
