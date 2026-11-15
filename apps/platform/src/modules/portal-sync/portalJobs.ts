import { createHash, randomUUID } from 'node:crypto'

/**
 * Poslovi u kandidatskom portalu.
 *
 * Katalog vodi agencija (na serveru, u podešavanjima portala). Kandidat vidi samo poslove koji su
 * mu ponuđeni i bira jedan; termin intervjua i odluku poslodavca unosi agencija. Job Offer se
 * sastavlja ISKLJUČIVO iz podataka koje je agencija unela za taj posao — nikad iz pretpostavljenih
 * vrednosti — jer isti podaci idu u DS-160 (zahtev za američku vizu). Dok ponuda nije kompletna,
 * kandidat ne može da je potpiše.
 */

export interface PortalJob {
  id: string
  // Prikaz u katalogu
  title: string
  employer: string
  category?: string
  city?: string
  wage?: string
  hoursPerWeek?: string
  housing?: string
  period?: string
  tips?: string
  summary?: string
  description?: string
  duties?: string[]
  englishLevel?: string
  images?: string[]
  // Podaci za Job Offer (unosi agencija)
  legalName?: string
  ein?: string
  companyAddress?: string
  supervisor?: string
  supervisorPhone?: string
  supervisorEmail?: string
  overtimeWage?: string
  payFrequency?: string
  startDate?: string
  endDate?: string
  housingAddress?: string
  housingCost?: string
  housingDeposit?: string
  mealPlan?: string
  transportation?: string
  uniform?: string
  createdAt?: string
  updatedAt?: string
}

const TEXT_FIELDS = [
  'title',
  'employer',
  'category',
  'city',
  'wage',
  'hoursPerWeek',
  'housing',
  'period',
  'tips',
  'summary',
  'description',
  'englishLevel',
  'legalName',
  'ein',
  'companyAddress',
  'supervisor',
  'supervisorPhone',
  'supervisorEmail',
  'overtimeWage',
  'payFrequency',
  'startDate',
  'endDate',
  'housingAddress',
  'housingCost',
  'housingDeposit',
  'mealPlan',
  'transportation',
  'uniform',
] as const

/** Polja koja kandidat ne vidi dok ga poslodavac ne izabere (kontakt nadređenog i sl.). */
const OFFER_ONLY_FIELDS = ['legalName', 'ein', 'supervisor', 'supervisorPhone', 'supervisorEmail'] as const

function clean(value: unknown, max = 2_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Čisti unos agencije; ID dodeljuje server. */
export function normalizeJobInput(input: Record<string, unknown>, existing?: PortalJob | null): PortalJob {
  const now = new Date().toISOString()
  const job: PortalJob = {
    createdAt: existing?.createdAt || now,
    employer: '',
    id: existing?.id || `job-${randomUUID().slice(0, 8)}`,
    title: '',
    updatedAt: now,
  }
  for (const field of TEXT_FIELDS) {
    const value = clean(input[field], field === 'description' ? 6_000 : 500)
    if (value) (job as unknown as Record<string, string>)[field] = value
  }
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map((x) => clean(x, 500)).filter(Boolean).slice(0, max) : []
  const duties = list(input.duties, 20)
  if (duties.length) job.duties = duties
  const images = list(input.images, 6).filter((url) => /^https:\/\//i.test(url) || url.startsWith('/'))
  if (images.length) job.images = images
  return job
}

/** Javni prikaz posla za kandidata (bez kontakt podataka iz ponude). */
export function publicJob(job: PortalJob) {
  const copy: Record<string, unknown> = { ...job }
  for (const field of OFFER_ONLY_FIELDS) delete copy[field]
  return copy
}

/** Poslovi ponuđeni kandidatu: svi, ili samo izabrani ako je agencija suzila izbor. */
export function offeredJobsFor(candidate: Record<string, unknown>, jobs: PortalJob[]) {
  if (candidate.offerAllJobs === false && Array.isArray(candidate.offeredJobIds)) {
    const ids = new Set((candidate.offeredJobIds as unknown[]).map(String))
    return jobs.filter((j) => ids.has(String(j.id)))
  }
  return jobs
}

/* ── Job Offer ───────────────────────────────────────────────────────────── */

export const JOB_OFFER_STATEMENT_VERSION = 'job-offer-2027.1'

const REQUIRED: [keyof PortalJob, string][] = [
  ['legalName', 'pravni naziv poslodavca'],
  ['companyAddress', 'adresa poslodavca'],
  ['supervisor', 'nadređeni'],
  ['supervisorPhone', 'telefon nadređenog'],
  ['title', 'pozicija'],
  ['wage', 'satnica'],
  ['hoursPerWeek', 'broj sati nedeljno'],
  ['startDate', 'datum početka'],
  ['endDate', 'datum završetka'],
  ['housingAddress', 'adresa smeštaja'],
  ['housingCost', 'cena smeštaja'],
]

export function jobOfferNumber(email: string, jobId: string) {
  const digest = createHash('sha256').update(`${email.trim().toLowerCase()}:${jobId}`).digest('hex')
  return `JO-2027-${digest.slice(0, 6).toUpperCase()}`
}

export function buildJobOffer(candidate: Record<string, unknown>, job: PortalJob | null) {
  const email = String(candidate.email || '').trim().toLowerCase()
  const missing: string[] = []
  if (!job) {
    return {
      fingerprint: '',
      missing: ['posao iz kataloga agencije'],
      offer: null,
      statement: '',
      statementVersion: JOB_OFFER_STATEMENT_VERSION,
    }
  }
  for (const [field, label] of REQUIRED) if (!clean(job[field])) missing.push(label)

  const offer = {
    city: job.city || '',
    companyAddress: job.companyAddress || '',
    companyName: job.legalName || '',
    ein: job.ein || '',
    email: job.supervisorEmail || '',
    endDate: job.endDate || '',
    housingAddress: job.housingAddress || '',
    housingCost: job.housingCost || '',
    housingDeposit: job.housingDeposit || '',
    hoursPerWeek: job.hoursPerWeek || '',
    jobId: job.id,
    mealPlan: job.mealPlan || '',
    offerNumber: jobOfferNumber(email, job.id),
    overtimeWage: job.overtimeWage || '',
    payFrequency: job.payFrequency || '',
    phone: job.supervisorPhone || '',
    position: job.title || '',
    startDate: job.startDate || '',
    supervisor: job.supervisor || '',
    transportation: job.transportation || '',
    uniformRequired: job.uniform || '',
    wage: job.wage || '',
  }
  const statement = `Pročitao/la sam Job Offer broj ${offer.offerNumber} (${offer.position}, ${offer.companyName}) i prihvatam poziciju, uslove rada i smeštaja kako su navedeni. Potpisujem ga elektronski, prijavljen/a na svoj nalog na portalu American Adventure.`
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ email, offer, statement, version: JOB_OFFER_STATEMENT_VERSION }))
    .digest('hex')
  return { fingerprint, missing, offer, statement, statementVersion: JOB_OFFER_STATEMENT_VERSION }
}

/**
 * DS-160 podaci o poslodavcu — samo stvarni podaci izabranog posla. Pri promeni posla polja koja
 * novi posao nema ostaju prazna (ne nasleđuju se od prethodnog poslodavca, ne izmišljaju se).
 */
export function ds160EmployerFields(job: PortalJob, existing: Record<string, unknown> = {}) {
  return {
    ...existing,
    employerInfo: [job.legalName || job.employer, job.title].filter(Boolean).join(' — '),
    employerPhone: job.supervisorPhone || '',
    stayAddress: job.housingAddress || '',
    supervisorName: job.supervisor || '',
  }
}
