import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { acceptPortalJobOffer, PortalJobError } from '@/modules/portal-sync/portalJobActions.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z
  .object({
    confirm: z.literal(true),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    signature: z.string().min(3).max(120),
  })
  .strict()

/** Elektronski potpis Job Offer-a (kandidat). */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ message: 'Zahtev nije dozvoljen.' }, { status: 403 })
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return Response.json({ message: 'Prijavi se ponovo.' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Upiši ime i prezime i potvrdi ponudu.' }, { status: 400 })
  try {
    const result = await acceptPortalJobOffer({
      accountId: actor.id,
      email: actor.email,
      fingerprint: parsed.data.fingerprint,
      signature: parsed.data.signature,
      userAgent: request.headers.get('user-agent') || '',
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' }, status: result.alreadyAccepted ? 200 : 201 })
  } catch (error) {
    if (error instanceof PortalJobError) return Response.json({ message: error.message }, { status: error.status })
    console.error('Job offer acceptance failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return Response.json({ message: 'Potpis trenutno nije uspeo. Pokušaj ponovo.' }, { status: 500 })
  }
}
