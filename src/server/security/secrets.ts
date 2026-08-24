import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const algorithm = 'aes-256-gcm'

const encryptionKey = () => {
  const encoded = process.env.APP_MASTER_KEY
  if (!encoded) {
    throw new Error('app_master_key_missing')
  }
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32) {
    throw new Error('app_master_key_invalid')
  }
  return key
}

export const encryptSecret = (value: Record<string, string>) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export const decryptSecret = (value: string): Record<string, string> => {
  const [ivEncoded, tagEncoded, contentEncoded] = value.split('.')
  if (!ivEncoded || !tagEncoded || !contentEncoded) {
    throw new Error('secret_ciphertext_invalid')
  }
  const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  const plain = Buffer.concat([decipher.update(Buffer.from(contentEncoded, 'base64url')), decipher.final()]).toString('utf8')
  const decoded: unknown = JSON.parse(plain)
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    Array.isArray(decoded) ||
    Object.values(decoded).some((item) => typeof item !== 'string')
  ) {
    throw new Error('secret_value_invalid')
  }
  return decoded as Record<string, string>
}
