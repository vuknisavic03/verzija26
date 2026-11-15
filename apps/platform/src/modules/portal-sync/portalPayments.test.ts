import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeAccount18,
  parseInstallment,
  portalInstallmentAmounts,
  portalPaymentInstructions,
  portalPaymentReference,
} from './portalPaymentRules.ts'

function mod97Valid(reference: string) {
  // ISO 7064 MOD 97-10: kontrolne cifre na početku; (broj + kontrolne) mod 97 === 1
  const digits = reference.slice(2) + reference.slice(0, 2)
  let r = 0
  for (const d of digits) r = (r * 10 + Number(d)) % 97
  return r === 1
}

const candidate = { email: 'sara@test.rs', finalPrice: 1750, firstName: 'Sara', lastName: 'Test', address: 'Knez Mihailova 1', paymentMethod: 'installments' }

afterEach(() => vi.unstubAllGlobals())

describe('portal payments', () => {
  it('splits the invitation price into installments without inventing a price', () => {
    expect(portalInstallmentAmounts(candidate)).toMatchObject({ '1': 250, '2': 400, '3': 1100, FULL: 1750 })
    expect(() => portalInstallmentAmounts({ email: 'x@y.rs' })).toThrow()
  })

  it('parses installments strictly', () => {
    expect(parseInstallment(1)).toBe('1')
    expect(parseInstallment('full')).toBe('FULL')
    expect(parseInstallment('4')).toBeNull()
  })

  it('builds model 97 references with valid control digits, stable per candidate and installment', () => {
    for (const inst of ['1', '2', '3', 'FULL'] as const) {
      const ref = portalPaymentReference('sara@test.rs', inst)
      expect(mod97Valid(ref)).toBe(true)
      expect(portalPaymentReference('SARA@test.rs', inst)).toBe(ref)
    }
    expect(portalPaymentReference('sara@test.rs', '1')).not.toBe(portalPaymentReference('sara@test.rs', '2'))
  })

  it('expands short account numbers to the 18 digits NBS IPS expects', () => {
    expect(normalizeAccount18('340-11015676-26')).toBe('340000001101567626')
    expect(normalizeAccount18('160-6000000728717-84')).toBe('160600000072871784')
  })

  it('returns USD amount, RSD estimate and a locally rendered IPS QR when the NBS rate is known', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ exchange_middle: 101.2345 }), { status: 200 })))
    const result = await portalPaymentInstructions(candidate, '1', new Date('2026-11-15T10:00:00Z'))
    expect(result.amountUsd).toBe(250)
    expect(result.amountRsd).toBe(25308.63)
    expect(result.recipientAccount).toBe('160-6000000728717-84')
    expect(result.ipsPayload).toContain('R:160600000072871784')
    expect(result.ipsPayload).toContain('I:RSD25308,63')
    expect(result.qrSvg).toMatch(/^<svg/)
  })

  it('omits the RSD amount and QR instead of guessing when the rate is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))
    const result = await portalPaymentInstructions({ ...candidate, email: 'other@test.rs' }, '2', new Date('2026-11-16T10:00:00Z'))
    expect(result.amountUsd).toBe(400)
    expect(result.amountRsd).toBeNull()
    expect(result.qrSvg).toBeNull()
  })
})
