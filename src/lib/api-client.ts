export type ApiRequestInit = RequestInit & {
  json?: unknown
}

export const API_PREFIX = '/api'

export const apiPath = (...segments: string[]) => {
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/')
  return path ? `${API_PREFIX}/${path}` : API_PREFIX
}

export const apiUrl = (segments: string[], query?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(apiPath(...segments), 'http://glance-deck.local')
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return `${url.pathname}${url.search}`
}

export const apiFetch = async (input: RequestInfo | URL, init: ApiRequestInit = {}) => {
  const { json, ...requestInit } = init
  const headers = new Headers(requestInit.headers)
  let body = requestInit.body

  if (json !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(json)
  }

  return fetch(input, {
    ...requestInit,
    body,
    credentials: 'same-origin',
    headers,
  })
}

const request = (segments: string[], init: ApiRequestInit = {}) => apiFetch(apiPath(...segments), init)

export const Api = {
  login: (payload: unknown) => request(['auth', 'login'], { method: 'POST', json: payload }),
  setup: (payload: unknown) => request(['auth', 'setup'], { method: 'POST', json: payload }),
  logout: () => request(['auth', 'logout'], { method: 'POST' }),
  loginPasskeyOptions: () => request(['auth', 'passkeys', 'login', 'options'], { method: 'POST' }),
  loginPasskeyVerify: (payload: unknown) => request(['auth', 'passkeys', 'login', 'verify'], { method: 'POST', json: payload }),
  registerPasskeyOptions: () => request(['auth', 'passkeys', 'register', 'options'], { method: 'POST' }),
  registerPasskeyVerify: (payload: unknown) => request(['auth', 'passkeys', 'register', 'verify'], { method: 'POST', json: payload }),
  listPasskeys: () => request(['auth', 'passkeys'], { cache: 'no-store' }),
  deletePasskey: (passkeyId: string) => request(['auth', 'passkeys', passkeyId], { method: 'DELETE' }),
  setLocale: (locale: string) => request(['preferences', 'locale'], { method: 'POST', json: { locale } }),
  listAlerts: () => request(['v1', 'alerts'], { cache: 'no-store' }),
  createAlert: (payload: unknown) => request(['v1', 'alerts'], { method: 'POST', json: payload }),
  deleteAlert: (alertId: string) => request(['v1', 'alerts', alertId], { method: 'DELETE' }),
  listDevices: () => request(['v1', 'devices'], { cache: 'no-store' }),
  enrollDevice: (payload: unknown) => request(['v1', 'devices', 'enroll'], { method: 'POST', json: payload }),
  getDevicePages: (deviceId: string) => request(['v1', 'devices', deviceId, 'pages'], { cache: 'no-store' }),
  updateDevicePages: (deviceId: string, payload: unknown) =>
    request(['v1', 'devices', deviceId, 'pages'], { method: 'PUT', json: payload }),
  previewDevice: (deviceId: string) => request(['v1', 'devices', deviceId, 'preview'], { cache: 'no-store' }),
  listFirmwareReleases: () => request(['v1', 'firmware', 'releases'], { cache: 'no-store' }),
  createRollout: (payload: unknown) => request(['v1', 'ota', 'rollouts'], { method: 'POST', json: payload }),
  updateOtaJob: (jobId: string, payload: unknown) => request(['v1', 'ota', 'jobs', jobId], { method: 'PATCH', json: payload }),
  installOta: (deviceId: string, payload: unknown) => request(['v1', 'devices', deviceId, 'ota'], { method: 'POST', json: payload }),
  listReleases: () => request(['v1', 'releases'], { cache: 'no-store' }),
  previewRelease: (payload: unknown) => request(['v1', 'releases', 'preview'], { method: 'POST', json: payload }),
  publishRelease: (payload: unknown) => request(['v1', 'releases'], { method: 'POST', json: payload }),
  listSources: () => request(['v1', 'sources'], { cache: 'no-store' }),
  connectSoruxgpt: (payload: unknown) => request(['v1', 'sources', 'soruxgpt'], { method: 'POST', json: payload }),
  previewCcSwitchImport: (payload: unknown) => request(['v1', 'sources', 'cc-switch', 'preview'], { method: 'POST', json: payload }),
  createSource: (payload: unknown) => request(['v1', 'sources'], { method: 'POST', json: payload }),
  testSource: (sourceId: string) => request(['v1', 'sources', sourceId, 'test'], { method: 'POST' }),
  listTokens: () => request(['v1', 'tokens'], { cache: 'no-store' }),
  createToken: (payload: unknown) => request(['v1', 'tokens'], { method: 'POST', json: payload }),
  deleteToken: (tokenId: string) => request(['v1', 'tokens', tokenId], { method: 'DELETE' }),
}
