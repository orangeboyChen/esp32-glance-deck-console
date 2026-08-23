'use client'

import { Alert, Block, Button, Empty, Flexbox, Input, Segmented, Tag, Text, TextArea, toast } from '@lobehub/ui'
import { KeyRound, FileJson, Play, RefreshCw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FormEvent, useEffect, useState } from 'react'

import { ConsolePageHeader } from './console-page-header'

type Source = { id: string; name: string; base_url: string; request_path: string; method: 'GET' | 'POST'; mapper: Record<string, string>; refresh_interval_seconds: number; status: string; last_success_at: string | null; last_error: string | null }
type ImportPreview = { url: string; request_path: string; method: 'GET' | 'POST'; headers: Record<string, string>; body: unknown; refresh_interval_seconds: number | null; extractor_present: boolean; extractor_target_names: string[]; secret_variable_names: string[]; mapping_required: true }

const default_mapper = '{\n  "used": "$.used",\n  "total": "$.total",\n  "unit": "$.unit"\n}'

export function SourcesManager() {
  const translate = useTranslations('Sources')
  const [sources, set_sources] = useState<Source[]>([])
  const [loading, set_loading] = useState(true)
  const [saving, set_saving] = useState(false)
  const [testing_id, set_testing_id] = useState<string | null>(null)
  const [soruxgpt_token, set_soruxgpt_token] = useState('')
  const [soruxgpt_connecting, set_soruxgpt_connecting] = useState(false)
  const [soruxgpt_error, set_soruxgpt_error] = useState<string | null>(null)
  const [import_text, set_import_text] = useState('')
  const [preview, set_preview] = useState<ImportPreview | null>(null)
  const [importing, set_importing] = useState(false)
  const [name, set_name] = useState('')
  const [base_url, set_base_url] = useState('')
  const [request_path, set_request_path] = useState('')
  const [method, set_method] = useState<'GET' | 'POST'>('GET')
  const [headers, set_headers] = useState('{}')
  const [body_template, set_body_template] = useState('')
  const [secrets, set_secrets] = useState('{}')
  const [mapper, set_mapper] = useState(default_mapper)
  const [interval, set_interval] = useState('900')
  const [error, set_error] = useState<string | null>(null)

  const load_sources = async () => {
    set_loading(true)
    try {
      const response = await fetch('/api/v1/sources', { cache: 'no-store' })
      if (!response.ok) throw new Error('source_load_failed')
      set_sources((await response.json() as { sources: Source[] }).sources)
    } catch { set_error(translate('loadFailed')) } finally { set_loading(false) }
  }
  useEffect(() => { void load_sources() }, [])

  const connect_soruxgpt = async () => {
    if (!soruxgpt_token.trim()) return
    set_soruxgpt_connecting(true)
    set_soruxgpt_error(null)
    try {
      const response = await fetch('/api/v1/sources/soruxgpt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: soruxgpt_token.trim() }) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'soruxgptConnectFailed')
      set_soruxgpt_token('')
      toast.success(translate('soruxgptConnected'))
      await load_sources()
    } catch (connection_error) {
      const code = connection_error instanceof Error ? connection_error.message : 'soruxgptConnectFailed'
      set_soruxgpt_error(translate.has(code) ? translate(code) : translate('soruxgptConnectFailed'))
    } finally { set_soruxgpt_connecting(false) }
  }

  const import_export = async () => {
    set_error(null)
    set_preview(null)
    set_importing(true)
    try {
      const exported = JSON.parse(import_text) as unknown
      const response = await fetch('/api/v1/sources/cc-switch/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(exported) })
      const payload = await response.json() as { preview?: ImportPreview; error?: string }
      if (!response.ok || !payload.preview) throw new Error(payload.error || 'cc_switch_export_invalid')
      const value = payload.preview
      set_preview(value)
      const url = new URL(value.url)
      set_base_url(url.origin)
      set_request_path(value.request_path)
      set_method(value.method)
      set_headers(JSON.stringify(value.headers, null, 2))
      set_body_template(value.body === null ? '' : JSON.stringify(value.body, null, 2))
      set_interval(String(value.refresh_interval_seconds ?? 900))
      set_secrets(JSON.stringify(Object.fromEntries(value.secret_variable_names.map((key) => [key, ''])), null, 2))
    } catch (import_error) {
      const code = import_error instanceof Error ? import_error.message : 'cc_switch_export_invalid'
      set_error(translate.has(code) ? translate(code) : translate('importFailed'))
    } finally { set_importing(false) }
  }

  const save_source = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    set_error(null)
    set_saving(true)
    try {
      const payload = { name: name.trim(), base_url, request_path, method, headers: JSON.parse(headers), body_template: body_template || undefined, secrets: JSON.parse(secrets), mapper: JSON.parse(mapper), refresh_interval_seconds: Number(interval) }
      const response = await fetch('/api/v1/sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'source_create_failed')
      toast.success(translate('sourceSaved'))
      set_name('')
      set_preview(null)
      await load_sources()
    } catch (save_error) {
      const code = save_error instanceof Error ? save_error.message : 'source_create_failed'
      set_error(translate.has(code) ? translate(code) : translate('saveFailed'))
    } finally { set_saving(false) }
  }

  const test_source = async (source_id: string) => {
    set_testing_id(source_id)
    try {
      const response = await fetch(`/api/v1/sources/${source_id}/test`, { method: 'POST' })
      if (!response.ok) throw new Error('source_test_failed')
      toast.success(translate('testSucceeded'))
      await load_sources()
    } catch { toast.error(translate('testFailed')) } finally { set_testing_id(null) }
  }

  return <main className="sources-shell">
    <ConsolePageHeader back_label={translate('back')} eyebrow={translate('eyebrow')} icon={FileJson} language_label={translate('language')} subtitle={translate('subtitle')} title={translate('title')} />

    <section className="sources-section" aria-labelledby="soruxgpt-heading">
      <h2 id="soruxgpt-heading">{translate('soruxgptTitle')}</h2>
      <Text type="secondary">{translate('soruxgptDescription')}</Text>
      <Block className="source-form" variant="outlined">
        <label htmlFor="soruxgpt-token">{translate('soruxgptToken')}</label>
        <Input autoComplete="off" id="soruxgpt-token" placeholder={translate('soruxgptTokenPlaceholder')} type="password" value={soruxgpt_token} onChange={(event) => set_soruxgpt_token(event.target.value)} />
        <Text type="secondary">{translate('soruxgptSecurity')}</Text>
        {soruxgpt_error && <Text className="enrollment-error" role="alert" type="danger">{soruxgpt_error}</Text>}
        <Button disabled={!soruxgpt_token.trim()} icon={KeyRound} loading={soruxgpt_connecting} onClick={() => void connect_soruxgpt()} size="large" type="primary">{translate('connectSoruxgpt')}</Button>
      </Block>
    </section>

    <section className="sources-section" aria-labelledby="sources-heading">
      <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={12}><h2 id="sources-heading">{translate('savedSources')}</h2><Button icon={RefreshCw} onClick={() => void load_sources()}>{translate('refresh')}</Button></Flexbox>
      {loading ? <Text>{translate('loading')}</Text> : sources.length === 0 ? <Empty className="empty-state" emoji="◌" title={translate('noSources')} description={translate('noSourcesDescription')} /> : <Flexbox gap={10}>{sources.map((source) => <Block className="source-row" key={source.id} variant="outlined"><Flexbox gap={3}><Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={8}><h3>{source.name}</h3><Tag>{source.status}</Tag></Flexbox><Text type="secondary">{source.method} {source.base_url}{source.request_path}</Text><Text type="secondary">{translate('cadence', { seconds: source.refresh_interval_seconds })}</Text>{source.last_error && <Text type="danger">{source.last_error}</Text>}</Flexbox><Button icon={Play} loading={testing_id === source.id} onClick={() => void test_source(source.id)} size="large">{translate('test')}</Button></Block>)}</Flexbox>}
    </section>

    <section className="sources-section" aria-labelledby="import-heading">
      <h2 id="import-heading">{translate('importTitle')}</h2><Text type="secondary">{translate('importDescription')}</Text>
      <TextArea aria-label={translate('importTitle')} placeholder={translate('importPlaceholder')} rows={8} value={import_text} onChange={(event) => set_import_text(event.target.value)} />
      <Button disabled={!import_text.trim()} icon={FileJson} loading={importing} onClick={() => void import_export()} size="large">{translate('reviewImport')}</Button>
      {preview && <Alert showIcon type="info" message={translate('importReview')} description={<Flexbox gap={4}><Text>{preview.method} {preview.url}</Text><Text>{translate('extractorTargets', { targets: preview.extractor_target_names.join(', ') || translate('none') })}</Text><Text>{translate('secretNames', { names: preview.secret_variable_names.join(', ') || translate('none') })}</Text><Text>{translate('mappingRequired')}</Text></Flexbox>} />}
    </section>

    <section className="sources-section" aria-labelledby="new-source-heading"><h2 id="new-source-heading">{translate('newSource')}</h2><Text type="secondary">{translate('newSourceDescription')}</Text>
      <form className="source-form source-form-grid" onSubmit={save_source}>
        <div className="form-field"><label htmlFor="source-name">{translate('name')}</label><Input id="source-name" required value={name} onChange={(event) => set_name(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="source-url">{translate('baseUrl')}</label><Input id="source-url" required type="url" value={base_url} onChange={(event) => set_base_url(event.target.value)} /></div>
        <div className="form-field form-field-wide"><label htmlFor="source-path">{translate('requestPath')}</label><Input id="source-path" required value={request_path} onChange={(event) => set_request_path(event.target.value)} /></div>
        <div className="form-field"><label>{translate('method')}</label><Segmented options={[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }]} value={method} onChange={(value) => set_method(value as 'GET' | 'POST')} /></div>
        <div className="form-field"><label htmlFor="source-interval">{translate('interval')}</label><Input id="source-interval" min={60} max={86400} required type="number" value={interval} onChange={(event) => set_interval(event.target.value)} /></div>
        <div className="form-field form-field-wide"><label htmlFor="source-headers">{translate('headers')}</label><TextArea id="source-headers" rows={4} value={headers} onChange={(event) => set_headers(event.target.value)} /></div>
        <div className="form-field form-field-wide"><label htmlFor="source-body">{translate('body')}</label><TextArea id="source-body" rows={4} value={body_template} onChange={(event) => set_body_template(event.target.value)} /></div>
        <div className="form-field form-field-wide"><label htmlFor="source-secrets">{translate('secrets')}</label><TextArea id="source-secrets" rows={4} value={secrets} onChange={(event) => set_secrets(event.target.value)} /></div>
        <div className="form-field form-field-wide"><label htmlFor="source-mapper">{translate('mapper')}</label><TextArea id="source-mapper" required rows={6} value={mapper} onChange={(event) => set_mapper(event.target.value)} /></div>
        {error && <Text className="enrollment-error form-action" role="alert" type="danger">{error}</Text>}<Button className="form-action" htmlType="submit" icon={Save} loading={saving} size="large" type="primary">{translate('save')}</Button>
      </form>
    </section>
  </main>
}
