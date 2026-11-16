import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { PortalTranslationError, reviewTranslation, setNoTranslation } from '@/modules/portal-sync/portalTranslations.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z
  .object({
    // waive: uverenje odobreno bez prevoda; requireTranslation: ipak treba prevod.
    action: z.enum(['approve', 'reject', 'save', 'waive', 'requireTranslation']),
    data: z.record(z.string(), z.unknown()).optional(),
    doc: z.enum(['faculty', 'police']),
    email: z.string().email().max(254),
    reason: z.string().max(1000).optional(),
  })
  .strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Agencija proverava prevod uz original: ispravlja tekst, odobrava ili vraća kandidatu. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'admin') return json({ message: 'Administratorska sesija je neophodna.' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Neispravan zahtev.' }, 400)
  try {
    const { action } = parsed.data
    const candidate =
      action === 'waive' || action === 'requireTranslation'
        ? await setNoTranslation({
            by: 'agency',
            doc: parsed.data.doc,
            email: parsed.data.email.toLowerCase(),
            value: action === 'waive' ? 'approved' : '',
          })
        : await reviewTranslation({
            ...parsed.data,
            action,
            email: parsed.data.email.toLowerCase(),
            reviewer: `admin:${actor.id}`,
          })
    return json({ candidate })
  } catch (error) {
    if (error instanceof PortalTranslationError) return json({ message: error.message }, error.status)
    console.error('Translation review failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Čuvanje trenutno nije uspelo. Pokušaj ponovo.' }, 500)
  }
}
