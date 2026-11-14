import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

/**
 * Ko šalje zahtev prema portal-state sloju.
 *
 * - `admin`: prijavljen nalog iz kolekcije `users` (agencija) — vidi i menja sve.
 * - `candidate`: prijavljen nalog iz `candidate-accounts` — vidi i menja samo svoj zapis.
 * - `anonymous`: bez sesije — nema pristup.
 */
export type PortalActor =
  | { kind: 'admin'; id: number | string }
  | { kind: 'candidate'; id: number | string; email: string }
  | { kind: 'anonymous' }

export async function resolvePortalActor(): Promise<PortalActor> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return { kind: 'anonymous' }
    if (user.collection === 'users') return { id: user.id, kind: 'admin' }
    if (user.collection === 'candidate-accounts') {
      const email = String((user as { email?: string }).email || '').trim().toLowerCase()
      if (!email) return { kind: 'anonymous' }
      return { email, id: user.id, kind: 'candidate' }
    }
  } catch (error) {
    console.error('Portal actor resolution failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
  }
  return { kind: 'anonymous' }
}

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
])

const ADMIN_ONLY_SUFFIX =
  /(Approved|Verified|VerifiedAt|VerificationStatus|VerificationNote|RejectionReason|RejectedAt|PaidAt|PaidDate|PaidRsd|ExchangeRate|InstallmentPaid)$/

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

export { acceptOrGenerateInvitationCode, generateInvitationCode } from './invitationCode.ts'
