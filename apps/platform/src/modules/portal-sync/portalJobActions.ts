import { getPortalState, savePortalCandidate } from './localStore.ts'
import { ds160EmployerFields, offeredJobsFor, type PortalJob } from './portalJobs.ts'

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

/** Kandidat bira posao iz ponude. Podaci o poslu se uzimaju iz kataloga, ne iz pregledača. */
export async function selectPortalJob(email: string, jobId: string) {
  const { candidate, jobs } = await load(email)
  if (!documentsApproved(candidate)) {
    throw new PortalJobError('Posao biraš kad agencija odobri tvoj dosije.', 409)
  }
  if (candidate.jobOfferAccepted || candidate.jobApplicationStatus === 'ACCEPTED' || candidate.jobOfferFileName) {
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
