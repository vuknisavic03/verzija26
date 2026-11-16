import { describe, expect, it } from 'vitest'

import { DocumentRemovalError, documentIdFromUrl, removeCandidateDocument } from './portalDocumentRemoval.ts'

const base = {
  cvFileName: 'cv.pdf',
  cvUrl: '/api/public/documents/upload?doc=12',
  email: 'a@test.rs',
  facultyCertAiTranslation: true,
  facultyCertFileName: 'uverenje.pdf',
  facultyCertTranslation: { status: 'approved' },
  facultyCertUrl: '/api/public/documents/upload?doc=13',
  signedContractFileName: 'ugovor.pdf',
  signedContractUrl: '/api/public/documents/upload?doc=14',
  contractSigned: true,
  contractVerificationStatus: 'pending',
}

describe('removeCandidateDocument', () => {
  it('removes the CV and returns its link', () => {
    const { next, url } = removeCandidateDocument(base, 'cv')
    expect(next).toMatchObject({ cvFileName: '', cvUrl: '' })
    expect(documentIdFromUrl(url)).toBe('12')
  })

  it('removes the translation together with the certificate', () => {
    const { next } = removeCandidateDocument(base, 'facultyCert')
    expect(next).toMatchObject({ facultyCertAiTranslation: false, facultyCertFileName: '', facultyCertTranslation: null })
  })

  it('locks documents while the dossier is under review, and unlocks after it is returned', () => {
    expect(() => removeCandidateDocument({ ...base, documentsVerificationStatus: 'pending' }, 'cv')).toThrow(DocumentRemovalError)
    expect(() => removeCandidateDocument({ ...base, documentsApproved: true }, 'cv')).toThrow(DocumentRemovalError)
    expect(removeCandidateDocument({ ...base, documentsVerificationStatus: 'rejected' }, 'cv').next.cvFileName).toBe('')
  })

  it('removes a signed contract only before approval and before a payment is reported', () => {
    expect(removeCandidateDocument(base, 'signedContract').next).toMatchObject({
      contractSigned: false,
      contractVerificationStatus: '',
      signedContractFileName: '',
    })
    expect(() => removeCandidateDocument({ ...base, contractApproved: true }, 'signedContract')).toThrow(DocumentRemovalError)
    expect(() => removeCandidateDocument({ ...base, firstInstallmentStatus: 'pending' }, 'signedContract')).toThrow(
      DocumentRemovalError,
    )
  })

  it('reports a missing document', () => {
    expect(() => removeCandidateDocument({ email: 'a@test.rs' }, 'cv')).toThrow('CV nije okačen.')
  })
})
