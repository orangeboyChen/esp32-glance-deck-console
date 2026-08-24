import { createHash, randomBytes, randomInt } from 'node:crypto'

import { and, eq, gt, isNull } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { decryptSecret, encryptSecret } from '@/server/security/secrets'
import { deviceEnrollmentRequests, devices } from '@/server/database/schema'

const codeHash = (value: string) => createHash('sha256').update(value).digest('hex')

export const createPairingCode = () => {
  return String(randomInt(100000, 1_000_000))
}

export const validClaimSecret = (value: string) => {
  return /^[a-f0-9]{64}$/.test(value)
}

export const announceEnrollment = async (pairingCode: string, claimSecret: string, boardModel: 'ESP32-S3-RLCD-4.2') => {
  if (!db) throw new Error('database_unavailable')
  if (!/^\d{6}$/.test(pairingCode) || !validClaimSecret(claimSecret)) throw new Error('invalid_enrollment_request')
  const pairingCodeHash = codeHash(pairingCode)
  const claimSecretHash = codeHash(claimSecret)
  const [existing] = await db
    .select()
    .from(deviceEnrollmentRequests)
    .where(eq(deviceEnrollmentRequests.pairing_code_hash, pairingCodeHash))
    .limit(1)
  if (existing && existing.expires_at > new Date()) {
    if (existing.claim_secret_hash !== claimSecretHash || existing.board_model !== boardModel) throw new Error('pairing_code_in_use')
    return { expires_at: existing.expires_at, status: existing.claimed_device_id ? 'approved' : 'pending' }
  }
  if (existing) await db.delete(deviceEnrollmentRequests).where(eq(deviceEnrollmentRequests.id, existing.id))
  const [request] = await db
    .insert(deviceEnrollmentRequests)
    .values({
      pairing_code_hash: pairingCodeHash,
      claim_secret_hash: claimSecretHash,
      board_model: boardModel,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    })
    .returning({ expires_at: deviceEnrollmentRequests.expires_at })
  return { expires_at: request.expires_at, status: 'pending' }
}

export const approveEnrollment = async (name: string, pairingCode: string, boardModel: 'ESP32-S3-RLCD-4.2') => {
  if (!db) throw new Error('database_unavailable')
  const [request] = await db
    .select()
    .from(deviceEnrollmentRequests)
    .where(
      and(
        eq(deviceEnrollmentRequests.pairing_code_hash, codeHash(pairingCode)),
        gt(deviceEnrollmentRequests.expires_at, new Date()),
        isNull(deviceEnrollmentRequests.claimed_device_id),
      ),
    )
    .limit(1)
  if (!request || request.board_model !== boardModel) throw new Error('pairing_code_invalid_or_expired')
  const deviceId = `deck-${randomBytes(6).toString('hex')}`
  const mqttPassword = randomBytes(32).toString('base64url')
  await db.transaction(async (transaction) => {
    await transaction.insert(devices).values({
      id: deviceId,
      name,
      board_model: boardModel,
      status: 'enrolling',
      mqtt_username: deviceId,
      mqtt_password_ciphertext: encryptSecret({ mqtt_password: mqttPassword }),
    })
    await transaction
      .update(deviceEnrollmentRequests)
      .set({ claimed_device_id: deviceId })
      .where(and(eq(deviceEnrollmentRequests.id, request.id), isNull(deviceEnrollmentRequests.claimed_device_id)))
  })
  return { device_id: deviceId, name, status: 'approved' }
}

export const claimEnrollment = async (pairingCode: string, claimSecret: string) => {
  if (!db) throw new Error('database_unavailable')
  const [request] = await db
    .select()
    .from(deviceEnrollmentRequests)
    .where(
      and(
        eq(deviceEnrollmentRequests.pairing_code_hash, codeHash(pairingCode)),
        eq(deviceEnrollmentRequests.claim_secret_hash, codeHash(claimSecret)),
        gt(deviceEnrollmentRequests.expires_at, new Date()),
      ),
    )
    .limit(1)
  if (!request) throw new Error('pairing_code_invalid_or_expired')
  if (!request.claimed_device_id) return { status: 'pending' as const }
  const [device] = await db.select().from(devices).where(eq(devices.id, request.claimed_device_id)).limit(1)
  if (!device?.mqtt_password_ciphertext || !device.mqtt_username) throw new Error('enrollment_credentials_unavailable')
  const { mqtt_password: mqttPassword } = decryptSecret(device.mqtt_password_ciphertext)
  await db.update(devices).set({ status: 'offline' }).where(eq(devices.id, device.id))
  return {
    status: 'claimed' as const,
    device_id: device.id,
    mqtt: {
      broker_url: process.env.DEVICE_MQTT_URL ?? 'mqtts://mqtt.example.invalid',
      username: device.mqtt_username,
      password: mqttPassword,
    },
  }
}
