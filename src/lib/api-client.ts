import type {
  AlertCreateRequest,
  AuthResponse,
  ConnectSoruxgptResponse,
  ConnectSoruxgptRequest,
  CreateAlertResponse,
  CreateSourceResponse,
  CreateTokenResponse,
  DisplayDocument,
  EnrollmentRequest,
  EnrollmentResponse,
  ListAlertsResponse,
  ListDevicesResponse,
  ListFirmwareReleasesResponse,
  ListPasskeysResponse,
  ListReleasesResponse,
  ListSourcesResponse,
  ListTokensResponse,
  LocaleRequest,
  LoginRequest,
  OtaInstallRequest,
  OtaJobRequest,
  PageConfiguration,
  PageConfigurationRequest,
  PasskeyLoginOptions,
  PasskeyRegisterOptions,
  PasskeyVerifyResponse,
  PreviewCcSwitchResponse,
  PreviewReleaseResponse,
  PublishReleaseResponse,
  ReleaseRequest,
  RolloutRequest,
  RolloutResponse,
  SerializedPasskeyLogin,
  SerializedPasskeyRegistration,
  SetupRequest,
  SourceCreateRequest,
  TokenRequest,
} from './api-contracts'
import type { JsonValue } from './api-contracts'

export const API_PREFIX = '/api'

export const apiPath = (...segments: string[]) => {
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/')
  return path ? `${API_PREFIX}/${path}` : API_PREFIX
}

export const apiUrl = (segments: string[], query?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(apiPath(...segments), 'http://glance-deck.local')
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }
  return `${url.pathname}${url.search}`
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ApiRequestInit = RequestInit & { json?: JsonValue }

export class ApiClient {
  private readonly request = async <Response>(path: string, init: ApiRequestInit = {}): Promise<Response> => {
    const { json, ...requestInit } = init
    const headers = new Headers(requestInit.headers)
    let body = requestInit.body
    if (json !== undefined) {
      headers.set('content-type', 'application/json')
      body = JSON.stringify(json)
    }
    const response = await fetch(`${API_PREFIX}${path}`, { ...requestInit, body, credentials: 'same-origin', headers })
    const contentType = response.headers.get('content-type') ?? ''
    const payload = response.status === 204 ? undefined : contentType.includes('json') ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `http_${response.status}`
      throw new ApiError(message, response.status)
    }
    return payload as Response
  }

  private readonly requestJson = async <RequestPayload extends JsonValue, ResponsePayload>(
    path: string,
    payload: RequestPayload,
    init: Omit<RequestInit, 'body'> = {},
  ): Promise<ResponsePayload> => this.request<ResponsePayload>(path, { ...init, json: payload })

  private readonly resource = (path: string, id: string, suffix?: string) =>
    `${path}/${encodeURIComponent(id)}${suffix ? `/${suffix}` : ''}`

  login = (payload: LoginRequest): Promise<AuthResponse> =>
    this.requestJson<LoginRequest, AuthResponse>('/auth/login', payload, { method: 'POST' })
  setup = (payload: SetupRequest): Promise<AuthResponse> =>
    this.requestJson<SetupRequest, AuthResponse>('/auth/setup', payload, { method: 'POST' })
  logout = () => this.request<null>('/auth/logout', { method: 'POST' })
  loginPasskeyOptions = () => this.request<PasskeyLoginOptions>('/auth/passkeys/login/options', { method: 'POST' })
  loginPasskeyVerify = (payload: SerializedPasskeyLogin): Promise<PasskeyVerifyResponse> =>
    this.requestJson<SerializedPasskeyLogin, PasskeyVerifyResponse>('/auth/passkeys/login/verify', payload, { method: 'POST' })
  registerPasskeyOptions = () => this.request<PasskeyRegisterOptions>('/auth/passkeys/register/options', { method: 'POST' })
  registerPasskeyVerify = (payload: SerializedPasskeyRegistration): Promise<PasskeyVerifyResponse> =>
    this.requestJson<SerializedPasskeyRegistration, PasskeyVerifyResponse>('/auth/passkeys/register/verify', payload, { method: 'POST' })
  listPasskeys = () => this.request<ListPasskeysResponse>('/auth/passkeys', { cache: 'no-store' })
  deletePasskey = (passkeyId: string) => this.request<null>(this.resource('/auth/passkeys', passkeyId), { method: 'DELETE' })
  setLocale = (locale: string): Promise<null> =>
    this.requestJson<LocaleRequest, null>('/preferences/locale', { locale }, { method: 'POST' })
  listAlerts = () => this.request<ListAlertsResponse>('/v1/alerts', { cache: 'no-store' })
  createAlert = (payload: AlertCreateRequest): Promise<CreateAlertResponse> =>
    this.requestJson<AlertCreateRequest, CreateAlertResponse>('/v1/alerts', payload, { method: 'POST' })
  deleteAlert = (alertId: string) => this.request<null>(this.resource('/v1/alerts', alertId), { method: 'DELETE' })
  listDevices = () => this.request<ListDevicesResponse>('/v1/devices', { cache: 'no-store' })
  enrollDevice = (payload: EnrollmentRequest): Promise<EnrollmentResponse> =>
    this.requestJson<EnrollmentRequest, EnrollmentResponse>('/v1/devices/enroll', payload, { method: 'POST' })
  getDevicePages = (deviceId: string) =>
    this.request<PageConfiguration>(this.resource('/v1/devices', deviceId, 'pages'), { cache: 'no-store' })
  updateDevicePages = (deviceId: string, payload: PageConfigurationRequest): Promise<PageConfiguration> =>
    this.requestJson<PageConfigurationRequest, PageConfiguration>(this.resource('/v1/devices', deviceId, 'pages'), payload, {
      method: 'PUT',
    })
  previewDevice = (deviceId: string) => this.request<string>(this.resource('/v1/devices', deviceId, 'preview'), { cache: 'no-store' })
  listFirmwareReleases = () => this.request<ListFirmwareReleasesResponse>('/v1/firmware/releases', { cache: 'no-store' })
  createRollout = (payload: RolloutRequest): Promise<RolloutResponse> =>
    this.requestJson<RolloutRequest, RolloutResponse>('/v1/ota/rollouts', payload, { method: 'POST' })
  updateOtaJob = (jobId: string, payload: OtaJobRequest): Promise<null> =>
    this.requestJson<OtaJobRequest, null>(this.resource('/v1/ota/jobs', jobId), payload, { method: 'PATCH' })
  installOta = (deviceId: string, payload: OtaInstallRequest): Promise<null> =>
    this.requestJson<OtaInstallRequest, null>(this.resource('/v1/devices', deviceId, 'ota'), payload, { method: 'POST' })
  listReleases = () => this.request<ListReleasesResponse>('/v1/releases', { cache: 'no-store' })
  previewRelease = (payload: DisplayDocument): Promise<PreviewReleaseResponse> =>
    this.requestJson<DisplayDocument, PreviewReleaseResponse>('/v1/releases/preview', payload, { method: 'POST' })
  publishRelease = (payload: ReleaseRequest): Promise<PublishReleaseResponse> =>
    this.requestJson<ReleaseRequest, PublishReleaseResponse>('/v1/releases', payload, { method: 'POST' })
  listSources = () => this.request<ListSourcesResponse>('/v1/sources', { cache: 'no-store' })
  connectSoruxgpt = (payload: ConnectSoruxgptRequest): Promise<ConnectSoruxgptResponse> =>
    this.requestJson<ConnectSoruxgptRequest, ConnectSoruxgptResponse>('/v1/sources/soruxgpt', payload, { method: 'POST' })
  previewCcSwitchImport = (payload: JsonValue): Promise<PreviewCcSwitchResponse> =>
    this.requestJson<JsonValue, PreviewCcSwitchResponse>('/v1/sources/cc-switch/preview', payload, { method: 'POST' })
  createSource = (payload: SourceCreateRequest): Promise<CreateSourceResponse> =>
    this.requestJson<SourceCreateRequest, CreateSourceResponse>('/v1/sources', payload, { method: 'POST' })
  testSource = (sourceId: string) => this.request<null>(this.resource('/v1/sources', sourceId, 'test'), { method: 'POST' })
  listTokens = () => this.request<ListTokensResponse>('/v1/tokens', { cache: 'no-store' })
  createToken = (payload: TokenRequest): Promise<CreateTokenResponse> =>
    this.requestJson<TokenRequest, CreateTokenResponse>('/v1/tokens', payload, { method: 'POST' })
  deleteToken = (tokenId: string) => this.request<null>(this.resource('/v1/tokens', tokenId), { method: 'DELETE' })
}

export const Api = new ApiClient()
