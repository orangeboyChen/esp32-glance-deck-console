import { atom } from 'jotai'

export type ApiToken = { id: string; label: string; scopes: string[]; created_at: string }
export type Passkey = { id: string; created_at: string; transports: string[] | null }
export type NewToken = { token: string; record: Omit<ApiToken, 'created_at'> }

export const tokenLabelAtom = atom('Home Assistant')
export const tokenScopesAtom = atom<string[]>(['devices:read', 'devices:command', 'alerts:read'])
export const settingsTokensAtom = atom<ApiToken[]>([])
export const settingsPasskeysAtom = atom<Passkey[]>([])
export const settingsLoadingAtom = atom(true)
export const settingsSavingAtom = atom(false)
export const settingsNewTokenAtom = atom<NewToken | null>(null)
export const settingsRemovePasskeyAtom = atom<Passkey | null>(null)
export const settingsPasskeyBusyAtom = atom(false)
export const settingsErrorAtom = atom<string | null>(null)
