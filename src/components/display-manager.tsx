'use client'

import { Block, Button, Checkbox, Empty, Flexbox, Input, Modal, Segmented, Text, TextArea, toast } from '@lobehub/ui'
import { useAtom } from 'jotai'
import { BatteryMedium, ChartNoAxesCombined, Eye, House, Monitor, PanelsTopLeft, Plus, Send, Trash2, Wifi } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect } from 'react'

import { ConsolePageHeader } from './console-page-header'

import {
  displayActivePageIdAtom,
  displayConfirmOpenAtom,
  displayDevicesAtom,
  displayErrorAtom,
  displayLinesTextAtom,
  displayPagesAtom,
  displayPreviewLoadingAtom,
  displayPreviewSvgAtom,
  displayPublishingAtom,
  displayReleasesAtom,
  displaySelectedDevicesAtom,
  newPage,
  systemPage,
  type DisplayDocument as Document,
  type Device,
  type Release,
} from '@/state/display'

export const DisplayManager = () => {
  const translate = useTranslations('Displays')
  const locale = useLocale()
  const [pages, setPages] = useAtom(displayPagesAtom)
  const [activePageId, setActivePageId] = useAtom(displayActivePageIdAtom)
  const [linesText, setLinesText] = useAtom(displayLinesTextAtom)
  const [devices, setDevices] = useAtom(displayDevicesAtom)
  const [selectedDevices, setSelectedDevices] = useAtom(displaySelectedDevicesAtom)
  const [releases, setReleases] = useAtom(displayReleasesAtom)
  const [previewSvg, setPreviewSvg] = useAtom(displayPreviewSvgAtom)
  const [previewLoading, setPreviewLoading] = useAtom(displayPreviewLoadingAtom)
  const [publishing, setPublishing] = useAtom(displayPublishingAtom)
  const [confirmOpen, setConfirmOpen] = useAtom(displayConfirmOpenAtom)
  const [error, setError] = useAtom(displayErrorAtom)

  const loadData = useCallback(async () => {
    try {
      const [deviceResponse, releaseResponse] = await Promise.all([
        fetch('/api/v1/devices', { cache: 'no-store' }),
        fetch('/api/v1/releases', { cache: 'no-store' }),
      ])
      if (!deviceResponse.ok || !releaseResponse.ok) throw new Error('load_failed')
      setDevices(((await deviceResponse.json()) as { devices: Device[] }).devices)
      setReleases(((await releaseResponse.json()) as { releases: Release[] }).releases.slice(-10).reverse())
    } catch {
      setError(translate('loadFailed'))
    }
  }, [translate, setDevices, setError, setReleases])
  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => {
    const page = pages.find((item) => item.page_id === activePageId)
    setLinesText(JSON.stringify(page?.document.lines ?? [], null, 2))
  }, [activePageId, pages, setLinesText])

  const activePage = pages.find((page) => page.page_id === activePageId) ?? pages[0]
  const updateDocument = (field: keyof Document, value: string | number) => {
    if (!activePage) return
    setPages(
      pages.map((page) => (page.page_id === activePage.page_id ? { ...page, document: { ...page.document, [field]: value } } : page)),
    )
  }
  const updateLines = (value: string) => {
    setLinesText(value)
    if (!activePage) return
    try {
      const lines = JSON.parse(value) as Document['lines']
      if (Array.isArray(lines))
        setPages(pages.map((page) => (page.page_id === activePage.page_id ? { ...page, document: { ...page.document, lines } } : page)))
    } catch {
      /* keep the last valid document while editing */
    }
  }
  const updateProgress = (field: 'value' | 'max' | 'label' | 'unit', value: string, index = 0) => {
    if (!activePage) return
    const meters = activePage.document.progresses?.length
      ? activePage.document.progresses
      : [activePage.document.progress ?? { value: 0, max: 100 }]
    const current = meters[index] ?? { value: 0, max: 100 }
    const next = field === 'value' || field === 'max' ? { ...current, [field]: Number(value) || 0 } : { ...current, [field]: value }
    const progresses = meters.map((meter, meterIndex) => (meterIndex === index ? next : meter))
    setPages(
      pages.map((page) =>
        page.page_id === activePage.page_id ? { ...page, document: { ...page.document, progress: undefined, progresses } } : page,
      ),
    )
  }
  const preview = async () => {
    if (!activePage?.document.title.trim()) return setError(translate('titleRequired'))
    setPreviewLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/releases/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(activePage.document),
      })
      const body = (await response.json()) as { preview_svg?: string; error?: string }
      if (!response.ok || !body.preview_svg) throw new Error(body.error || 'preview_failed')
      setPreviewSvg(body.preview_svg)
    } catch {
      setError(translate('previewFailed'))
    } finally {
      setPreviewLoading(false)
    }
  }
  const publish = async () => {
    if (!pages.every((page) => page.page_id && page.document.title.trim()) || !selectedDevices.length) return
    setPublishing(true)
    try {
      const response = await fetch('/api/v1/releases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active_page_id: activePageId, pages, device_ids: selectedDevices }),
      })
      const body = (await response.json()) as { error?: string; failed_devices?: string[] }
      if (!response.ok) throw new Error(body.error || 'publish_failed')
      toast.success(
        body.failed_devices?.length ? translate('publishedPartial', { count: body.failed_devices.length }) : translate('published'),
      )
      setConfirmOpen(false)
      await loadData()
    } catch (publishError) {
      const code = publishError instanceof Error ? publishError.message : 'publish_failed'
      toast.error(translate.has(code) ? translate(code) : translate('publishFailed'))
    } finally {
      setPublishing(false)
    }
  }
  const addPage = () => {
    if (pages.length < 10) {
      const pageIds = new Set(pages.map((page) => page.page_id))
      let index = 1
      while (pageIds.has(`page-${index}`)) index += 1
      setPages([...pages.filter((page) => page.page_id !== 'system'), newPage(index), systemPage])
    }
  }
  const removePage = (pageId: string) => {
    if (pageId === 'system' || pages.length <= 2) return
    const next = pages.filter((page) => page.page_id !== pageId)
    setPages(next)
    if (activePageId === pageId) setActivePageId(next[0].page_id)
  }

  return (
    <main className="sources-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={Monitor}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />
      <section className="display-editor-grid" aria-label={translate('editor')}>
        <Block className="display-editor" variant="outlined">
          <Flexbox horizontal align="center" justify="space-between" gap={8}>
            <h2>{translate('editor')}</h2>
            <Button icon={Plus} disabled={pages.length >= 10} onClick={addPage}>
              {translate('addPage')}
            </Button>
          </Flexbox>
          <Flexbox className="page-tabs" horizontal gap={8} wrap="wrap">
            {pages.map((page) => (
              <Button
                key={page.page_id}
                onClick={() => setActivePageId(page.page_id)}
                type={page.page_id === activePageId ? 'primary' : 'default'}
              >
                {page.page_id}
              </Button>
            ))}
          </Flexbox>
          {activePage && (
            <Flexbox className="source-form" gap={8}>
              <label htmlFor="display-page-id">{translate('pageId')}</label>
              <Input
                disabled={activePage.page_id === 'system'}
                id="display-page-id"
                pattern="[a-z0-9-]+"
                value={activePage.page_id}
                onChange={(event) => {
                  const nextPageId = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  setPages(pages.map((page) => (page.page_id === activePageId ? { ...page, page_id: nextPageId } : page)))
                  setActivePageId(nextPageId)
                }}
              />
              <label htmlFor="display-title">{translate('displayTitle')}</label>
              <Input
                id="display-title"
                maxLength={48}
                required
                value={activePage.document.title}
                onChange={(event) => updateDocument('title', event.target.value)}
              />
              <label htmlFor="display-subtitle">{translate('displaySubtitle')}</label>
              <Input
                id="display-subtitle"
                maxLength={80}
                value={activePage.document.subtitle ?? ''}
                onChange={(event) => updateDocument('subtitle', event.target.value)}
              />
              <label>{translate('displayIcon')}</label>
              <Segmented
                options={[
                  { label: translate('iconNone'), value: 'none' },
                  { icon: <ChartNoAxesCombined aria-label="Usage" size={17} />, value: 'usage' },
                  { icon: <House aria-label="Home" size={17} />, value: 'home' },
                  { icon: <BatteryMedium aria-label="Battery" size={17} />, value: 'battery' },
                  { icon: <Wifi aria-label="Wi-Fi" size={17} />, value: 'wifi' },
                  { icon: <PanelsTopLeft aria-label="System" size={17} />, value: 'system' },
                ]}
                value={activePage.document.icon ?? 'none'}
                onChange={(value) => updateDocument('icon', value === 'none' ? '' : value)}
              />
              <Checkbox
                checked={Boolean(activePage.document.progress || activePage.document.progresses?.length)}
                onChange={(checked) => {
                  if (!activePage) return
                  setPages(
                    pages.map((page) =>
                      page.page_id === activePage.page_id
                        ? {
                            ...page,
                            document: {
                              ...page.document,
                              progress: undefined,
                              progresses: checked
                                ? page.document.progresses?.length
                                  ? page.document.progresses
                                  : [
                                      page.document.progress ?? {
                                        value: 0,
                                        max: 100,
                                        label: translate('progressLabel'),
                                        unit: translate('progressUnit'),
                                      },
                                    ]
                                : undefined,
                            },
                          }
                        : page,
                    ),
                  )
                }}
              >
                {translate('enableProgress')}
              </Checkbox>
              {(activePage.document.progress || activePage.document.progresses?.length) && (
                <Flexbox gap={8}>
                  {(activePage.document.progresses?.length
                    ? activePage.document.progresses
                    : [activePage.document.progress ?? { value: 0, max: 100 }]
                  ).map((progress, index) => (
                    <Flexbox horizontal gap={8} key={index} wrap="wrap">
                      <Input
                        aria-label={translate('progressValue')}
                        min={0}
                        type="number"
                        value={progress.value}
                        onChange={(event) => updateProgress('value', event.target.value, index)}
                      />
                      <Input
                        aria-label={translate('progressMax')}
                        min={1}
                        type="number"
                        value={progress.max}
                        onChange={(event) => updateProgress('max', event.target.value, index)}
                      />
                      <Input
                        aria-label={translate('progressLabel')}
                        value={progress.label ?? ''}
                        onChange={(event) => updateProgress('label', event.target.value, index)}
                      />
                      <Input
                        aria-label={translate('progressUnit')}
                        value={progress.unit ?? ''}
                        onChange={(event) => updateProgress('unit', event.target.value, index)}
                      />
                    </Flexbox>
                  ))}
                  <Button
                    disabled={(activePage.document.progresses?.length ?? 1) >= 3}
                    onClick={() => {
                      const meters = activePage.document.progresses?.length
                        ? activePage.document.progresses
                        : [activePage.document.progress ?? { value: 0, max: 100 }]
                      setPages(
                        pages.map((page) =>
                          page.page_id === activePage.page_id
                            ? {
                                ...page,
                                document: {
                                  ...page.document,
                                  progress: undefined,
                                  progresses: [
                                    ...meters,
                                    { value: 0, max: 100, label: translate('progressLabel'), unit: translate('progressUnit') },
                                  ],
                                },
                              }
                            : page,
                        ),
                      )
                    }}
                  >
                    Add meter
                  </Button>
                </Flexbox>
              )}
              <label htmlFor="display-lines">{translate('displayLines')}</label>
              <TextArea id="display-lines" rows={8} value={linesText} onChange={(event) => updateLines(event.target.value)} />
              <Text type="secondary">{translate('linesHint')}</Text>
              <Button
                icon={Trash2}
                disabled={activePage.page_id === 'system' || pages.length <= 2}
                onClick={() => removePage(activePage.page_id)}
              >
                {translate('removePage')}
              </Button>
            </Flexbox>
          )}
        </Block>
        <Block className="display-preview-card" variant="outlined">
          <Flexbox horizontal align="center" justify="space-between">
            <h2>{translate('preview')}</h2>
            <Button icon={Eye} loading={previewLoading} onClick={() => void preview()}>
              {translate('refreshPreview')}
            </Button>
          </Flexbox>
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
      </section>
      <section className="sources-section" aria-labelledby="targets-heading">
        <h2 id="targets-heading">{translate('targets')}</h2>
        <Text type="secondary">{translate('targetsDescription')}</Text>
        {devices.length === 0 ? (
          <Text type="secondary">{translate('noDevices')}</Text>
        ) : (
          devices.map((device) => (
            <Flexbox className="firmware-device-row" horizontal align="center" justify="space-between" key={device.id} gap={12}>
              <Checkbox
                checked={selectedDevices.includes(device.id)}
                onChange={(checked) =>
                  setSelectedDevices(checked ? [...selectedDevices, device.id] : selectedDevices.filter((id) => id !== device.id))
                }
              >
                {device.name}
              </Checkbox>
              <Text type="secondary">
                {device.status} · {device.board_model}
              </Text>
            </Flexbox>
          ))
        )}
        {error && (
          <Text role="alert" type="danger">
            {error}
          </Text>
        )}
        <Button
          disabled={!selectedDevices.length || !pages.every((page) => page.document.title.trim())}
          icon={Send}
          onClick={() => setConfirmOpen(true)}
          size="large"
          type="primary"
        >
          {translate('publish')}
        </Button>
      </section>
      <section className="sources-section">
        <h2>{translate('history')}</h2>
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
      <Modal
        open={confirmOpen}
        title={translate('confirmTitle')}
        okText={translate('publish')}
        okButtonProps={{ loading: publishing }}
        cancelText={translate('cancel')}
        onCancel={() => !publishing && setConfirmOpen(false)}
        onOk={() => void publish()}
      >
        <Text>{translate('confirmDescription', { count: selectedDevices.length, pageCount: pages.length })}</Text>
      </Modal>
    </main>
  )
}
