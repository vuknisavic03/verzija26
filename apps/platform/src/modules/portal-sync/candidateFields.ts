/**
 * Polja koja odlučuje isključivo agencija. Kandidat ih ne može postaviti niti promeniti preko
 * portala — server zadržava postojeću vrednost bez obzira na to šta pošalje pregledač.
 */
const ADMIN_ONLY_FIELDS = new Set([
  'id',
  'email',
  'basePrice',
  'discount',
  'discountNote',
  'discountId',
  'discountCode',
  'discountTiming',
  'discountDetails',
  'groupCode',
  'finalPrice',
  'packageId',
  'packageName',
  'notes',
  'selectionDecision',
  'isRegistered',
  'registeredAt',
  'activationCode',
  'code',
  'isFullPaymentPaid',
  'promotionId',
  'referredBy',
  'referredByEmail',
  'referredByName',
  'affiliate',
  'isNew',
  'contactStatus',
  'latestContactOutcome',
  'contactNotes',
  'consultationStatus',
  'consultationNotes',
  // Tok programa vodi agencija: korak, posao, intervju, Job Offer, DS-2019, ambasada, let.
  'status',
  'progress',
  'offerAllJobs',
  'offeredJobIds',
  'selectedJob',
  'selectedJobId',
  'selectedJobTitle',
  'selectedJobEmployer',
  'selectedJobCity',
  'selectedJobWage',
  'selectedJobHousing',
  'jobApplicationStatus',
  'hasJob',
  'interviewScheduled',
  'interviewScheduledAt',
  'interviewLink',
  'interviewNote',
  'interviewType',
  'interviewDetails',
  'jobOfferAccepted',
  'jobOfferAcceptance',
  'jobOfferDetails',
  'jobOfferSignature',
  'jobOfferSignedAt',
  'secondInstallmentDue',
  'ds2019Status',
  'ds2019Number',
  'embassyInterviewDate',
  'embassyPrepStatus',
  'flightTicketStatus',
  'flightDepartureDate',
  'flightReturnDate',
  // Potpis ugovora postavlja samo server (prihvatanje u portalu ili otpremljen skeniran ugovor).
  'contractAcceptance',
  'contractSigned',
  'contractSignedAt',
  'contractSignedReference',
  // Prevod dokumenata: pravi ga i menja samo server (AI prevod, potvrda, pregled agencije).
  'facultyCertTranslation',
  'policeCertTranslation',
  'translationAttempts',
  'facultyCertAiTranslation',
  'facultyCertTranslated',
  'policeCertificateTranslated',
])

/**
 * Polja koja menjaju samo namenske serverske akcije (prevod). Ni agencija ih ne menja kroz
 * „Sačuvaj dosije", da otvoren prozor u adminu ne bi pregazio prevod koji je server upravo upisao.
 */
const SERVER_MANAGED_FIELDS = [
  'facultyCertTranslation',
  'policeCertTranslation',
  'translationAttempts',
  'facultyCertAiTranslation',
  'policeCertificateTranslated',
] as const

export function keepServerManagedFields(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
) {
  const result = { ...incoming }
  for (const key of SERVER_MANAGED_FIELDS) {
    if (existing && key in existing) result[key] = existing[key]
    else delete result[key]
  }
  return result
}

const ADMIN_ONLY_SUFFIX =
  /(Approved|Verified|VerifiedAt|VerificationStatus|VerificationNote|RejectionReason|RejectedAt|PaidAt|PaidDate|PaidRsd|ExchangeRate|InstallmentPaid|InvoiceNumber)$/

const PAYMENT_STATUS = /(Installment|Payment)Status$/

function isAdminOnly(key: string) {
  return ADMIN_ONLY_FIELDS.has(key) || ADMIN_ONLY_SUFFIX.test(key)
}

/**
 * Spaja izmenu koju šalje kandidat sa postojećim zapisom na serveru, tako da kandidat ne može da
 * promeni cenu, popust, potvrde uplata ili ishod provere dokumenata.
 *
 * Status uplate kandidat sme samo da prijavi („pending“) dok je uplata neplaćena; potvrdu
 * („paid“) postavlja agencija.
 */
export function sanitizeCandidateUpdate(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  sessionEmail: string,
) {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (isAdminOnly(key)) continue
    if (PAYMENT_STATUS.test(key)) {
      const current = existing?.[key]
      if (current === 'paid') continue
      if (value !== 'pending' && value !== current) continue
    }
    result[key] = value
  }
  // Jedini prelaz statusa dosijea koji sme kandidat: slanje (ili ponovno slanje posle dopune)
  // na pregled. Odobrenje i vraćanje ostaju samo agenciji.
  const resubmits =
    incoming.documentsSubmittedForReview === true &&
    incoming.documentsVerificationStatus === 'pending' &&
    existing?.documentsApproved !== true &&
    existing?.documentsVerificationStatus !== 'approved'
  if (resubmits) {
    result.documentsVerificationStatus = 'pending'
    result.documentsRejectionReason = ''
    const stage = existing?.status
    if (stage === undefined || ['registered', 'review', 'in_review', 'docs'].includes(String(stage))) result.status = 'docs'
  }
  if (existing) {
    for (const key of Object.keys(existing)) {
      if (isAdminOnly(key) || PAYMENT_STATUS.test(key)) {
        if (!(key in result)) result[key] = existing[key]
      }
    }
    result.id = existing.id
  }
  result.email = sessionEmail
  return result
}
