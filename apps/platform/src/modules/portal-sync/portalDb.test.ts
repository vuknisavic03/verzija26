import { randomBytes } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'

import { decryptFields, encryptFields } from './portalDb.ts'

beforeAll(() => {
  process.env.SENSITIVE_DATA_ACTIVE_KEY_ID = 'test-v1'
  process.env.SENSITIVE_DATA_ENCRYPTION_KEYS = `test-v1:${randomBytes(32).toString('base64')}`
  process.env.SENSITIVE_DATA_FINGERPRINT_KEY = randomBytes(32).toString('base64')
})

describe('portal record field encryption', () => {
  const record = {
    ds160: { passportNumber: 'P1234567' },
    email: 'marko@test.rs',
    guarantor: { idCardNumber: '111', jmbg: '0202970710000', name: 'Petar' },
    idCardNumber: '009988776',
    jmbg: '0101000710000',
    phone: '061',
  }

  it('stores identifiers only as ciphertext and leaves other fields readable', () => {
    const stored = encryptFields(record)
    const serialized = JSON.stringify(stored)
    for (const secret of ['0101000710000', '0202970710000', '009988776', 'P1234567']) {
      expect(serialized).not.toContain(secret)
    }
    expect(stored.email).toBe('marko@test.rs')
    expect(stored.phone).toBe('061')
  })

  it('round-trips to the original values', () => {
    expect(decryptFields(encryptFields(record))).toEqual(record)
  })

  it('skips empty values and leaves already-plain records untouched', () => {
    const empty = { email: 'a@b.rs', guarantor: null, jmbg: '' }
    expect(encryptFields(empty)).toEqual(empty)
    expect(decryptFields(record)).toEqual(record)
  })
})
