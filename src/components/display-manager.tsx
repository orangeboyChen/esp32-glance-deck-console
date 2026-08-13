'use client'

import { Block, Button, Checkbox, Empty, Flexbox, Input, Modal, Segmented, Text, TextArea, toast } from '@lobehub/ui'
import { ArrowLeft, Eye, Monitor, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { usePathname, useRouter } from '@/i18n/navigation'

type DisplayIcon = 'usage' | 'battery' | 'wifi' | 'system' | 'home'
type Progress = { value: number; max: number; label?: string; unit?: string }
type Document = { title: string; subtitle?: string; icon?: DisplayIcon; progress?: Progress; progresses?: Progress[]; lines?: Array<{ label: string; value: string }> }
type Page = { page_id: string; document: Document }
type Device = { id: string; name: string; board_model: string; status: string }
type Release = { id: string; version: number; page_id: string; created_at: string }

const new_page = (index: number): Page => ({ page_id: `page-${index}`, document: { title: '', subtitle: '', lines: [] } })
const system_page: Page = { page_id: 'system', document: { title: 'System', subtitle: 'Last verified page retained', icon: 'system', lines: [] } }

export function DisplayManager() {
  const translate = useTranslations('Displays')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pages, set_pages] = useState<Page[]>([new_page(1), system_page])
  const [active_page_id, set_active_page_id] = useState('page-1')
  const [lines_text, set_lines_text] = useState('[]')
  const [devices, set_devices] = useState<Device[]>([])
  const [selected_devices, set_selected_devices] = useState<string[]>([])
  const [releases, set_releases] = useState<Release[]>([])
  const [preview_svg, set_preview_svg] = useState<string | null>(null)
  const [preview_loading, set_preview_loading] = useState(false)
  const [publishing, set_publishing] = useState(false)
  const [confirm_open, set_confirm_open] = useState(false)
  const [error, set_error] = useState<string | null>(null)

  const change_locale = (next_locale: 'en' | 'zh-CN' | 'ja') => router.replace(pathname, { locale: next_locale })
  const load_data = async () => {
    try {
      const [device_response, release_response] = await Promise.all([fetch('/api/v1/devices', { cache: 'no-store' }), fetch('/api/v1/releases', { cache: 'no-store' })])
      if (!device_response.ok || !release_response.ok) throw new Error('load_failed')
      set_devices((await device_response.json() as { devices: Device[] }).devices)
      set_releases((await release_response.json() as { releases: Release[] }).releases.slice(-10).reverse())
    } catch { set_error(translate('loadFailed')) }
  }
  useEffect(() => { void load_data() }, [])
  useEffect(() => {
    const page = pages.find((item) => item.page_id === active_page_id)
    set_lines_text(JSON.stringify(page?.document.lines ?? [], null, 2))
  }, [active_page_id])

  const active_page = pages.find((page) => page.page_id === active_page_id) ?? pages[0]
  const update_document = (field: keyof Document, value: string | number) => {
    if (!active_page) return
    set_pages(pages.map((page) => page.page_id === active_page.page_id ? { ...page, document: { ...page.document, [field]: value } } : page))
  }
  const update_lines = (value: string) => {
    set_lines_text(value)
    if (!active_page) return
    try {
      const lines = JSON.parse(value) as Document['lines']
      if (Array.isArray(lines)) set_pages(pages.map((page) => page.page_id === active_page.page_id ? { ...page, document: { ...page.document, lines } } : page))
    } catch { /* keep the last valid document while editing */ }
  }
  const update_progress = (field: 'value' | 'max' | 'label' | 'unit', value: string, index = 0) => {
    if (!active_page) return
    const meters = active_page.document.progresses?.length ? active_page.document.progresses : [active_page.document.progress ?? { value: 0, max: 100 }]
    const current = meters[index] ?? { value: 0, max: 100 }
    const next = field === 'value' || field === 'max' ? { ...current, [field]: Number(value) || 0 } : { ...current, [field]: value }
    const progresses = meters.map((meter, meter_index) => meter_index === index ? next : meter)
    set_pages(pages.map((page) => page.page_id === active_page.page_id ? { ...page, document: { ...page.document, progress: undefined, progresses } } : page))
  }
  const preview = async () => {
    if (!active_page?.document.title.trim()) return set_error(translate('titleRequired'))
    set_preview_loading(true)
    set_error(null)
    try {
      const response = await fetch('/api/v1/releases/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(active_page.document) })
      const body = await response.json() as { preview_svg?: string; error?: string }
      if (!response.ok || !body.preview_svg) throw new Error(body.error || 'preview_failed')
      set_preview_svg(body.preview_svg)
    } catch { set_error(translate('previewFailed')) } finally { set_preview_loading(false) }
  }
  const publish = async () => {
    if (!pages.every((page) => page.page_id && page.document.title.trim()) || !selected_devices.length) return
    set_publishing(true)
    try {
      const response = await fetch('/api/v1/releases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active_page_id, pages, device_ids: selected_devices }) })
      const body = await response.json() as { error?: string; failed_devices?: string[] }
      if (!response.ok) throw new Error(body.error || 'publish_failed')
      toast.success(body.failed_devices?.length ? translate('publishedPartial', { count: body.failed_devices.length }) : translate('published'))
      set_confirm_open(false)
      await load_data()
    } catch (publish_error) {
      const code = publish_error instanceof Error ? publish_error.message : 'publish_failed'
      toast.error(translate.has(code) ? translate(code) : translate('publishFailed'))
    } finally { set_publishing(false) }
  }
  const add_page = () => { if (pages.length < 10) { const page_ids = new Set(pages.map((page) => page.page_id)); let index = 1; while (page_ids.has(`page-${index}`)) index += 1; set_pages([...pages.filter((page) => page.page_id !== 'system'), new_page(index), system_page]) } }
  const remove_page = (page_id: string) => { if (page_id === 'system' || pages.length <= 2) return; const next = pages.filter((page) => page.page_id !== page_id); set_pages(next); if (active_page_id === page_id) set_active_page_id(next[0].page_id) }

  return <main className="sources-shell"><header className="dashboard-header"><Flexbox className="dashboard-introduction" gap={10}><Button icon={ArrowLeft} onClick={() => router.push('/')} size="large">{translate('back')}</Button><Text className="eyebrow"><Monitor aria-hidden />{translate('eyebrow')}</Text><h1>{translate('title')}</h1><Text className="header-subtitle">{translate('subtitle')}</Text></Flexbox><Segmented aria-label={translate('language')} options={[{ label: 'EN', value: 'en' }, { label: '中文', value: 'zh-CN' }, { label: '日本語', value: 'ja' }]} value={locale} onChange={(value) => change_locale(value as 'en' | 'zh-CN' | 'ja')} /></header>
    <section className="display-editor-grid" aria-label={translate('editor')}><Block className="display-editor" variant="outlined"><Flexbox horizontal align="center" justify="space-between" gap={8}><h2>{translate('editor')}</h2><Button icon={Plus} disabled={pages.length >= 10} onClick={add_page}>{translate('addPage')}</Button></Flexbox><Flexbox className="page-tabs" horizontal gap={8} wrap="wrap">{pages.map((page) => <Button key={page.page_id} onClick={() => set_active_page_id(page.page_id)} type={page.page_id === active_page_id ? 'primary' : 'default'}>{page.page_id}</Button>)}</Flexbox>{active_page && <Flexbox className="source-form" gap={8}><label htmlFor="display-page-id">{translate('pageId')}</label><Input disabled={active_page.page_id === 'system'} id="display-page-id" pattern="[a-z0-9-]+" value={active_page.page_id} onChange={(event) => { const next_page_id = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); set_pages(pages.map((page) => page.page_id === active_page_id ? { ...page, page_id: next_page_id } : page)); set_active_page_id(next_page_id) }} /><label htmlFor="display-title">{translate('displayTitle')}</label><Input id="display-title" maxLength={48} required value={active_page.document.title} onChange={(event) => update_document('title', event.target.value)} /><label htmlFor="display-subtitle">{translate('displaySubtitle')}</label><Input id="display-subtitle" maxLength={80} value={active_page.document.subtitle ?? ''} onChange={(event) => update_document('subtitle', event.target.value)} /><label>{translate('displayIcon')}</label><Segmented options={[{ label: translate('iconNone'), value: 'none' }, { label: '↗', value: 'usage' }, { label: '⌂', value: 'home' }, { label: '▣', value: 'battery' }, { label: ')))', value: 'wifi' }, { label: '▤', value: 'system' }]} value={active_page.document.icon ?? 'none'} onChange={(value) => update_document('icon', value === 'none' ? '' : value)} /><Checkbox checked={Boolean(active_page.document.progress || active_page.document.progresses?.length)} onChange={(checked) => { if (!active_page) return; set_pages(pages.map((page) => page.page_id === active_page.page_id ? { ...page, document: { ...page.document, progress: undefined, progresses: checked ? (page.document.progresses?.length ? page.document.progresses : [page.document.progress ?? { value: 0, max: 100, label: translate('progressLabel'), unit: translate('progressUnit') }]) : undefined } } : page)) }}>{translate('enableProgress')}</Checkbox>{(active_page.document.progress || active_page.document.progresses?.length) && <Flexbox gap={8}>{(active_page.document.progresses?.length ? active_page.document.progresses : [active_page.document.progress!]).map((progress, index) => <Flexbox horizontal gap={8} key={index} wrap="wrap"><Input aria-label={translate('progressValue')} min={0} type="number" value={progress.value} onChange={(event) => update_progress('value', event.target.value, index)} /><Input aria-label={translate('progressMax')} min={1} type="number" value={progress.max} onChange={(event) => update_progress('max', event.target.value, index)} /><Input aria-label={translate('progressLabel')} value={progress.label ?? ''} onChange={(event) => update_progress('label', event.target.value, index)} /><Input aria-label={translate('progressUnit')} value={progress.unit ?? ''} onChange={(event) => update_progress('unit', event.target.value, index)} /></Flexbox>)}<Button disabled={(active_page.document.progresses?.length ?? 1) >= 3} onClick={() => { const meters = active_page.document.progresses?.length ? active_page.document.progresses : [active_page.document.progress!]; set_pages(pages.map((page) => page.page_id === active_page.page_id ? { ...page, document: { ...page.document, progress: undefined, progresses: [...meters, { value: 0, max: 100, label: translate('progressLabel'), unit: translate('progressUnit') }] } } : page)) }}>Add meter</Button></Flexbox>}<label htmlFor="display-lines">{translate('displayLines')}</label><TextArea id="display-lines" rows={8} value={lines_text} onChange={(event) => update_lines(event.target.value)} /><Text type="secondary">{translate('linesHint')}</Text><Button icon={Trash2} disabled={active_page.page_id === 'system' || pages.length <= 2} onClick={() => remove_page(active_page.page_id)}>{translate('removePage')}</Button></Flexbox>}</Block><Block className="display-preview-card" variant="outlined"><Flexbox horizontal align="center" justify="space-between"><h2>{translate('preview')}</h2><Button icon={Eye} loading={preview_loading} onClick={() => void preview()}>{translate('refreshPreview')}</Button></Flexbox>{preview_svg ? <img alt={translate('previewAlt')} className="display-editor-preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview_svg)}`} /> : <Empty emoji="▧" title={translate('previewEmpty')} description={translate('previewEmptyDescription')} />}</Block></section>
    <section className="sources-section" aria-labelledby="targets-heading"><h2 id="targets-heading">{translate('targets')}</h2><Text type="secondary">{translate('targetsDescription')}</Text>{devices.length === 0 ? <Text type="secondary">{translate('noDevices')}</Text> : devices.map((device) => <Flexbox className="firmware-device-row" horizontal align="center" justify="space-between" key={device.id} gap={12}><Checkbox checked={selected_devices.includes(device.id)} onChange={(checked) => set_selected_devices(checked ? [...selected_devices, device.id] : selected_devices.filter((id) => id !== device.id))}>{device.name}</Checkbox><Text type="secondary">{device.status} · {device.board_model}</Text></Flexbox>)}{error && <Text role="alert" type="danger">{error}</Text>}<Button disabled={!selected_devices.length || !pages.every((page) => page.document.title.trim())} icon={Send} onClick={() => set_confirm_open(true)} size="large" type="primary">{translate('publish')}</Button></section>
    <section className="sources-section"><h2>{translate('history')}</h2>{releases.length ? releases.map((release) => <Flexbox className="firmware-device-row" horizontal justify="space-between" key={release.id}><Text>{translate('releaseVersion', { version: release.version, page: release.page_id })}</Text><Text type="secondary">{new Date(release.created_at).toLocaleString(locale)}</Text></Flexbox>) : <Text type="secondary">{translate('noHistory')}</Text>}</section>
    <Modal open={confirm_open} title={translate('confirmTitle')} okText={translate('publish')} okButtonProps={{ loading: publishing }} cancelText={translate('cancel')} onCancel={() => !publishing && set_confirm_open(false)} onOk={() => void publish()}><Text>{translate('confirmDescription', { count: selected_devices.length, pageCount: pages.length })}</Text></Modal>
  </main>
}
