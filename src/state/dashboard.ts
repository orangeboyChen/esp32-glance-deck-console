import { atom } from 'jotai'

export type CommandPhase = 'idle' | 'submitting' | 'accepted' | 'error'

export type CommandFeedback = {
  device_id: string
  message: string
  phase: CommandPhase
}

export type DevicePageConfiguration = {
  active_page_id: string
  desired_page_id: string
  enabled_page_ids: string[]
  available_pages: Array<{ page_id: string }>
}

export const selectedDeviceIdAtom = atom<string | null>(null)
export const selectedPreviewIdAtom = atom<string | null>(null)
export const commandFeedbackAtom = atom<CommandFeedback | null>(null)
export const pageConfigurationAtom = atom<DevicePageConfiguration | null>(null)
export const pageLoadingAtom = atom(false)
export const pageSavingAtom = atom(false)
export const enrollmentOpenAtom = atom(false)
export const deviceFilterAtom = atom<'all' | 'attention'>('all')
export const previewSvgByDeviceAtom = atom<Record<string, string>>({})

export const beginDeviceCommandAtom = atom(null, (get, set, deviceId: string) => {
  set(commandFeedbackAtom, {
    device_id: deviceId,
    message: '',
    phase: 'submitting',
  })
})

export const resolveDeviceCommandAtom = atom(null, (get, set, feedback: CommandFeedback) => set(commandFeedbackAtom, feedback))
