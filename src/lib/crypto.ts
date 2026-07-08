/**
 * AES-256-GCM encryption for sensitive fields (API keys) at rest.
 * Key derived from PAYLOAD_SECRET via PBKDF2 — no separate key needed.
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const SALT = 'healthylifestyles-ai-keys-v1' // stable salt (not for passwords)

function getKey(): Buffer {
  const secret = process.env.PAYLOAD_SECRET || 'fallback-dev-only-secret'
  return pbkdf2Sync(secret, SALT, 100_000, KEY_LEN, 'sha256')
}

const PREFIX = 'enc:'

/** Encrypt a plaintext string → `enc:<iv><tag><ciphertext>` (all hex). */
export function encryptField(plaintext: string): string {
  if (!plaintext || plaintext.startsWith(PREFIX)) return plaintext
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + iv.toString('hex') + tag.toString('hex') + enc.toString('hex')
}

/** Decrypt an encrypted string back to plaintext. Returns '••••' on failure. */
export function decryptField(encrypted: string): string {
  if (!encrypted || !encrypted.startsWith(PREFIX)) return encrypted
  try {
    const raw = encrypted.slice(PREFIX.length)
    const iv = Buffer.from(raw.slice(0, IV_LEN * 2), 'hex')
    const tag = Buffer.from(raw.slice(IV_LEN * 2, (IV_LEN + TAG_LEN) * 2), 'hex')
    const data = Buffer.from(raw.slice((IV_LEN + TAG_LEN) * 2), 'hex')
    const decipher = createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return '••••'
  }
}
