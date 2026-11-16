import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { resendEmailVerification } from '@/modules/candidate-accounts/emailVerification.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z.object({ email: z.string().email().max(254) }).strict()
const GENERIC = 'Ako nalog sa tim emailom čeka potvrdu, poslali smo novi link. Proveri i Spam folder.'

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Ponovno slanje linka za potvrdu emaila. Odgovor ne otkriva da li nalog postoji. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Upiši ispravan email.' }, 400)
  let devVerificationUrl: string | undefined
  try {
    const payload = await getPayload({ config })
    devVerificationUrl = await resendEmailVerification(payload, parsed.data.email)
  } catch (error) {
    console.error('Verification resend failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
  }
  // devVerificationUrl postoji samo lokalno, kad se mejlovi ne šalju (capture, van produkcije).
  return json({ message: GENERIC, ...(devVerificationUrl ? { devVerificationUrl } : {}) })
}
