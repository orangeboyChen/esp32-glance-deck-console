import { atom } from 'jotai'

export const enrollmentNameAtom = atom('')
export const enrollmentPairingCodeAtom = atom('')
export const enrollmentSubmittingAtom = atom(false)
export const enrollmentErrorAtom = atom<string | null>(null)
