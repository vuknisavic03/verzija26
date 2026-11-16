import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { confirmEmailVerification, EmailVerificationError } from '@/modules/candidate-accounts/emailVerification.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z.object({ token: z.string().min(1).max(200) }).strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Link iz mejla „Potvrdi email": aktivira nalog kandidata. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Link nije ispravan. Otvori ga ponovo iz mejla.', reason: 'invalid' }, 400)
  try {
    const payload = await getPayload({ config })
    const result = await confirmEmailVerification(payload, parsed.data.token)
    return json({ email: result.email, message: 'Email je potvrđen. Možeš da se prijaviš.' })
  } catch (error) {
    if (error instanceof EmailVerificationError) return json({ message: error.message, reason: error.reason }, 410)
    console.error('Email verification failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Potvrda trenutno nije uspela. Pokušaj ponovo.' }, 500)
  }
}
