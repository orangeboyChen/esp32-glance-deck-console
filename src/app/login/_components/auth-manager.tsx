'use client'

import { Alert, Block, Flexbox, Input, Text } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { KeyRound, LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Api } from '@/lib/api-client'
import type { JsonObject } from '@/lib/api-contracts'
import { toAuthenticatorTransports } from '@/lib/passkey'

import {
  loginBusyAtom,
  loginEmailAtom,
  loginErrorAtom,
  loginPasswordAtom,
  setupBusyAtom,
  setupEmailAtom,
  setupErrorAtom,
  setupPasswordAtom,
} from '@/app/login/_components/state'

const decodeBase64url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const encodeBase64url = (value: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export const LoginManager = () => {
  const translate = useTranslations('Auth')
  const router = useRouter()
  const [email, setEmail] = useAtom(loginEmailAtom)
  const [password, setPassword] = useAtom(loginPasswordAtom)
  const [busy, setBusy] = useAtom(loginBusyAtom)
  const [error, setError] = useAtom(loginErrorAtom)

  const finish = () => router.replace('/')
  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await Api.login({ email, password })
      finish()
    } catch (loginError) {
      setError(loginError instanceof Error ? translate(loginError.message as 'invalidCredentials') : translate('loginFailed'))
    } finally {
      setBusy(false)
    }
  }

  const passkeyLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('passkeyUnsupported')
      }
      const options = await Api.loginPasskeyOptions()
      const credential = (await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: decodeBase64url(options.challenge),
          allowCredentials: options.allowCredentials?.map((item) => ({
            ...item,
            id: decodeBase64url(item.id),
            transports: toAuthenticatorTransports(item.transports),
          })),
        },
      })) as PublicKeyCredential | null
      if (!credential) {
        throw new Error('loginFailed')
      }
      const response = credential.response as AuthenticatorAssertionResponse
      await Api.loginPasskeyVerify({
        id: credential.id,
        rawId: encodeBase64url(credential.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: encodeBase64url(response.clientDataJSON),
          authenticatorData: encodeBase64url(response.authenticatorData),
          signature: encodeBase64url(response.signature),
          userHandle: response.userHandle ? encodeBase64url(response.userHandle) : undefined,
        },
        clientExtensionResults: credential.getClientExtensionResults() as JsonObject,
      })
      finish()
    } catch (loginError) {
      setError(
        loginError instanceof Error ? translate(loginError.message as 'loginFailed' | 'passkeyUnsupported') : translate('loginFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <Block className="auth-card" variant="outlined">
        <Flexbox gap={10}>
          <Text className="eyebrow">
            <LogIn aria-hidden />
            Glance Deck
          </Text>
          <h1>{translate('loginTitle')}</h1>
          <Text type="secondary">{translate('loginDescription')}</Text>
        </Flexbox>
        {error && <Alert showIcon type="error" message={error} />}
        <form onSubmit={login}>
          <Flexbox gap={12}>
            <label htmlFor="login-email">{translate('email')}</label>
            <Input
              id="login-email"
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="login-password">{translate('password')}</label>
            <Input
              id="login-password"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button htmlType="submit" loading={busy} type="primary">
              {translate('login')}
            </Button>
          </Flexbox>
        </form>
        <Button icon={KeyRound} disabled={busy} onClick={() => void passkeyLogin()}>
          {translate('passkeyLogin')}
        </Button>
        <Button type="text" onClick={() => router.push('/setup')}>
          {translate('firstRunHint')}
        </Button>
      </Block>
    </main>
  )
}

export const SetupManager = () => {
  const translate = useTranslations('Auth')
  const router = useRouter()
  const [email, setEmail] = useAtom(setupEmailAtom)
  const [password, setPassword] = useAtom(setupPasswordAtom)
  const [busy, setBusy] = useAtom(setupBusyAtom)
  const [error, setError] = useAtom(setupErrorAtom)
  const setup = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await Api.setup({ email, password })
      router.replace('/')
    } catch (setupError) {
      setError(setupError instanceof Error ? translate(setupError.message as 'setupFailed') : translate('setupFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-shell">
      <Block className="auth-card" variant="outlined">
        <Text className="eyebrow">Glance Deck</Text>
        <h1>{translate('setupTitle')}</h1>
        <Text type="secondary">{translate('setupDescription')}</Text>
        {error && <Alert showIcon type="error" message={error} />}
        <form onSubmit={setup}>
          <Flexbox gap={12}>
            <label htmlFor="setup-email">{translate('email')}</label>
            <Input
              id="setup-email"
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="setup-password">{translate('password')}</label>
            <Input
              id="setup-password"
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button htmlType="submit" loading={busy} type="primary">
              {translate('createAdministrator')}
            </Button>
          </Flexbox>
        </form>
      </Block>
    </main>
  )
}
