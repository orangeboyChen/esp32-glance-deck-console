'use client'

import { Alert, Block, Button, Flexbox, Input, Modal, Text, toast } from '@lobehub/ui'
import { KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useAtom } from 'jotai'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect } from 'react'

import { ConsolePageHeader } from './console-page-header'

import {
  settingsErrorAtom,
  settingsLoadingAtom,
  settingsNewTokenAtom,
  settingsPasskeyBusyAtom,
  settingsPasskeysAtom,
  settingsRemovePasskeyAtom,
  settingsSavingAtom,
  settingsTokensAtom,
  tokenLabelAtom,
  tokenScopesAtom,
  type ApiToken,
  type NewToken,
  type Passkey,
} from '@/state/settings'

const toBase64url = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return bytes.buffer
}

const serialiseCredential = (credential: Credential) => {
  const publicKey = credential as PublicKeyCredential
  const response = publicKey.response as AuthenticatorAttestationResponse
  return {
    id: publicKey.id,
    rawId: toBase64url(publicKey.rawId),
    response: {
      clientDataJSON: toBase64url(response.clientDataJSON),
      attestationObject: toBase64url(response.attestationObject),
      transports: response.getTransports?.(),
    },
    type: publicKey.type,
    clientExtensionResults: publicKey.getClientExtensionResults(),
  }
}

export const SettingsManager = () => {
  const translate = useTranslations('Settings')
  const locale = useLocale()
  const [label, setLabel] = useAtom(tokenLabelAtom)
  const [scopes, setScopes] = useAtom(tokenScopesAtom)
  const [tokens, setTokens] = useAtom(settingsTokensAtom)
  const [passkeys, setPasskeys] = useAtom(settingsPasskeysAtom)
  const [loading, setLoading] = useAtom(settingsLoadingAtom)
  const [saving, setSaving] = useAtom(settingsSavingAtom)
  const [newToken, setNewToken] = useAtom(settingsNewTokenAtom)
  const [removePasskey, setRemovePasskey] = useAtom(settingsRemovePasskeyAtom)
  const [passkeyBusy, setPasskeyBusy] = useAtom(settingsPasskeyBusyAtom)
  const [error, setError] = useAtom(settingsErrorAtom)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tokenResponse, passkeyResponse] = await Promise.all([
        fetch('/api/v1/tokens', { cache: 'no-store' }),
        fetch('/api/auth/passkeys', { cache: 'no-store' }),
      ])
      if (!tokenResponse.ok || !passkeyResponse.ok) throw new Error('loadFailed')
      setTokens(((await tokenResponse.json()) as { tokens: ApiToken[] }).tokens)
      setPasskeys(((await passkeyResponse.json()) as { passkeys: Passkey[] }).passkeys)
    } catch {
      setError(translate('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [translate, setError, setLoading, setPasskeys, setTokens])
  useEffect(() => {
    void load()
  }, [load])

  const createToken = async () => {
    if (!label.trim() || scopes.length === 0) return
    setSaving(true)
    try {
      const response = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), scopes }),
      })
      const payload = (await response.json()) as NewToken | { error?: string }
      if (!response.ok || !('token' in payload)) throw new Error('tokenCreateFailed')
      setNewToken(payload)
      setLabel('Home Assistant')
      await load()
      toast.success(translate('tokenCreated'))
    } catch {
      toast.error(translate('tokenCreateFailed'))
    } finally {
      setSaving(false)
    }
  }
  const revokeToken = async (token: ApiToken) => {
    try {
      const response = await fetch(`/api/v1/tokens/${token.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setTokens((current) => current.filter((item) => item.id !== token.id))
      toast.success(translate('tokenRevoked'))
    } catch {
      toast.error(translate('tokenRevokeFailed'))
    }
  }
  const registerPasskey = async () => {
    setPasskeyBusy(true)
    try {
      if (!window.PublicKeyCredential) throw new Error('passkeyUnsupported')
      const optionsResponse = await fetch('/api/auth/passkeys/register/options', { method: 'POST' })
      if (!optionsResponse.ok) throw new Error('passkeyRegisterFailed')
      const options = (await optionsResponse.json()) as PublicKeyCredentialCreationOptions & {
        challenge: string
        user: PublicKeyCredentialUserEntity
        excludeCredentials?: PublicKeyCredentialDescriptor[]
      }
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: fromBase64url(options.challenge),
          user: { ...options.user, id: fromBase64url(options.user.id as unknown as string) },
          excludeCredentials: options.excludeCredentials?.map((item) => ({ ...item, id: fromBase64url(item.id as unknown as string) })),
        },
      })
      if (!credential) throw new Error('passkeyRegisterFailed')
      const verifyResponse = await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(serialiseCredential(credential)),
      })
      if (!verifyResponse.ok) throw new Error('passkeyRegisterFailed')
      toast.success(translate('passkeyAdded'))
      await load()
    } catch (registrationError) {
      const code = registrationError instanceof Error ? registrationError.message : 'passkeyRegisterFailed'
      toast.error(translate.has(code) ? translate(code) : translate('passkeyRegisterFailed'))
    } finally {
      setPasskeyBusy(false)
    }
  }
  const deletePasskey = async () => {
    if (!removePasskey) return
    setPasskeyBusy(true)
    try {
      const response = await fetch(`/api/auth/passkeys/${removePasskey.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setPasskeys((current) => current.filter((item) => item.id !== removePasskey.id))
      setRemovePasskey(null)
      toast.success(translate('passkeyRemoved'))
    } catch {
      toast.error(translate('passkeyRemoveFailed'))
    } finally {
      setPasskeyBusy(false)
    }
  }
  const availableScopes = ['devices:read', 'devices:command', 'alerts:read', 'ota:install']
  return (
    <main className="sources-shell settings-shell">
      <ConsolePageHeader
        backLabel={translate('back')}
        eyebrow={translate('eyebrow')}
        icon={ShieldCheck}
        languageLabel={translate('language')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />
      {error && <Alert className="settings-alert" message={error} showIcon type="error" />}
      {loading ? (
        <Text>{translate('loading')}</Text>
      ) : (
        <Flexbox className="settings-sections" gap={28}>
          <section aria-labelledby="ha-token-heading">
            <Flexbox gap={4}>
              <h2 id="ha-token-heading">{translate('tokensTitle')}</h2>
              <Text type="secondary">{translate('tokensDescription')}</Text>
            </Flexbox>
            <Block className="settings-card" variant="outlined">
              <Flexbox className="settings-token-form" gap={10}>
                <label htmlFor="token-label">{translate('tokenLabel')}</label>
                <Input id="token-label" maxLength={128} value={label} onChange={(event) => setLabel(event.target.value)} />
                <Text type="secondary">{translate('scopeHint')}</Text>
                <Flexbox className="scope-list" gap={8}>
                  {availableScopes.map((scope) => (
                    <label className="scope-option" key={scope}>
                      <input
                        checked={scopes.includes(scope)}
                        type="checkbox"
                        onChange={(event) =>
                          setScopes((current) => (event.target.checked ? [...current, scope] : current.filter((item) => item !== scope)))
                        }
                      />
                      {translate(`scope_${scope.replace(':', '_')}`)}
                    </label>
                  ))}
                </Flexbox>
                <Button
                  disabled={!label.trim() || scopes.length === 0}
                  loading={saving}
                  icon={Plus}
                  onClick={() => void createToken()}
                  size="large"
                  type="primary"
                >
                  {translate('createToken')}
                </Button>
              </Flexbox>
              <Flexbox className="token-list" gap={10}>
                {tokens.length === 0 ? (
                  <Text type="secondary">{translate('noTokens')}</Text>
                ) : (
                  tokens.map((token) => (
                    <Block className="token-row" key={token.id} variant="outlined">
                      <Flexbox gap={5}>
                        <Flexbox horizontal align="center" justify="space-between" gap={12}>
                          <Text strong>{token.label}</Text>
                          <Button
                            aria-label={translate('revokeToken')}
                            icon={Trash2}
                            onClick={() => void revokeToken(token)}
                            size="large"
                            type="text"
                          />
                        </Flexbox>
                        <Text type="secondary">
                          {token.scopes.map((scope) => translate(`scope_${scope.replace(':', '_')}`)).join(' · ')}
                        </Text>
                        <Text type="secondary">{translate('created', { date: new Date(token.created_at).toLocaleString(locale) })}</Text>
                      </Flexbox>
                    </Block>
                  ))
                )}
              </Flexbox>
            </Block>
          </section>
          <section aria-labelledby="passkey-heading">
            <Flexbox gap={4}>
              <h2 id="passkey-heading">{translate('passkeysTitle')}</h2>
              <Text type="secondary">{translate('passkeysDescription')}</Text>
            </Flexbox>
            <Block className="settings-card" variant="outlined">
              <Flexbox horizontal align="center" justify="space-between" gap={16} wrap="wrap">
                <Flexbox horizontal align="center" gap={10}>
                  <KeyRound aria-hidden />
                  <Text>{translate('passkeyCount', { count: passkeys.length })}</Text>
                </Flexbox>
                <Button
                  disabled={passkeyBusy}
                  loading={passkeyBusy}
                  icon={Plus}
                  onClick={() => void registerPasskey()}
                  size="large"
                  type="primary"
                >
                  {translate('addPasskey')}
                </Button>
              </Flexbox>
              <Text type="secondary">{translate('passkeyHint')}</Text>
              {passkeys.length > 0 && (
                <Flexbox className="passkey-list" gap={8}>
                  {passkeys.map((passkey) => (
                    <Flexbox className="passkey-row" horizontal align="center" justify="space-between" gap={12} key={passkey.id}>
                      <Flexbox gap={3}>
                        <Text>{translate('passkeyName')}</Text>
                        <Text type="secondary">{translate('created', { date: new Date(passkey.created_at).toLocaleString(locale) })}</Text>
                      </Flexbox>
                      <Button
                        aria-label={translate('removePasskey')}
                        disabled={passkeyBusy}
                        icon={Trash2}
                        onClick={() => setRemovePasskey(passkey)}
                        size="large"
                        type="text"
                      />
                    </Flexbox>
                  ))}
                </Flexbox>
              )}
            </Block>
          </section>
        </Flexbox>
      )}
      <Modal
        cancelText={translate('cancel')}
        okButtonProps={{ danger: true, loading: passkeyBusy }}
        okText={translate('removePasskey')}
        onCancel={() => !passkeyBusy && setRemovePasskey(null)}
        onOk={() => void deletePasskey()}
        open={Boolean(removePasskey)}
        title={translate('removePasskeyTitle')}
      >
        <Text>{translate('removePasskeyDescription')}</Text>
      </Modal>
      <Modal
        cancelText={translate('close')}
        okText={translate('done')}
        onCancel={() => setNewToken(null)}
        onOk={() => setNewToken(null)}
        open={Boolean(newToken)}
        title={translate('tokenCreatedTitle')}
      >
        <Flexbox gap={12}>
          <Alert showIcon type="warning" message={translate('tokenOnlyShownOnce')} />
          <Input readOnly value={newToken?.token ?? ''} />
        </Flexbox>
      </Modal>
    </main>
  )
}
