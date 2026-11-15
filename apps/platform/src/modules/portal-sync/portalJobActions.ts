import { getPortalState, savePortalCandidate } from './localStore.ts'
import { buildJobOffer, ds160EmployerFields, offeredJobsFor, type PortalJob } from './portalJobs.ts'

export class PortalJobError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type Candidate = Record<string, unknown> & { email?: string; id: number | string }

async function load(email: string) {
  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === email) as unknown as
    | Candidate
    | undefined
  if (!candidate) throw new PortalJobError('Profil nije pronađen.', 404)
  return { candidate, jobs: (state.jobs || []) as PortalJob[] }
}

function documentsApproved(candidate: Candidate) {
  return candidate.documentsApproved === true || candidate.documentsVerificationStatus === 'approved'
}

export async function getCandidateJobOffer(email: string) {
  const { candidate, jobs } = await load(email)
  const job = jobs.find((j) => j.id === candidate.selectedJobId) || null
  const draft = buildJobOffer(candidate, job)
  return {
    acceptance: (candidate.jobOfferAcceptance as Record<string, unknown>) || null,
    applicationStatus: String(candidate.jobApplicationStatus || 'NONE'),
    ...draft,
  }
}

/** Kandidat bira posao iz ponude. Podaci o poslu se uzimaju iz kataloga, ne iz pregledača. */
export async function selectPortalJob(email: string, jobId: string) {
  const { candidate, jobs } = await load(email)
  if (!documentsApproved(candidate)) {
    throw new PortalJobError('Posao biraš kad agencija odobri tvoj dosije.', 409)
  }
  if (candidate.jobOfferAccepted || candidate.jobApplicationStatus === 'ACCEPTED') {
    throw new PortalJobError('Poslodavac te je već izabrao — izbor posla se više ne menja.', 409)
  }
  const job = offeredJobsFor(candidate, jobs).find((j) => j.id === jobId)
  if (!job) throw new PortalJobError('Ovaj posao ti nije ponuđen.', 404)

  return savePortalCandidate({
    ...(candidate as object),
    ds160: ds160EmployerFields(job, (candidate.ds160 as Record<string, unknown>) || {}),
    hasJob: false,
    interviewLink: '',
    interviewNote: '',
    interviewScheduled: false,
    interviewScheduledAt: '',
    jobApplicationStatus: 'APPLIED',
    selectedJob: null,
    selectedJobCity: job.city || '',
    selectedJobEmployer: job.employer,
    selectedJobHousing: job.housing || '',
    selectedJobId: job.id,
    selectedJobTitle: job.title,
    selectedJobWage: job.wage || '',
  } as never)
}

/**
 * Elektronsko prihvatanje Job Offer-a. Moguće tek kad agencija označi da je poslodavac izabrao
 * kandidata, i samo za ponudu koja je kompletna i ista kao ona koju je kandidat video.
 */
export async function acceptPortalJobOffer(input: {
  accountId: number | string
  email: string
  fingerprint: string
  signature: string
  userAgent?: string
}) {
  const { candidate, jobs } = await load(input.email)
  if (candidate.jobOfferAcceptance) {
    return { alreadyAccepted: true, candidate }
  }
  if (candidate.jobApplicationStatus !== 'ACCEPTED') {
    throw new PortalJobError('Job Offer potpisuješ kad te poslodavac izabere posle intervjua.', 409)
  }
  const job = jobs.find((j) => j.id === candidate.selectedJobId) || null
  const draft = buildJobOffer(candidate, job)
  if (!draft.offer || draft.missing.length > 0) {
    throw new PortalJobError(`Agencija još unosi podatke ponude: ${draft.missing.join(', ')}.`, 409)
  }
  if (draft.fingerprint !== input.fingerprint) {
    throw new PortalJobError('Ponuda se u međuvremenu promenila. Otvori je ponovo i proveri.', 409)
  }
  const signature = input.signature.trim().replace(/\s+/g, ' ')
  if (signature.length < 3 || signature.length > 120) {
    throw new PortalJobError('Upiši ime i prezime kao potpis.', 400)
  }

  const acceptedAt = new Date().toISOString()
  const fullyPaidOrSecond =
    candidate.paymentMethod === 'now' ||
    candidate.isFullPaymentPaid === true ||
    candidate.secondInstallmentStatus === 'paid'

  const saved = await savePortalCandidate({
    ...(candidate as object),
    ds160: ds160EmployerFields(job as PortalJob, (candidate.ds160 as Record<string, unknown>) || {}),
    hasJob: true,
    jobOfferAccepted: true,
    jobOfferAcceptance: {
      acceptedAt,
      accountId: input.accountId,
      fingerprint: draft.fingerprint,
      method: 'PORTAL_ELECTRONIC',
      offerNumber: draft.offer.offerNumber,
      signature,
      statement: draft.statement,
      statementVersion: draft.statementVersion,
      userAgent: (input.userAgent || '').slice(0, 200),
    },
    jobOfferDetails: { ...draft.offer, signature, signedAt: acceptedAt },
    jobOfferSignature: signature,
    jobOfferSignedAt: acceptedAt,
    secondInstallmentDue: true,
    // Korak 3 se otvara kad je II rata plaćena (ili je program plaćen u celosti).
    ...(fullyPaidOrSecond
      ? {
          ds2019Status:
            !candidate.ds2019Status || candidate.ds2019Status === 'LOCKED' ? 'IN_PROGRESS' : candidate.ds2019Status,
          status: 'departure',
        }
      : {}),
  } as never)
  return { alreadyAccepted: false, candidate: saved }
}
