import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from '@simplewebauthn/types'
import { and, eq, gt } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { passkeys, webauthnChallenges } from '@/server/database/schema'

const rpId = process.env.WEBAUTHN_RP_ID ?? 'localhost'
const rpName = 'ESP32 Glance Deck'
const origin = process.env.APP_URL ?? 'http://localhost:3000'

export const beginPasskeyRegistration = async (administrator: { id: string; email: string }) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const existing = await db.select().from(passkeys).where(eq(passkeys.administrator_id, administrator.id))
  const options = await generateRegistrationOptions({
    rpName: rpName,
    rpID: rpId,
    userName: administrator.email,
    userID: new TextEncoder().encode(administrator.id),
    attestationType: 'none',
    excludeCredentials: existing.map((key) => ({
      id: key.credential_id,
      transports: (key.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
  })

  await db.insert(webauthnChallenges).values({
    administrator_id: administrator.id,
    challenge: options.challenge,
    purpose: 'registration',
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  })
  return options
}

export const finishPasskeyRegistration = async (administratorId: string, response: RegistrationResponseJSON) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const [challenge] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.administrator_id, administratorId),
        eq(webauthnChallenges.purpose, 'registration'),
        gt(webauthnChallenges.expires_at, new Date()),
      ),
    )
    .orderBy(webauthnChallenges.created_at)
    .limit(1)
  if (!challenge) {
    throw new Error('challenge_expired')
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
  })
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('registration_not_verified')
  }

  const { credential } = verification.registrationInfo
  await db.insert(passkeys).values({
    administrator_id: administratorId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports,
  })
  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challenge.id))
  return verification.verified
}

export const beginPasskeyAuthentication = async () => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: 'preferred' })
  await db.insert(webauthnChallenges).values({
    administrator_id: null,
    challenge: options.challenge,
    purpose: 'authentication',
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  })
  return options
}

export const finishPasskeyAuthentication = async (response: AuthenticationResponseJSON) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const [credential] = await db.select().from(passkeys).where(eq(passkeys.credential_id, response.id)).limit(1)
  if (!credential) {
    throw new Error('credential_not_found')
  }

  const [challenge] = await db
    .select()
    .from(webauthnChallenges)
    .where(and(eq(webauthnChallenges.purpose, 'authentication'), gt(webauthnChallenges.expires_at, new Date())))
    .orderBy(webauthnChallenges.created_at)
    .limit(1)
  if (!challenge) {
    throw new Error('challenge_expired')
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    credential: {
      id: credential.credential_id,
      publicKey: Buffer.from(credential.public_key, 'base64url'),
      counter: credential.counter,
      transports: (credential.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    },
  })
  if (!verification.verified) {
    throw new Error('authentication_not_verified')
  }

  await db.transaction(async (transaction) => {
    await transaction.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, credential.id))
    await transaction.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challenge.id))
  })
  return credential.administrator_id
}
