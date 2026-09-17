'use client'

import { Alert, Block, Empty, Flexbox, Input, Modal, Select, Tag, Text, TextArea, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { ArrowLeft, Copy, Eye, FilePlus2, Monitor, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'

import { ConsolePageHeader } from '@/app/_components/console-page-header'
import { Api } from '@/lib/api-client'
import type { DisplayDocument, PageDefinition, PageProviderType, PageTemplate } from '@/lib/api-contracts'
import { pageTemplates, providerLabels } from '@/lib/page-templates'
import { useSessionLoad } from '@/lib/use-session-load'
import {
  displayConfirmOpenAtom,
  displayDefinitionsAtom,
  displayDevicesAtom,
  displayErrorAtom,
  displayLoadingAtom,
  displayPreviewLoadingAtom,
  displayPreviewSvgAtom,
  displayPublishingAtom,
  displayReleasesAtom,
  displaySelectedDevicesAtom,
  displaySourcesAtom,
} from './state'

type View = 'library' | 'types' | 'templates' | 'configure'
type Draft = {
  page_id: string
  name: string
  provider_type: PageProviderType
  template_id: string
  source_id: string | null
  document_template: DisplayDocument
}

const systemPage: PageDefinition = {
  id: 'system',
  page_id: 'system',
  name: 'System',
  provider_type: 'system',
  template_id: 'system-firmware',
  source_id: null,
  document_template: { title: 'System', subtitle: 'Last verified page retained', icon: 'system', lines: [] },
  created_at: '',
  updated_at: '',
}
const cloneDocument = (document: DisplayDocument): DisplayDocument => JSON.parse(JSON.stringify(document)) as DisplayDocument

export const DisplayManager = () => {
  const locale = useLocale()
  const translate = useTranslations('Displays')
  const [view, setView] = useState<View>('library')
  const [selectedProvider, setSelectedProvider] = useState<PageProviderType | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useAtom(displayErrorAtom)
  // Pages and sources live in atoms rather than local state so that leaving and re-entering the tab
  // does not discard them and force a refetch.
  const [pages, setPages] = useAtom(displayDefinitionsAtom)
  const [sources, setSources] = useAtom(displaySourcesAtom)
  const [loading, setLoading] = useAtom(displayLoadingAtom)
  const [previewSvg, setPreviewSvg] = useAtom(displayPreviewSvgAtom)
  const [previewLoading, setPreviewLoading] = useAtom(displayPreviewLoadingAtom)
  const [devices, setDevices] = useAtom(displayDevicesAtom)
  const [selectedDevices, setSelectedDevices] = useAtom(displaySelectedDevicesAtom)
  const [releases, setReleases] = useAtom(displayReleasesAtom)
  const [publishing, setPublishing] = useAtom(displayPublishingAtom)
  const [confirmOpen, setConfirmOpen] = useAtom(displayConfirmOpenAtom)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pageResponse, sourceResponse, deviceResponse, releaseResponse] = await Promise.all([
        Api.listPages(),
        Api.listSources(),
        Api.listDevices(),
        Api.listReleases(),
      ])
      setPages(pageResponse.pages)
      setSources(sourceResponse.sources)
      setDevices(deviceResponse.devices)
      setReleases(releaseResponse.releases.slice(-10).reverse())
      setError(null)
      return true
    } catch {
      setError(translate('loadFailed'))
      return false
    } finally {
      setLoading(false)
    }
  }, [setDevices, setError, setLoading, setPages, setReleases, setSources, translate])
  useSessionLoad('displays', load)

  const startAdd = () => {
    setSelectedProvider(null)
    setSelectedTemplate(null)
    setDraft(null)
    setView('types')
  }
  const chooseProvider = (provider: PageProviderType) => {
    setSelectedProvider(provider)
    setView('templates')
  }
  const chooseTemplate = (template: PageTemplate) => {
    setSelectedTemplate(template)
    const nextId = `${template.id}-${pages.length + 1}`.replace(/-\d+$/, '')
    setDraft({
      page_id: nextId,
      name: template.name,
      provider_type: template.provider_type,
      template_id: template.id,
      source_id: null,
      document_template: cloneDocument(template.default_document),
    })
    setPreviewSvg(null)
    setView('configure')
  }
  const editPage = (page: PageDefinition) => {
    setSelectedTemplate(pageTemplates.find((item) => item.id === page.template_id) ?? null)
    setDraft({
      page_id: page.page_id,
      name: page.name,
      provider_type: page.provider_type,
      template_id: page.template_id,
      source_id: page.source_id,
      document_template: cloneDocument(page.document_template),
    })
    setPreviewSvg(null)
    setView('configure')
  }
  const savePage = async () => {
    if (!draft || !draft.name.trim() || (selectedTemplate?.requires_source && !draft.source_id)) {
      setError(selectedTemplate?.requires_source && !draft?.source_id ? translate('chooseSourceRequired') : translate('nameRequired'))
      return
    }
    setSaving(true)
    try {
      const response = pages.some((page) => page.page_id === draft.page_id)
        ? await Api.updatePage(draft.page_id, draft)
        : await Api.createPage(draft)
      setPages((current) =>
        current.some((page) => page.page_id === response.page.page_id)
          ? current.map((page) => (page.page_id === response.page.page_id ? response.page : page))
          : [...current, response.page],
      )
      toast.success(translate('saved'))
      setView('library')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : translate('saveFailed'))
    } finally {
      setSaving(false)
    }
  }
  const deletePage = async (pageId: string) => {
    if (pageId === 'system') {
      return
    }
    try {
      await Api.deletePage(pageId)
      setPages((current) => current.filter((page) => page.page_id !== pageId))
      toast.success(translate('deleted'))
    } catch {
      toast.error(translate('deleteFailed'))
    }
  }
  const duplicatePage = (page: PageDefinition) => {
    setSelectedTemplate(pageTemplates.find((item) => item.id === page.template_id) ?? null)
    setDraft({
      page_id: `${page.page_id}-copy`,
      name: `${page.name} copy`,
      provider_type: page.provider_type,
      template_id: page.template_id,
      source_id: page.source_id,
      document_template: cloneDocument(page.document_template),
    })
    setView('configure')
  }
  const updateDocument = (field: keyof DisplayDocument, value: string) =>
    setDraft((current) => (current ? { ...current, document_template: { ...current.document_template, [field]: value } } : current))
  const refreshPreview = async () => {
    if (!draft?.document_template.title.trim()) {
      return setError(translate('titleRequired'))
    }
    setPreviewLoading(true)
    setError(null)
    try {
      const response = await Api.previewRelease(draft.document_template)
      setPreviewSvg(response.preview_svg)
    } catch {
      setError(translate('previewFailed'))
    } finally {
      setPreviewLoading(false)
    }
  }
  const publish = async () => {
    if (!selectedDevices.length) {
      return
    }
    setPublishing(true)
    try {
      pages.forEach((page) => {
        if (page.source_id && !sources.find((source) => source.id === page.source_id)?.last_success_at) {
          throw new Error('source_not_verified')
        }
      })
      const publishPages = [systemPage, ...pages]
        .filter((page, index, all) => all.findIndex((item) => item.page_id === page.page_id) === index)
        .slice(0, 10)
      const response = await Api.publishRelease({
        active_page_id: publishPages[0]?.page_id ?? 'system',
        pages: publishPages.map((page) => ({ page_id: page.page_id, document: page.document_template })),
        device_ids: selectedDevices,
      })
      toast.success(response.failed_devices.length ? translate('publishedPartial') : translate('published'))
      setConfirmOpen(false)
      await load()
    } catch {
      toast.error(translate('publishFailed'))
    } finally {
      setPublishing(false)
    }
  }

  const visibleTemplates = useMemo(
    () => pageTemplates.filter((template) => template.provider_type === selectedProvider),
    [selectedProvider],
  )
  const providerTypes = [...new Set(pageTemplates.map((template) => template.provider_type))]

  return (
    <main className="sources-shell page-library-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={Monitor}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
        actions={
          <Flexbox horizontal align="center" gap={10}>
            <Button icon={RefreshCw} loading={loading} onClick={() => void load()}>
              {translate('refresh')}
            </Button>
            <Button icon={Plus} onClick={startAdd} type="primary">
              {translate('addPage')}
            </Button>
          </Flexbox>
        }
      />
      <div className="page-workspace-tabs" role="tablist" aria-label={translate('sections')}>
        <Button type={view === 'library' ? 'primary' : 'text'} onClick={() => setView('library')}>
          {translate('library')}
        </Button>
        <Button type={view !== 'library' ? 'primary' : 'text'} onClick={startAdd}>
          {translate('addPage')}
        </Button>
        <Button type="text" onClick={() => toast.info(translate('sourceBindingsToast'))}>
          {translate('sourceBindings')}
        </Button>
        <Button type="text" onClick={() => toast.info(translate('releaseHistoryToast'))}>
          {translate('releaseHistory')}
        </Button>
      </div>
      {error && <Alert className="page-alert" showIcon type="error" title={error} />}
      {view === 'library' && (
        <>
          <Flexbox className="page-library-toolbar" horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
            <Text type="secondary">{translate('libraryHelp')}</Text>
            <Tag>{translate('pageCount', { count: pages.length + 1 })}</Tag>
          </Flexbox>
          {loading ? (
            <Text>{translate('loading')}</Text>
          ) : pages.length === 0 ? (
            <Empty
              className="empty-state"
              emoji="▧"
              title={translate('emptyTitle')}
              description={translate('emptyDescription')}
              action={
                <Button icon={FilePlus2} onClick={startAdd} type="primary">
                  {translate('addFirstPage')}
                </Button>
              }
            />
          ) : (
            <div className="page-definition-grid">
              {[systemPage, ...pages].map((page) => (
                <Block className="page-definition-card" key={page.page_id} variant="outlined">
                  <div className="page-card-preview">
                    <div className="page-card-screen">
                      <strong>{page.document_template.title}</strong>
                      <span>{page.document_template.subtitle}</span>
                    </div>
                  </div>
                  <Flexbox gap={6}>
                    <Flexbox horizontal align="center" justify="space-between">
                      <h3>{page.name}</h3>
                      <Tag>{providerLabels[page.provider_type]}</Tag>
                    </Flexbox>
                    <Text type="secondary">
                      {page.source_id
                        ? (sources.find((source) => source.id === page.source_id)?.name ?? translate('savedSource'))
                        : translate('builtInTemplate')}
                    </Text>
                  </Flexbox>
                  <Flexbox horizontal gap={8} wrap="wrap">
                    <Button icon={Pencil} onClick={() => editPage(page)}>
                      {translate('edit')}
                    </Button>
                    {page.page_id !== 'system' && (
                      <>
                        <Button icon={Copy} onClick={() => duplicatePage(page)}>
                          {translate('copy')}
                        </Button>
                        <Button icon={Trash2} onClick={() => void deletePage(page.page_id)} type="text">
                          {translate('delete')}
                        </Button>
                      </>
                    )}
                  </Flexbox>
                </Block>
              ))}
            </div>
          )}
          <section className="sources-section page-publish-section">
            <h2>{translate('publishToDevices')}</h2>
            <Text type="secondary">{translate('publishLimitHelp')}</Text>
            {devices.length === 0 ? (
              <Text type="secondary">{translate('noDevices')}</Text>
            ) : (
              devices.map((device) => (
                <Flexbox className="firmware-device-row" horizontal align="center" justify="space-between" key={device.id}>
                  <label>
                    <input
                      checked={selectedDevices.includes(device.id)}
                      type="checkbox"
                      onChange={(event) =>
                        setSelectedDevices(
                          event.target.checked ? [...selectedDevices, device.id] : selectedDevices.filter((id) => id !== device.id),
                        )
                      }
                    />{' '}
                    {device.name}
                  </label>
                  <Text type="secondary">{device.status}</Text>
                </Flexbox>
              ))
            )}
            <Button
              disabled={!selectedDevices.length || pages.length + 1 > 10}
              icon={Send}
              onClick={() => setConfirmOpen(true)}
              size="large"
              type="primary"
            >
              {translate('publishPages')}
            </Button>
          </section>
          <section className="sources-section">
            <h2>{translate('releaseHistory')}</h2>
            {releases.length ? (
              releases.map((release) => (
                <Flexbox className="firmware-device-row" horizontal justify="space-between" key={release.id}>
                  <Text>{translate('releaseVersion', { version: release.version, page: release.page_id })}</Text>
                  <Text type="secondary">{new Date(release.created_at).toLocaleString(locale)}</Text>
                </Flexbox>
              ))
            ) : (
              <Text type="secondary">{translate('noHistory')}</Text>
            )}
          </section>
        </>
      )}
      {view === 'types' && (
        <section className="page-flow">
          <div className="page-flow-heading">
            <Text className="eyebrow">{translate('step', { step: 1 })}</Text>
            <h2>{translate('chooseTypeTitle')}</h2>
            <Text type="secondary">{translate('chooseTypeHelp')}</Text>
          </div>
          <div className="page-type-grid">
            {providerTypes.map((provider) => (
              <Block className="page-type-card" key={provider} onClick={() => chooseProvider(provider)} variant="outlined">
                <h3>{providerLabels[provider]}</h3>
                <Text type="secondary">
                  {translate('templateCount', { count: pageTemplates.filter((template) => template.provider_type === provider).length })}
                </Text>
                <Button type="primary">{translate('choose')}</Button>
              </Block>
            ))}
          </div>
        </section>
      )}
      {view === 'templates' && (
        <section className="page-flow">
          <Button icon={ArrowLeft} onClick={() => setView('types')} type="text">
            {translate('backToTypes')}
          </Button>
          <div className="page-flow-heading">
            <Text className="eyebrow">
              {translate('step', { step: 2 })} · {selectedProvider && providerLabels[selectedProvider]}
            </Text>
            <h2>{translate('chooseTemplateTitle')}</h2>
          </div>
          <div className="page-template-list">
            {visibleTemplates.map((template) => (
              <Block className="page-template-card" key={template.id} variant="outlined">
                <Flexbox gap={5}>
                  <Flexbox horizontal align="center" gap={8}>
                    <h3>{template.name}</h3>
                    {template.id.endsWith('token-usage') && <Tag color="green">{translate('recommended')}</Tag>}
                  </Flexbox>
                  <Text type="secondary">{template.description}</Text>
                </Flexbox>
                <Button onClick={() => chooseTemplate(template)} type="primary">
                  {translate('select')}
                </Button>
              </Block>
            ))}
          </div>
        </section>
      )}
      {view === 'configure' && draft && (
        <section className="page-flow">
          <Flexbox horizontal align="center" justify="space-between" wrap="wrap">
            <Button icon={ArrowLeft} onClick={() => setView('templates')} type="text">
              {translate('backToTemplates')}
            </Button>
            <Flexbox horizontal gap={8}>
              <Button
                disabled={!draft.document_template.title.trim()}
                icon={Eye}
                loading={previewLoading}
                onClick={() => void refreshPreview()}
              >
                {translate('refreshPreview')}
              </Button>
              <Button icon={Plus} loading={saving} onClick={() => void savePage()} type="primary">
                {pages.some((page) => page.page_id === draft.page_id) ? translate('savePage') : translate('createPage')}
              </Button>
            </Flexbox>
          </Flexbox>
          <div className="display-editor-grid page-config-grid">
            <Block className="display-editor" variant="outlined">
              <Text className="eyebrow">
                {translate('step', { step: 3 })} · {selectedTemplate?.name}
              </Text>
              <h2>{translate('configureTitle')}</h2>
              <label htmlFor="page-name">{translate('pageName')}</label>
              <Input id="page-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <label htmlFor="page-id">{translate('pageId')}</label>
              <Input
                id="page-id"
                value={draft.page_id}
                disabled={pages.some((page) => page.page_id === draft.page_id)}
                onChange={(event) => setDraft({ ...draft, page_id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              />
              {selectedTemplate?.requires_source && (
                <>
                  <label htmlFor="page-source">{translate('savedDataSource')}</label>
                  <Select
                    id="page-source"
                    placeholder={translate('chooseSavedSource')}
                    options={sources.map((source) => ({ label: source.name, value: source.id }))}
                    value={draft.source_id ?? undefined}
                    onChange={(value) => setDraft({ ...draft, source_id: String(value) })}
                  />
                  <Text type="secondary">{translate('sourceEncryptionHelp')}</Text>
                </>
              )}
              <label htmlFor="page-title">{translate('displayTitle')}</label>
              <Input
                id="page-title"
                value={draft.document_template.title}
                onChange={(event) => updateDocument('title', event.target.value)}
              />
              <label htmlFor="page-subtitle">{translate('displaySubtitle')}</label>
              <Input
                id="page-subtitle"
                value={draft.document_template.subtitle ?? ''}
                onChange={(event) => updateDocument('subtitle', event.target.value)}
              />
              <label htmlFor="page-lines">{translate('displayLines')}</label>
              <TextArea
                id="page-lines"
                rows={6}
                value={JSON.stringify(draft.document_template.lines ?? [], null, 2)}
                onChange={(event) => {
                  try {
                    const lines = JSON.parse(event.target.value)
                    if (Array.isArray(lines)) {
                      setDraft({ ...draft, document_template: { ...draft.document_template, lines } })
                    }
                  } catch {
                    /* keep last valid value */
                  }
                }}
              />
            </Block>
            <Block className="display-preview-card" variant="outlined">
              <h2>{translate('devicePreview')}</h2>
              {previewSvg ? (
                <img
                  alt={translate('previewAlt')}
                  className="display-editor-preview"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
                />
              ) : (
                <Empty emoji="▧" title={translate('previewEmpty')} description={translate('previewEmptyDescription')} />
              )}
            </Block>
          </div>
        </section>
      )}
      <Modal
        open={confirmOpen}
        title={translate('publishConfirmTitle')}
        okText={translate('publish')}
        okButtonProps={{ loading: publishing }}
        cancelText={translate('cancel')}
        onCancel={() => !publishing && setConfirmOpen(false)}
        onOk={() => void publish()}
      >
        <Text>{translate('publishConfirmBody', { pageCount: pages.length + 1, deviceCount: selectedDevices.length })}</Text>
      </Modal>
    </main>
  )
}
