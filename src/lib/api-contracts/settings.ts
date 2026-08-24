export type ApiToken = { id: string; label: string; scopes: string[]; created_at: string }
export type TokenRequest = { label: string; scopes: string[] }
export type CreateTokenResponse = { token: string; record: Omit<ApiToken, 'created_at'> }
export type ListTokensResponse = { tokens: ApiToken[] }
