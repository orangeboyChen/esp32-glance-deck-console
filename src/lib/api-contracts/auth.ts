import type { JsonObject } from './common'

export type Administrator = { id: string; email: string }
export type LoginRequest = { email: string; password: string }
export type SetupRequest = LoginRequest
export type AuthResponse = { administrator: Administrator }
export type PasskeyLoginOptions = {
  challenge: string
  allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>
}
export type PasskeyRegisterOptions = {
  challenge: string
  user: { id: string; name: string; displayName: string }
  rp: { id?: string; name: string }
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>
  timeout?: number
  excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>
}
export type SerializedPasskeyLogin = {
  id: string
  rawId: string
  type: 'public-key'
  response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string }
  clientExtensionResults: JsonObject
}
export type SerializedPasskeyRegistration = {
  id: string
  rawId: string
  response: { clientDataJSON: string; attestationObject: string; transports?: string[] }
  type: 'public-key'
  clientExtensionResults: JsonObject
}
export type PasskeyVerifyResponse = { verified: true }
export type Passkey = { id: string; created_at: string; transports: string[] | null }
export type ListPasskeysResponse = { passkeys: Passkey[] }
