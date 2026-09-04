'use client'

import { Alert, Block, Empty, Flexbox, Input, Modal, Select, Tag, Text, TextArea, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { ArrowLeft, Copy, Eye, FilePlus2, Monitor, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ConsolePageHeader } from '@/app/_components/console-page-header'
import { Api } from '@/lib/api-client'
import type { DisplayDocument, PageDefinition, PageProviderType, PageTemplate, Source } from '@/lib/api-contracts'
import { pageTemplates, providerLabels } from '@/lib/page-templates'
import {
  displayConfirmOpenAtom,
  displayDevicesAtom,
  displayErrorAtom,
  displayPreviewLoadingAtom,
  displayPreviewSvgAtom,
  displayPublishingAtom,
  displayReleasesAtom,
  displaySelectedDevicesAtom,
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
  const [view, setView] = useState<View>('library')
  const [pages, setPages] = useState<PageDefinition[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [selectedProvider, setSelectedProvider] = useState<PageProviderType | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useAtom(displayErrorAtom)
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
    } catch {
      setError('Unable to load pages, sources, or devices.')
    } finally {
      setLoading(false)
    }
  }, [setDevices, setError, setReleases])
  useEffect(() => {
    void load()
  }, [load])

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
      setError(
        selectedTemplate?.requires_source && !draft?.source_id
          ? 'Choose a saved data source before creating this page.'
          : 'Add a page name before saving.',
      )
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
      toast.success('Page saved.')
      setView('library')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save page.')
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
      toast.success('Page deleted.')
    } catch {
      toast.error('Unable to delete page.')
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
      return setError('Add a page title before previewing.')
    }
    setPreviewLoading(true)
    setError(null)
    try {
      const response = await Api.previewRelease(draft.document_template)
      setPreviewSvg(response.preview_svg)
    } catch {
      setError('Unable to render the display preview.')
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
      toast.success(response.failed_devices.length ? 'Release published with device errors.' : 'Display release published.')
      setConfirmOpen(false)
      await load()
    } catch {
      toast.error('Unable to publish this display release.')
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
        backLabel="Devices"
        eyebrow="Glance Deck / Pages"
        icon={Monitor}
        languageLabel="Language"
        subtitle="Choose a provider template, configure a saved source, and publish device-accurate pages."
        title="Pages"
        actions={
          <Button icon={Plus} onClick={startAdd} type="primary">
            Add page
          </Button>
        }
      />
      <div className="page-workspace-tabs" role="tablist" aria-label="Pages sections">
        <Button type={view === 'library' ? 'primary' : 'text'} onClick={() => setView('library')}>
          Page library
        </Button>
        <Button type={view !== 'library' ? 'primary' : 'text'} onClick={startAdd}>
          Add page
        </Button>
        <Button type="text" onClick={() => toast.info('Source bindings are shown on each page card.')}>
          Source bindings
        </Button>
        <Button type="text" onClick={() => toast.info('Release history is shown below.')}>
          Release history
        </Button>
      </div>
      {error && <Alert className="page-alert" showIcon type="error" message={error} />}
      {view === 'library' && (
        <>
          <Flexbox className="page-library-toolbar" horizontal align="center" justify="space-between" wrap="wrap" gap={12}>
            <Text type="secondary">Reusable display definitions backed by saved data sources.</Text>
            <Tag>{pages.length + 1} / 10 pages</Tag>
          </Flexbox>
          {loading ? (
            <Text>Loading pages…</Text>
          ) : pages.length === 0 ? (
            <Empty
              className="empty-state"
              emoji="▧"
              title="No custom pages yet"
              description="Start with a provider template or a system page."
              action={
                <Button icon={FilePlus2} onClick={startAdd} type="primary">
                  Add your first page
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
                        ? (sources.find((source) => source.id === page.source_id)?.name ?? 'Saved source')
                        : 'Built-in template'}
                    </Text>
                  </Flexbox>
                  <Flexbox horizontal gap={8} wrap="wrap">
                    <Button icon={Pencil} onClick={() => editPage(page)}>
                      Edit
                    </Button>
                    {page.page_id !== 'system' && (
                      <>
                        <Button icon={Copy} onClick={() => duplicatePage(page)}>
                          Copy
                        </Button>
                        <Button icon={Trash2} onClick={() => void deletePage(page.page_id)} type="text">
                          Delete
                        </Button>
                      </>
                    )}
                  </Flexbox>
                </Block>
              ))}
            </div>
          )}
          <section className="sources-section page-publish-section">
            <h2>Publish to devices</h2>
            <Text type="secondary">The built-in system page counts toward the 10-page release limit.</Text>
            {devices.length === 0 ? (
              <Text type="secondary">No registered devices.</Text>
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
              Publish pages
            </Button>
          </section>
          <section className="sources-section">
            <h2>Release history</h2>
            {releases.length ? (
              releases.map((release) => (
                <Flexbox className="firmware-device-row" horizontal justify="space-between" key={release.id}>
                  <Text>
                    Release v{release.version} · active page {release.page_id}
                  </Text>
                  <Text type="secondary">{new Date(release.created_at).toLocaleString(locale)}</Text>
                </Flexbox>
              ))
            ) : (
              <Text type="secondary">No display releases yet.</Text>
            )}
          </section>
        </>
      )}
      {view === 'types' && (
        <section className="page-flow">
          <div className="page-flow-heading">
            <Text className="eyebrow">Step 1 of 3</Text>
            <h2>Choose a page type</h2>
            <Text type="secondary">Start from a provider directory. Credentials are managed in Sources.</Text>
          </div>
          <div className="page-type-grid">
            {providerTypes.map((provider) => (
              <Block className="page-type-card" key={provider} onClick={() => chooseProvider(provider)} variant="outlined">
                <h3>{providerLabels[provider]}</h3>
                <Text type="secondary">{pageTemplates.filter((template) => template.provider_type === provider).length} templates</Text>
                <Button type="primary">Choose</Button>
              </Block>
            ))}
          </div>
        </section>
      )}
      {view === 'templates' && (
        <section className="page-flow">
          <Button icon={ArrowLeft} onClick={() => setView('types')} type="text">
            Back to types
          </Button>
          <div className="page-flow-heading">
            <Text className="eyebrow">Step 2 of 3 · {selectedProvider && providerLabels[selectedProvider]}</Text>
            <h2>Choose a page template</h2>
          </div>
          <div className="page-template-list">
            {visibleTemplates.map((template) => (
              <Block className="page-template-card" key={template.id} variant="outlined">
                <Flexbox gap={5}>
                  <Flexbox horizontal align="center" gap={8}>
                    <h3>{template.name}</h3>
                    {template.id.endsWith('token-usage') && <Tag color="green">Recommended</Tag>}
                  </Flexbox>
                  <Text type="secondary">{template.description}</Text>
                </Flexbox>
                <Button onClick={() => chooseTemplate(template)} type="primary">
                  Select
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
              Back to templates
            </Button>
            <Flexbox horizontal gap={8}>
              <Button
                disabled={!draft.document_template.title.trim()}
                icon={Eye}
                loading={previewLoading}
                onClick={() => void refreshPreview()}
              >
                Refresh preview
              </Button>
              <Button icon={Plus} loading={saving} onClick={() => void savePage()} type="primary">
                {pages.some((page) => page.page_id === draft.page_id) ? 'Save page' : 'Create page'}
              </Button>
            </Flexbox>
          </Flexbox>
          <div className="display-editor-grid page-config-grid">
            <Block className="display-editor" variant="outlined">
              <Text className="eyebrow">Step 3 of 3 · {selectedTemplate?.name}</Text>
              <h2>Configure page</h2>
              <label htmlFor="page-name">Page name</label>
              <Input id="page-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <label htmlFor="page-id">Page ID</label>
              <Input
                id="page-id"
                value={draft.page_id}
                disabled={pages.some((page) => page.page_id === draft.page_id)}
                onChange={(event) => setDraft({ ...draft, page_id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              />
              {selectedTemplate?.requires_source && (
                <>
                  <label htmlFor="page-source">Saved data source</label>
                  <Select
                    id="page-source"
                    placeholder="Choose a saved source"
                    options={sources.map((source) => ({ label: source.name, value: source.id }))}
                    value={draft.source_id ?? undefined}
                    onChange={(value) => setDraft({ ...draft, source_id: String(value) })}
                  />
                  <Text type="secondary">Tokens and account details stay encrypted in Sources and are never stored in this page.</Text>
                </>
              )}
              <label htmlFor="page-title">Display title</label>
              <Input
                id="page-title"
                value={draft.document_template.title}
                onChange={(event) => updateDocument('title', event.target.value)}
              />
              <label htmlFor="page-subtitle">Subtitle</label>
              <Input
                id="page-subtitle"
                value={draft.document_template.subtitle ?? ''}
                onChange={(event) => updateDocument('subtitle', event.target.value)}
              />
              <label htmlFor="page-lines">Display lines JSON</label>
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
              <h2>Device preview</h2>
              {previewSvg ? (
                <img
                  alt="400 by 300 display preview"
                  className="display-editor-preview"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
                />
              ) : (
                <Empty emoji="▧" title="Preview not generated" description="Save valid page text and refresh the preview." />
              )}
            </Block>
          </div>
        </section>
      )}
      <Modal
        open={confirmOpen}
        title="Publish these pages?"
        okText="Publish"
        okButtonProps={{ loading: publishing }}
        cancelText="Cancel"
        onCancel={() => !publishing && setConfirmOpen(false)}
        onOk={() => void publish()}
      >
        <Text>
          Publish {pages.length + 1} page(s) to {selectedDevices.length} device(s). The release is immutable.
        </Text>
      </Modal>
    </main>
  )
}
