import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { confirmTranslation, PortalTranslationError } from '@/modules/portal-sync/portalTranslations.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z
  .object({
    confirm: z.literal(true),
    doc: z.enum(['faculty', 'police']),
    note: z.string().max(1000).optional(),
  })
  .strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Kandidat potvrđuje da je prevod uporedio sa originalom (uz neobaveznu napomenu za agenciju). */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Potvrdi da si proverio prevod.' }, 400)
  try {
    const candidate = await confirmTranslation({ doc: parsed.data.doc, email: actor.email, note: parsed.data.note })
    return json({ candidate })
  } catch (error) {
    if (error instanceof PortalTranslationError) return json({ message: error.message }, error.status)
    console.error('Translation confirmation failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Potvrda trenutno nije uspela. Pokušaj ponovo.' }, 500)
  }
}
