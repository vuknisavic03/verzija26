import { describe, expect, it } from 'vitest'

import {
  agencyNoticesFor,
  candidateNoticesFor,
  publicSiteUrl,
  renderAgencyNotice,
  renderCandidateNotice,
} from './portalNotificationRules.ts'

describe('portal notification rules', () => {
  it('notifies the candidate only when the agency changes something that concerns them', () => {
    expect(candidateNoticesFor({ documentsApproved: false }, { documentsApproved: true }).map((n) => n.kind)).toEqual([
      'documentsApproved',
    ])
    // Ponovno čuvanje istog stanja ne šalje ništa.
    expect(candidateNoticesFor({ documentsApproved: true }, { documentsApproved: true, notes: 'x' })).toEqual([])
    expect(
      candidateNoticesFor(
        { documentsVerificationStatus: 'pending' },
        { documentsRejectionReason: 'Fali pečat na uverenju.', documentsVerificationStatus: 'rejected' },
      ),
    ).toEqual([{ details: { reason: 'Fali pečat na uverenju.' }, kind: 'documentsRejected' }])
    expect(
      candidateNoticesFor(
        { jobApplicationStatus: 'APPLIED' },
        { contractApproved: true, jobApplicationStatus: 'ACCEPTED', selectedJobEmployer: 'Ocean Breeze', selectedJobTitle: 'Lifeguard' },
      ).map((n) => n.kind),
    ).toEqual(['contractApproved', 'jobOfferReady'])
    expect(candidateNoticesFor(null, { contractVerificationStatus: 'rejected' })[0]!.kind).toBe('contractRejected')
  })

  it('notifies the agency when a dossier is submitted or a payment is reported, once', () => {
    const submitted = { documentsSubmittedForReview: true, documentsVerificationStatus: 'pending' }
    expect(agencyNoticesFor({}, submitted).map((n) => n.kind)).toEqual(['dossierSubmitted'])
    expect(agencyNoticesFor(submitted, { ...submitted, cvFileName: 'cv.pdf' })).toEqual([])
    // Ponovo poslat posle vraćanja na dopunu.
    expect(agencyNoticesFor({ documentsSubmittedForReview: true, documentsVerificationStatus: 'rejected' }, submitted)).toHaveLength(1)

    expect(agencyNoticesFor({ secondInstallmentStatus: 'unpaid' }, { secondInstallmentStatus: 'pending' })).toEqual([
      { details: { installment: 'II rata' }, kind: 'paymentReported' },
    ])
    expect(agencyNoticesFor({ secondInstallmentStatus: 'pending' }, { secondInstallmentStatus: 'pending' })).toEqual([])
    expect(agencyNoticesFor({ secondInstallmentStatus: 'paid' }, { secondInstallmentStatus: 'pending' })).toEqual([])
  })

  it('renders branded messages in informal Serbian and escapes what the agency typed', () => {
    const message = renderCandidateNotice(
      { details: { reason: '<script>alert(1)</script> Fali "pečat"' }, kind: 'documentsRejected' },
      { firstName: 'Sara', portalUrl: 'https://workandtravel.rs/profil' },
    )
    expect(message.subject).toBe('Dosije treba dopuniti | American Adventure')
    expect(message.text).toContain('Zdravo Sara,')
    expect(message.text).toContain('https://workandtravel.rs/profil')
    expect(message.html).not.toContain('<script>')
    expect(message.html).toContain('&lt;script&gt;')
    expect(message.html).toContain('#fdd503')

    const paid = renderCandidateNotice(
      { details: { amount: '400', installment: '2. rata', invoiceNumber: 'FAKT-2026-0007' }, kind: 'paymentConfirmed' },
      { firstName: '', portalUrl: 'https://x/profil' },
    )
    expect(paid.subject).toContain('FAKT-2026-0007')
    expect(paid.text).toContain('Zdravo,')
    expect(paid.text).toContain('2. rata, 400 USD')

    const agency = renderAgencyNotice(
      { details: { installment: 'I rata' }, kind: 'paymentReported' },
      { adminUrl: 'https://x/admin', candidateEmail: 'sara@test.rs', candidateName: 'Sara Test' },
    )
    expect(agency.subject).toBe('Prijavljena uplata: Sara Test, I rata')
    expect(agency.text).toContain('sara@test.rs')
  })

  it('links to the public site, not the backend', () => {
    expect(publicSiteUrl({ NEXT_PUBLIC_SERVER_URL: 'https://api.up.railway.app', PUBLIC_SITE_ORIGINS: 'https://workandtravel.rs, https://www.workandtravel.rs' })).toBe(
      'https://workandtravel.rs',
    )
    expect(publicSiteUrl({ PUBLIC_SITE_ORIGINS: 'https://a.rs', PUBLIC_SITE_URL: 'https://b.rs/' })).toBe('https://b.rs')
    expect(publicSiteUrl({ NEXT_PUBLIC_SERVER_URL: 'https://api.up.railway.app/' })).toBe('https://api.up.railway.app')
  })
})
