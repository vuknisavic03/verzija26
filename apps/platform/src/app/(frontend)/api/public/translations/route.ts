import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { createAiTranslation, PortalTranslationError } from '@/modules/portal-sync/portalTranslations.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z
  .object({
    doc: z.enum(['faculty', 'police']),
    email: z.string().email().max(254).optional(),
  })
  .strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/**
 * AI prevod otpremljenog originala na engleski. Kandidat prevodi svoj dokument; agencija može
 * da pokrene prevod za kandidata (email u telu zahteva). Traje obično 20–60 sekundi.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return json({ message: 'Prijavi se ponovo.' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Nepoznat dokument.' }, 400)
  const email = actor.kind === 'candidate' ? actor.email : parsed.data.email?.toLowerCase()
  if (!email) return json({ message: 'Izaberi kandidata.' }, 400)

  try {
    const candidate = await createAiTranslation({ byAgency: actor.kind === 'admin', doc: parsed.data.doc, email })
    return json({ candidate }, 201)
  } catch (error) {
    if (error instanceof PortalTranslationError) return json({ message: error.message }, error.status)
    console.error('Translation failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Prevod trenutno ne može da se napravi. Pokušaj ponovo.' }, 500)
  }
}
