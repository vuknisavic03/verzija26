import { TRANSLATION_DOCS } from './portalTranslationRules.ts'

type Candidate = Record<string, unknown>

export type RemovableDocument = 'cv' | 'facultyCert' | 'policeCert' | 'signedContract'

export class DocumentRemovalError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message)
  }
}

const FIELDS: Record<RemovableDocument, { label: string; prefix: string }> = {
  cv: { label: 'CV', prefix: 'cv' },
  facultyCert: { label: 'Uverenje o studiranju', prefix: 'facultyCert' },
  policeCert: { label: 'Uverenje o nekažnjavanju', prefix: 'policeCertificate' },
  signedContract: { label: 'Potpisan ugovor', prefix: 'signedContract' },
}

export function isRemovableDocument(value: string): value is RemovableDocument {
  return value in FIELDS
}

/** Dosije je predat ili odobren: fajlovi se ne menjaju dok traje provera. */
function dossierLocked(candidate: Candidate) {
  const status = String(candidate.documentsVerificationStatus || '')
  if (candidate.documentsApproved === true || status === 'approved') return true
  if (status === 'rejected' || candidate.documentsRejectionReason) return false
  return status === 'pending' || candidate.documentsSubmittedForReview === true
}

/**
 * Kandidat briše dokument koji je okačio. Vraća zapis bez dokumenta i link uklonjenog fajla.
 * Uz uverenje se briše i njegov prevod (prevod pripada tačno tom originalu).
 */
export function removeCandidateDocument(candidate: Candidate, type: RemovableDocument) {
  const { label, prefix } = FIELDS[type]
  const url = String(candidate[`${prefix}Url`] || '')
  if (!candidate[`${prefix}FileName`] && !url) {
    throw new DocumentRemovalError(`${label} nije okačen.`, 404)
  }
  if (type === 'signedContract') {
    if (candidate.contractApproved === true || candidate.contractVerificationStatus === 'approved') {
      throw new DocumentRemovalError('Agencija je već overila ugovor, pa ne može da se obriše. Javi se agenciji.', 409)
    }
    const installment = String(candidate.firstInstallmentStatus || '')
    if (candidate.firstInstallmentApproved === true || installment === 'pending' || installment === 'paid') {
      throw new DocumentRemovalError('Uplata je već prijavljena, pa ugovor ne može da se obriše. Okači novi ako treba.', 409)
    }
  } else if (dossierLocked(candidate)) {
    throw new DocumentRemovalError('Dosije je predat na pregled, pa se dokumenta ne menjaju dok traje provera.', 409)
  }

  const next: Candidate = {
    ...candidate,
    [`${prefix}DataUrl`]: undefined,
    [`${prefix}FileName`]: '',
    [`${prefix}UploadedAt`]: '',
    [`${prefix}Url`]: '',
  }
  if (type === 'facultyCert' || type === 'policeCert') {
    const doc = TRANSLATION_DOCS[type === 'facultyCert' ? 'faculty' : 'police']
    next[doc.field] = null
    next[doc.flag] = false
  }
  if (type === 'signedContract') {
    Object.assign(next, { contractRejectionReason: '', contractSigned: false, contractVerificationStatus: '' })
  }
  return { label, next, url }
}

/** ID dokumenta iz linka `/api/public/documents/upload?doc=<id>`. */
export function documentIdFromUrl(url: string) {
  const match = /[?&]doc=(\d+)/.exec(url)
  return match ? match[1]! : null
}
