import { describe, expect, it } from 'vitest'

import { sanitizeCandidateUpdate } from './candidateFields.ts'
import { acceptOrGenerateInvitationCode, generateInvitationCode } from './invitationCode.ts'

describe('sanitizeCandidateUpdate', () => {
  const existing = {
    discount: 100,
    email: 'marko@test.rs',
    finalPrice: 1750,
    firstInstallmentStatus: 'paid',
    id: 'cand-1',
    phone: '061',
    secondInstallmentStatus: undefined,
  }

  it('keeps agency-only fields from the server record', () => {
    const clean = sanitizeCandidateUpdate(
      { contractApproved: true, discount: 1849, documentsVerificationStatus: 'approved', finalPrice: 1, phone: '064' },
      existing,
      'marko@test.rs',
    )
    expect(clean.finalPrice).toBe(1750)
    expect(clean.discount).toBe(100)
    expect(clean.contractApproved).toBeUndefined()
    expect(clean.documentsVerificationStatus).toBeUndefined()
    expect(clean.phone).toBe('064')
  })

  it('lets a candidate report a payment but never confirm one', () => {
    const clean = sanitizeCandidateUpdate(
      { firstInstallmentStatus: 'pending', secondInstallmentStatus: 'pending', thirdInstallmentStatus: 'paid' },
      existing,
      'marko@test.rs',
    )
    expect(clean.firstInstallmentStatus).toBe('paid')
    expect(clean.secondInstallmentStatus).toBe('pending')
    expect(clean.thirdInstallmentStatus).toBeUndefined()
  })

  it('never lets a candidate mark the contract as signed', () => {
    const clean = sanitizeCandidateUpdate(
      { contractAcceptance: { reference: 'x' }, contractSigned: true, contractSignedReference: 'AA-FAKE' },
      existing,
      'marko@test.rs',
    )
    expect(clean.contractSigned).toBeUndefined()
    expect(clean.contractAcceptance).toBeUndefined()
    expect(clean.contractSignedReference).toBeUndefined()
  })

  it('always binds the record to the signed-in email and existing id', () => {
    const clean = sanitizeCandidateUpdate({ email: 'drugi@test.rs', id: 'cand-2' }, existing, 'marko@test.rs')
    expect(clean.email).toBe('marko@test.rs')
    expect(clean.id).toBe('cand-1')
  })
})

describe('invitation codes', () => {
  it('generates AA-XXXX-XXXX codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) expect(generateInvitationCode()).toMatch(/^AA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  })

  it('keeps a strong proposed code and replaces a weak one', () => {
    expect(acceptOrGenerateInvitationCode('aa-abcd-efgh')).toBe('AA-ABCD-EFGH')
    expect(acceptOrGenerateInvitationCode('WT-1234')).not.toBe('WT-1234')
  })
})
