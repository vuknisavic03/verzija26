import { describe, expect, it } from 'vitest'

import { DossierError, dossierMissing, reviewDossier, submitDossier } from './dossierReview.ts'

const now = new Date('2026-11-16T12:00:00Z')
const ready = { candidateConfirmedAt: '2026-11-16T10:00:00Z', status: 'ready' }
const approved = { status: 'approved' }
const complete = {
  contractApproved: true,
  cvFileName: 'cv.pdf',
  firstInstallmentApproved: true,
  email: 'a@test.rs',
  facultyCertFileName: 'f.pdf',
  facultyCertTranslation: ready,
  policeCertTranslation: ready,
  policeCertificateFileName: 'p.pdf',
  status: 'docs',
  youtubeUrl: 'https://youtu.be/x',
}

describe('dossier', () => {
  it('lists what is missing before submission', () => {
    expect(dossierMissing({ email: 'a@test.rs', facultyCertFileName: 'f.pdf' })).toEqual([
      'video predstavljanje',
      'CV',
      'potvrđen prevod uverenja o studiranju',
      'MUP uverenje',
    ])
    expect(() => submitDossier({ ...complete, cvFileName: '' }, now)).toThrow(DossierError)
  })

  it('waits for the approved contract and the first installment', () => {
    expect(() => submitDossier({ ...complete, firstInstallmentApproved: false }, now)).toThrow('prvu ratu')
  })

  it('submits once and can resubmit after being returned', () => {
    const sent = submitDossier(complete, now)
    expect(sent).toMatchObject({ documentsSubmittedForReview: true, documentsVerificationStatus: 'pending' })
    expect(() => submitDossier(sent, now)).toThrow('već poslat')
    const returned = reviewDossier(sent, { approved: false, reason: 'MUP uverenje je staro' }, now)
    expect(returned).toMatchObject({ documentsRejectionReason: 'MUP uverenje je staro', documentsSubmittedForReview: false })
    expect(submitDossier(returned, now)).toMatchObject({ documentsRejectionReason: '', documentsVerificationStatus: 'pending' })
  })

  it('approves only when the agency approved both translations', () => {
    const sent = submitDossier(complete, now)
    expect(() => reviewDossier(sent, { approved: true }, now)).toThrow('Prvo odobri prevod')
    const out = reviewDossier({ ...sent, facultyCertTranslation: approved, policeCertTranslation: approved }, { approved: true }, now)
    expect(out).toMatchObject({ documentsApproved: true, documentsVerificationStatus: 'approved', status: 'job' })
  })

  it('accepts a certificate the candidate reports as already in English, approved by the agency', () => {
    const declared = { ...complete, policeCertNoTranslation: 'requested', policeCertTranslation: null }
    const sent = submitDossier(declared, now)
    const withFaculty = { ...sent, facultyCertTranslation: approved }
    expect(() => reviewDossier(withFaculty, { approved: true }, now)).toThrow('Odobri bez prevoda')
    expect(reviewDossier({ ...withFaculty, policeCertNoTranslation: 'approved' }, { approved: true }, now)).toMatchObject({
      documentsApproved: true,
    })
  })
})
