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
  // Potpis ugovora postavlja samo server (prihvatanje u portalu ili otpremljen skeniran ugovor).
  'contractAcceptance',
  'contractSigned',
  'contractSignedAt',
  'contractSignedReference',
])

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
