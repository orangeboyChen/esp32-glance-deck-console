const authenticatorTransportValues = ['ble', 'hybrid', 'internal', 'nfc', 'usb'] as const

export type AuthenticatorTransport = (typeof authenticatorTransportValues)[number]

const authenticatorTransportSet = new Set<string>(authenticatorTransportValues)

export const toAuthenticatorTransports = (transports?: string[]) =>
  transports?.filter((transport): transport is AuthenticatorTransport => authenticatorTransportSet.has(transport))
