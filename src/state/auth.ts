import { atom } from 'jotai'

export const loginEmailAtom = atom('')
export const loginPasswordAtom = atom('')
export const loginBusyAtom = atom(false)
export const loginErrorAtom = atom<string | null>(null)
export const setupEmailAtom = atom('')
export const setupPasswordAtom = atom('')
export const setupBusyAtom = atom(false)
export const setupErrorAtom = atom<string | null>(null)
