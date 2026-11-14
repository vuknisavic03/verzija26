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

export { sanitizeCandidateUpdate } from './candidateFields.ts'
export { acceptOrGenerateInvitationCode, generateInvitationCode } from './invitationCode.ts'
