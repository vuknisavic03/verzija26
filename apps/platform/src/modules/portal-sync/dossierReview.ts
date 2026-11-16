import { noTranslationState, readTranslation, translationAccepted, translationApproved } from './portalTranslationRules.ts'

type Candidate = Record<string, unknown>

export class DossierError extends Error {
  constructor(message: string, readonly status: 409) {
    super(message)
  }
}

const day = (now: Date) => now.toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade' })
const appendNote = (candidate: Candidate, line: string) => {
  const notes = String(candidate.notes || '')
  return notes ? `${notes}\n${line}` : line
}

/** Prevod je spreman za slanje: kandidat ga je potvrdio uz original ili ga je agencija odobrila. */
const translationReady = (candidate: Candidate, doc: 'faculty' | 'police') =>
  translationAccepted(readTranslation(candidate, doc)) || noTranslationState(candidate, doc) !== ''

/** Za odobrenje dosijea: prevod koji je agencija odobrila, ili uverenje odobreno bez prevoda. */
const translationCleared = (candidate: Candidate, doc: 'faculty' | 'police') =>
  translationApproved(readTranslation(candidate, doc)) || noTranslationState(candidate, doc) === 'approved'

/** Šta još fali za slanje dosijea (prazno = može da se pošalje). */
export function dossierMissing(candidate: Candidate) {
  const missing: string[] = []
  if (!String(candidate.youtubeUrl || '').trim()) missing.push('video predstavljanje')
  if (!candidate.cvFileName && !candidate.cvUrl) missing.push('CV')
  if (!candidate.facultyCertFileName && !candidate.facultyCertUrl) missing.push('uverenje o studiranju')
  else if (!translationReady(candidate, 'faculty')) missing.push('potvrđen prevod uverenja o studiranju')
  if (!candidate.policeCertificateFileName && !candidate.policeCertificateUrl) missing.push('MUP uverenje')
  else if (!translationReady(candidate, 'police')) missing.push('potvrđen prevod MUP uverenja')
  return missing
}

export function dossierSubmitted(candidate: Candidate) {
  return candidate.documentsVerificationStatus === 'pending' && candidate.documentsSubmittedForReview === true
}

/** Kandidat šalje dosije (prvi put ili posle vraćanja na dopunu). */
export function submitDossier(candidate: Candidate, now = new Date()): Candidate {
  if (candidate.documentsApproved === true || candidate.documentsVerificationStatus === 'approved') {
    throw new DossierError('Dosije je već odobren.', 409)
  }
  if (dossierSubmitted(candidate)) throw new DossierError('Dosije je već poslat i čeka pregled.', 409)
  const contractOk = candidate.contractApproved === true || candidate.contractVerificationStatus === 'approved'
  const firstPaid = candidate.firstInstallmentApproved === true || candidate.firstInstallmentStatus === 'paid'
  if (!contractOk || !firstPaid) {
    throw new DossierError('Dosije se šalje kad agencija overi ugovor i proknjiži prvu ratu.', 409)
  }
  const missing = dossierMissing(candidate)
  if (missing.length) throw new DossierError(`Pre slanja nedostaje: ${missing.join(', ')}.`, 409)
  const resubmit = candidate.documentsVerificationStatus === 'rejected' || Boolean(candidate.documentsRejectionReason)
  return {
    ...candidate,
    documentsApproved: false,
    documentsRejectedAt: null,
    documentsRejectionReason: '',
    documentsSubmittedAt: now.toISOString(),
    documentsSubmittedForReview: true,
    documentsVerificationStatus: 'pending',
    notes: appendNote(
      candidate,
      resubmit
        ? `[${day(now)}]: Kandidat je dopunio dosije i poslao ga na ponovni pregled.`
        : `[${day(now)}]: Kandidat je poslao kompletan dosije (video, CV, oba uverenja sa prevodom).`,
    ),
    status: String(candidate.status || '') === 'review' ? 'docs' : candidate.status,
  }
}

/** Agencija odobrava ili vraća dosije. Odobrenje traži oba prevoda koja je agencija odobrila. */
export function reviewDossier(candidate: Candidate, input: { approved: boolean; reason?: string }, now = new Date()): Candidate {
  if (input.approved) {
    const files = !(candidate.cvFileName || candidate.cvUrl)
      ? 'CV'
      : !(candidate.facultyCertFileName || candidate.facultyCertUrl)
        ? 'uverenje o studiranju'
        : !(candidate.policeCertificateFileName || candidate.policeCertificateUrl)
          ? 'MUP uverenje'
          : ''
    if (files) throw new DossierError(`Dosije ne može da se odobri: nedostaje ${files}.`, 409)
    const pending = (['faculty', 'police'] as const).filter((doc) => !translationCleared(candidate, doc))
    if (pending.length) {
      const names = pending.map((doc) => (doc === 'faculty' ? 'uverenja o studiranju' : 'MUP uverenja'))
      throw new DossierError(
        `Prvo odobri prevod ${names.join(' i ')}, ili „Odobri bez prevoda" ako je uverenje već na engleskom.`,
        409,
      )
    }
    return {
      ...candidate,
      documentsApproved: true,
      documentsRejectionReason: '',
      documentsSubmittedForReview: false,
      documentsVerificationStatus: 'approved',
      documentsVerifiedAt: now.toISOString(),
      notes: appendNote(candidate, `[${day(now)}]: Dosije odobren. Kandidat prelazi na Korak 2: Posao i ponuda.`),
      status: 'job',
    }
  }
  const reason = String(input.reason || '').trim().slice(0, 500) || 'Dokumentacija nije kompletna ili čitljiva.'
  return {
    ...candidate,
    documentsApproved: false,
    documentsRejectedAt: now.toISOString(),
    documentsRejectionReason: reason,
    documentsSubmittedForReview: false,
    documentsVerificationStatus: 'rejected',
    documentsVerifiedAt: now.toISOString(),
    notes: appendNote(candidate, `[${day(now)}]: Dosije vraćen na dopunu (${reason}).`),
    status: candidate.status === 'job' ? 'docs' : candidate.status,
  }
}
