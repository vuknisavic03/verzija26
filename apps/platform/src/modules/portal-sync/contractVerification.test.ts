import { describe, expect, it } from 'vitest'

import { applyContractVerification, ContractVerificationError } from './contractVerification.ts'

const now = new Date('2026-11-16T12:00:00Z')
const uploaded = { email: 'a@test.rs', signedContractFileName: 'ugovor.pdf', status: 'review' }

describe('applyContractVerification', () => {
  it('rejects with a reason the candidate sees', () => {
    const out = applyContractVerification(uploaded, { approved: false, reason: 'Fali potpis na 3. strani' }, now)
    expect(out).toMatchObject({
      contractApproved: false,
      contractRejectionReason: 'Fali potpis na 3. strani',
      contractVerificationStatus: 'rejected',
      status: 'review',
    })
  })

  it('approves and moves to documents when the first installment is paid', () => {
    expect(applyContractVerification({ ...uploaded, firstInstallmentApproved: true }, { approved: true }, now)).toMatchObject({
      contractApproved: true,
      contractRejectionReason: '',
      contractVerificationStatus: 'approved',
      status: 'docs',
    })
    expect(applyContractVerification(uploaded, { approved: true }, now).status).toBe('review')
  })

  it('sends a later-stage candidate back to registration on rejection', () => {
    expect(applyContractVerification({ ...uploaded, status: 'docs' }, { approved: false }, now).status).toBe('review')
  })

  it('refuses when no signed contract was uploaded', () => {
    expect(() => applyContractVerification({ email: 'a@test.rs' }, { approved: true }, now)).toThrow(ContractVerificationError)
  })
})
