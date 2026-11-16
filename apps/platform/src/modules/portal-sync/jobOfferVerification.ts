/**
 * Job Offer: poslodavac ga šalje, kandidat ga potpisuje van portala i okači skeniran.
 * Agencija ga samo proverava (odobri ili vrati), zajedno sa ostalim dokumentima.
 * Bez baze i mreže, da bi pravila bila testirana.
 */

type Candidate = Record<string, unknown>

export class JobOfferError extends Error {
  constructor(message: string, readonly status: 404 | 409) {
    super(message)
  }
}

const DEFAULT_REASON = 'Job Offer nije ispravno potpisan. Okači ga ponovo.'

export function jobOfferApproved(candidate: Candidate) {
  return candidate.jobOfferVerificationStatus === 'approved'
}

function logLine(candidate: Candidate, now: Date, text: string) {
  const day = now.toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade' })
  const notes = String(candidate.notes || '')
  const line = `[${day}]: ${text}`
  return notes ? `${notes}\n${line}` : line
}

/** Kandidat (ili agencija umesto njega) okači potpisan Job Offer. Uvek ide na proveru agencije. */
export function applyJobOfferUpload(
  candidate: Candidate,
  file: { fileName: string; fileUrl: string },
  options: { byAgency?: boolean; now?: Date } = {},
): Candidate {
  const now = options.now || new Date()
  if (!options.byAgency) {
    if (candidate.jobApplicationStatus !== 'ACCEPTED') {
      throw new JobOfferError('Job Offer okačiš kad ti poslodavac posle intervjua ponudi posao.', 409)
    }
    if (jobOfferApproved(candidate)) {
      throw new JobOfferError('Agencija je već odobrila tvoj Job Offer. Za izmenu se javi agenciji.', 409)
    }
  }
  return {
    ...candidate,
    jobOfferDataUrl: undefined,
    jobOfferFileName: file.fileName,
    jobOfferRejectedAt: null,
    jobOfferRejectionReason: '',
    jobOfferUploadedAt: now.toISOString(),
    jobOfferUrl: file.fileUrl,
    jobOfferVerificationStatus: 'pending',
  }
}

/**
 * Agencija odobrava ili vraća potpisan Job Offer. Odobren Job Offer znači da kandidat ima posao:
 * otvara se II rata, a ako je program već plaćen, i Korak 3.
 */
export function applyJobOfferVerification(
  candidate: Candidate,
  input: { approved: boolean; reason?: string },
  now = new Date(),
): Candidate {
  if (!candidate.jobOfferFileName && !candidate.jobOfferUrl) {
    throw new JobOfferError('Kandidat još nije okačio potpisan Job Offer.', 409)
  }
  const at = now.toISOString()
  if (input.approved) {
    const paid =
      candidate.paymentMethod === 'now' ||
      candidate.isFullPaymentPaid === true ||
      candidate.secondInstallmentStatus === 'paid'
    const status = String(candidate.status || '')
    return {
      ...candidate,
      hasJob: true,
      jobApplicationStatus: 'ACCEPTED',
      jobOfferAccepted: true,
      jobOfferRejectedAt: null,
      jobOfferRejectionReason: '',
      jobOfferSignedAt: candidate.jobOfferUploadedAt || at,
      jobOfferVerificationStatus: 'approved',
      jobOfferVerifiedAt: at,
      notes: logLine(candidate, now, 'Potpisan Job Offer odobren.'),
      secondInstallmentDue: true,
      ...(paid && (status === 'job' || status === 'in_review' || status === 'docs')
        ? {
            ds2019Status:
              !candidate.ds2019Status || candidate.ds2019Status === 'LOCKED' ? 'IN_PROGRESS' : candidate.ds2019Status,
            status: 'departure',
          }
        : {}),
    }
  }
  const reason = String(input.reason || '').trim().slice(0, 500) || DEFAULT_REASON
  return {
    ...candidate,
    hasJob: false,
    jobOfferAccepted: false,
    jobOfferRejectedAt: at,
    jobOfferRejectionReason: reason,
    jobOfferSignedAt: null,
    jobOfferVerificationStatus: 'rejected',
    jobOfferVerifiedAt: at,
    notes: logLine(candidate, now, `Job Offer vraćen na ponovno slanje (${reason}).`),
  }
}
