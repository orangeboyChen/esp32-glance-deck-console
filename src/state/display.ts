import { atom } from 'jotai'

export type DisplayIcon = 'usage' | 'battery' | 'wifi' | 'system' | 'home'
export type Progress = { value: number; max: number; label?: string; unit?: string }
export type DisplayDocument = {
  title: string
  subtitle?: string
  icon?: DisplayIcon
  progress?: Progress
  progresses?: Progress[]
  lines?: Array<{ label: string; value: string }>
}
export type Page = { page_id: string; document: DisplayDocument }
export type Device = { id: string; name: string; board_model: string; status: string }
export type Release = { id: string; version: number; page_id: string; created_at: string }

export const newPage = (index: number): Page => ({ page_id: `page-${index}`, document: { title: '', subtitle: '', lines: [] } })
export const systemPage: Page = {
  page_id: 'system',
  document: { title: 'System', subtitle: 'Last verified page retained', icon: 'system', lines: [] },
}

export const displayPagesAtom = atom<Page[]>([newPage(1), systemPage])
export const displayActivePageIdAtom = atom('page-1')
export const displayLinesTextAtom = atom('[]')
export const displayDevicesAtom = atom<Device[]>([])
export const displaySelectedDevicesAtom = atom<string[]>([])
export const displayReleasesAtom = atom<Release[]>([])
export const displayPreviewSvgAtom = atom<string | null>(null)
export const displayPreviewLoadingAtom = atom(false)
export const displayPublishingAtom = atom(false)
export const displayConfirmOpenAtom = atom(false)
export const displayErrorAtom = atom<string | null>(null)
