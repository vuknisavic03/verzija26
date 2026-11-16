import { describe, expect, it } from 'vitest'

import { applyJobOfferUpload, applyJobOfferVerification, JobOfferError } from './jobOfferVerification.ts'

const now = new Date('2026-11-16T10:00:00Z')
const offered = { email: 'a@b.rs', jobApplicationStatus: 'ACCEPTED', paymentMethod: 'installments', status: 'job' }
const file = { fileName: 'job-offer.pdf', fileUrl: '/api/public/documents/upload?doc=7' }

describe('applyJobOfferUpload', () => {
  it('ide na proveru agencije i briše raniji razlog vraćanja', () => {
    const next = applyJobOfferUpload({ ...offered, jobOfferRejectionReason: 'fali potpis' }, file, { now })
    expect(next).toMatchObject({
      jobOfferFileName: 'job-offer.pdf',
      jobOfferRejectionReason: '',
      jobOfferUploadedAt: now.toISOString(),
      jobOfferUrl: file.fileUrl,
      jobOfferVerificationStatus: 'pending',
    })
  })

  it('kandidat ne može da okači pre nego što mu poslodavac ponudi posao', () => {
    expect(() => applyJobOfferUpload({ ...offered, jobApplicationStatus: 'SCHEDULED' }, file)).toThrow(JobOfferError)
  })

  it('kandidat ne menja odobren Job Offer, agencija može', () => {
    const approved = { ...offered, jobOfferVerificationStatus: 'approved' }
    expect(() => applyJobOfferUpload(approved, file)).toThrow(/već odobrila/)
    expect(applyJobOfferUpload(approved, file, { byAgency: true }).jobOfferVerificationStatus).toBe('pending')
  })
})

describe('applyJobOfferVerification', () => {
  const uploaded = applyJobOfferUpload(offered, file, { now })

  it('odobren Job Offer daje posao i otvara II ratu', () => {
    const next = applyJobOfferVerification(uploaded, { approved: true }, now)
    expect(next).toMatchObject({
      hasJob: true,
      jobOfferAccepted: true,
      jobOfferSignedAt: now.toISOString(),
      jobOfferVerificationStatus: 'approved',
      secondInstallmentDue: true,
      status: 'job',
    })
  })

  it('ako je program plaćen, odobrenje otvara Korak 3', () => {
    const next = applyJobOfferVerification({ ...uploaded, paymentMethod: 'now' }, { approved: true }, now)
    expect(next).toMatchObject({ ds2019Status: 'IN_PROGRESS', status: 'departure' })
  })

  it('vraćen Job Offer nosi razlog za kandidata', () => {
    const next = applyJobOfferVerification(uploaded, { approved: false, reason: 'Nema potpisa' }, now)
    expect(next).toMatchObject({
      hasJob: false,
      jobOfferAccepted: false,
      jobOfferRejectionReason: 'Nema potpisa',
      jobOfferVerificationStatus: 'rejected',
    })
  })

  it('ne može bez okačenog fajla', () => {
    expect(() => applyJobOfferVerification(offered, { approved: true })).toThrow(/još nije okačio/)
  })
})
