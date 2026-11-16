import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { PortalTranslationError, setNoTranslation } from '@/modules/portal-sync/portalTranslations.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z.object({ doc: z.enum(['faculty', 'police']), notNeeded: z.boolean() })

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Kandidat prijavljuje da je uverenje već na engleskom (ili dvojezično), ili povlači prijavu. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Nepoznat dokument.' }, 400)
  try {
    const candidate = await setNoTranslation({
      by: 'candidate',
      doc: parsed.data.doc,
      email: actor.email,
      value: parsed.data.notNeeded ? 'requested' : '',
    })
    return json({ candidate })
  } catch (error) {
    if (error instanceof PortalTranslationError) return json({ message: error.message }, error.status)
    console.error('No-translation update failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Čuvanje nije uspelo. Probaj ponovo.' }, 500)
  }
}
