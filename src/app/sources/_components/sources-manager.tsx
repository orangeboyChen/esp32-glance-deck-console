'use client'

import { Alert, Block, Empty, Flexbox, Input, Segmented, Tag, Text, TextArea, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { KeyRound, FileJson, Play, RefreshCw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import { useCallback, useEffect } from 'react'

import { ConsolePageHeader } from '@/app/_components/console-page-header'

import {
  sourceBaseUrlAtom,
  sourceBodyTemplateAtom,
  sourceHeadersAtom,
  sourceImportPreviewAtom,
  sourceImportTextAtom,
  sourceImportingAtom,
  sourceIntervalAtom,
  sourceMapperAtom,
  sourceMethodAtom,
  sourceNameAtom,
  sourceRequestPathAtom,
  sourceSecretsAtom,
  sourceTestingIdAtom,
  sourcesAtom,
  sourcesErrorAtom,
  sourcesLoadingAtom,
  sourcesSavingAtom,
  soruxgptConnectingAtom,
  soruxgptErrorAtom,
  soruxgptTokenAtom,
  type ImportPreview,
  type Source,
} from '@/app/sources/_components/state'

export const SourcesManager = () => {
  const translate = useTranslations('Sources')
  const [sources, setSources] = useAtom(sourcesAtom)
  const [loading, setLoading] = useAtom(sourcesLoadingAtom)
  const [saving, setSaving] = useAtom(sourcesSavingAtom)
  const [testingId, setTestingId] = useAtom(sourceTestingIdAtom)
  const [soruxgptToken, setSoruxgptToken] = useAtom(soruxgptTokenAtom)
  const [soruxgptConnecting, setSoruxgptConnecting] = useAtom(soruxgptConnectingAtom)
  const [soruxgptError, setSoruxgptError] = useAtom(soruxgptErrorAtom)
  const [importText, setImportText] = useAtom(sourceImportTextAtom)
  const [preview, setPreview] = useAtom(sourceImportPreviewAtom)
  const [importing, setImporting] = useAtom(sourceImportingAtom)
  const [name, setName] = useAtom(sourceNameAtom)
  const [baseUrl, setBaseUrl] = useAtom(sourceBaseUrlAtom)
  const [requestPath, setRequestPath] = useAtom(sourceRequestPathAtom)
  const [method, setMethod] = useAtom(sourceMethodAtom)
  const [headers, setHeaders] = useAtom(sourceHeadersAtom)
  const [bodyTemplate, setBodyTemplate] = useAtom(sourceBodyTemplateAtom)
  const [secrets, setSecrets] = useAtom(sourceSecretsAtom)
  const [mapper, setMapper] = useAtom(sourceMapperAtom)
  const [interval, setInterval] = useAtom(sourceIntervalAtom)
  const [error, setError] = useAtom(sourcesErrorAtom)

  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/sources', { cache: 'no-store' })
      if (!response.ok) throw new Error('source_load_failed')
      setSources(((await response.json()) as { sources: Source[] }).sources)
    } catch {
      setError(translate('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [translate, setError, setLoading, setSources])
  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const connectSoruxgpt = async () => {
    if (!soruxgptToken.trim()) return
    setSoruxgptConnecting(true)
    setSoruxgptError(null)
    try {
      const response = await fetch('/api/v1/sources/soruxgpt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: soruxgptToken.trim() }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'soruxgptConnectFailed')
      setSoruxgptToken('')
      toast.success(translate('soruxgptConnected'))
      await loadSources()
    } catch (connectionError) {
      const code = connectionError instanceof Error ? connectionError.message : 'soruxgptConnectFailed'
      setSoruxgptError(translate.has(code) ? translate(code) : translate('soruxgptConnectFailed'))
    } finally {
      setSoruxgptConnecting(false)
    }
  }

  const importExport = async () => {
    setError(null)
    setPreview(null)
    setImporting(true)
    try {
      const exported = JSON.parse(importText) as unknown
      const response = await fetch('/api/v1/sources/cc-switch/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(exported),
      })
      const payload = (await response.json()) as { preview?: ImportPreview; error?: string }
      if (!response.ok || !payload.preview) throw new Error(payload.error || 'cc_switch_export_invalid')
      const value = payload.preview
      setPreview(value)
      const url = new URL(value.url)
      setBaseUrl(url.origin)
      setRequestPath(value.request_path)
      setMethod(value.method)
      setHeaders(JSON.stringify(value.headers, null, 2))
      setBodyTemplate(value.body === null ? '' : JSON.stringify(value.body, null, 2))
      setInterval(String(value.refresh_interval_seconds ?? 900))
      setSecrets(JSON.stringify(Object.fromEntries(value.secret_variable_names.map((key) => [key, ''])), null, 2))
    } catch (importError) {
      const code = importError instanceof Error ? importError.message : 'cc_switch_export_invalid'
      setError(translate.has(code) ? translate(code) : translate('importFailed'))
    } finally {
      setImporting(false)
    }
  }

  const saveSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        base_url: baseUrl,
        request_path: requestPath,
        method,
        headers: JSON.parse(headers),
        body_template: bodyTemplate || undefined,
        secrets: JSON.parse(secrets),
        mapper: JSON.parse(mapper),
        refresh_interval_seconds: Number(interval),
      }
      const response = await fetch('/api/v1/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'source_create_failed')
      toast.success(translate('sourceSaved'))
      setName('')
      setPreview(null)
      await loadSources()
    } catch (saveError) {
      const code = saveError instanceof Error ? saveError.message : 'source_create_failed'
      setError(translate.has(code) ? translate(code) : translate('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const testSource = async (sourceId: string) => {
    setTestingId(sourceId)
    try {
      const response = await fetch(`/api/v1/sources/${sourceId}/test`, { method: 'POST' })
      if (!response.ok) throw new Error('source_test_failed')
      toast.success(translate('testSucceeded'))
      await loadSources()
    } catch {
      toast.error(translate('testFailed'))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <main className="sources-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={FileJson}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />

      <section className="sources-section" aria-labelledby="soruxgpt-heading">
        <h2 id="soruxgpt-heading">{translate('soruxgptTitle')}</h2>
        <Text type="secondary">{translate('soruxgptDescription')}</Text>
        <Block className="source-form" variant="outlined">
          <label htmlFor="soruxgpt-token">{translate('soruxgptToken')}</label>
          <Input
            autoComplete="off"
            id="soruxgpt-token"
            placeholder={translate('soruxgptTokenPlaceholder')}
            type="password"
            value={soruxgptToken}
            onChange={(event) => setSoruxgptToken(event.target.value)}
          />
          <Text type="secondary">{translate('soruxgptSecurity')}</Text>
          {soruxgptError && (
            <Text className="enrollment-error" role="alert" type="danger">
              {soruxgptError}
            </Text>
          )}
          <Button
            disabled={!soruxgptToken.trim()}
            icon={KeyRound}
            loading={soruxgptConnecting}
            onClick={() => void connectSoruxgpt()}
            size="large"
            type="primary"
          >
            {translate('connectSoruxgpt')}
          </Button>
        </Block>
      </section>

      <section className="sources-section" aria-labelledby="sources-heading">
        <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
          <h2 id="sources-heading">{translate('savedSources')}</h2>
          <Button icon={RefreshCw} onClick={() => void loadSources()}>
            {translate('refresh')}
          </Button>
        </Flexbox>
        {loading ? (
          <Text>{translate('loading')}</Text>
        ) : sources.length === 0 ? (
          <Empty className="empty-state" emoji="◌" title={translate('noSources')} description={translate('noSourcesDescription')} />
        ) : (
          <Flexbox gap={10}>
            {sources.map((source) => (
              <Block className="source-row" key={source.id} variant="outlined">
                <Flexbox gap={3}>
                  <Flexbox horizontal align="center" justify="space-between" wrap="wrap" gap={8}>
                    <h3>{source.name}</h3>
                    <Tag>{source.status}</Tag>
                  </Flexbox>
                  <Text type="secondary">
                    {source.method} {source.base_url}
                    {source.request_path}
                  </Text>
                  <Text type="secondary">{translate('cadence', { seconds: source.refresh_interval_seconds })}</Text>
                  {source.last_error && <Text type="danger">{source.last_error}</Text>}
                </Flexbox>
                <Button icon={Play} loading={testingId === source.id} onClick={() => void testSource(source.id)} size="large">
                  {translate('test')}
                </Button>
              </Block>
            ))}
          </Flexbox>
        )}
      </section>

      <section className="sources-section" aria-labelledby="import-heading">
        <h2 id="import-heading">{translate('importTitle')}</h2>
        <Text type="secondary">{translate('importDescription')}</Text>
        <TextArea
          aria-label={translate('importTitle')}
          placeholder={translate('importPlaceholder')}
          rows={8}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
        />
        <Button disabled={!importText.trim()} icon={FileJson} loading={importing} onClick={() => void importExport()} size="large">
          {translate('reviewImport')}
        </Button>
        {preview && (
          <Alert
            showIcon
            type="info"
            message={translate('importReview')}
            description={
              <Flexbox gap={4}>
                <Text>
                  {preview.method} {preview.url}
                </Text>
                <Text>{translate('extractorTargets', { targets: preview.extractor_target_names.join(', ') || translate('none') })}</Text>
                <Text>{translate('secretNames', { names: preview.secret_variable_names.join(', ') || translate('none') })}</Text>
                <Text>{translate('mappingRequired')}</Text>
              </Flexbox>
            }
          />
        )}
      </section>

      <section className="sources-section" aria-labelledby="new-source-heading">
        <h2 id="new-source-heading">{translate('newSource')}</h2>
        <Text type="secondary">{translate('newSourceDescription')}</Text>
        <form className="source-form source-form-grid" onSubmit={saveSource}>
          <div className="form-field">
            <label htmlFor="source-name">{translate('name')}</label>
            <Input id="source-name" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="source-url">{translate('baseUrl')}</label>
            <Input id="source-url" required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </div>
          <div className="form-field form-field-wide">
            <label htmlFor="source-path">{translate('requestPath')}</label>
            <Input id="source-path" required value={requestPath} onChange={(event) => setRequestPath(event.target.value)} />
          </div>
          <div className="form-field">
            <label>{translate('method')}</label>
            <Segmented
              options={[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
              ]}
              value={method}
              onChange={(value) => setMethod(value as 'GET' | 'POST')}
            />
          </div>
          <div className="form-field">
            <label htmlFor="source-interval">{translate('interval')}</label>
            <Input
              id="source-interval"
              min={60}
              max={86400}
              required
              type="number"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </div>
          <div className="form-field form-field-wide">
            <label htmlFor="source-headers">{translate('headers')}</label>
            <TextArea id="source-headers" rows={4} value={headers} onChange={(event) => setHeaders(event.target.value)} />
          </div>
          <div className="form-field form-field-wide">
            <label htmlFor="source-body">{translate('body')}</label>
            <TextArea id="source-body" rows={4} value={bodyTemplate} onChange={(event) => setBodyTemplate(event.target.value)} />
          </div>
          <div className="form-field form-field-wide">
            <label htmlFor="source-secrets">{translate('secrets')}</label>
            <TextArea id="source-secrets" rows={4} value={secrets} onChange={(event) => setSecrets(event.target.value)} />
          </div>
          <div className="form-field form-field-wide">
            <label htmlFor="source-mapper">{translate('mapper')}</label>
            <TextArea id="source-mapper" required rows={6} value={mapper} onChange={(event) => setMapper(event.target.value)} />
          </div>
          {error && (
            <Text className="enrollment-error form-action" role="alert" type="danger">
              {error}
            </Text>
          )}
          <Button className="form-action" htmlType="submit" icon={Save} loading={saving} size="large" type="primary">
            {translate('save')}
          </Button>
        </form>
      </section>
    </main>
  )
}
