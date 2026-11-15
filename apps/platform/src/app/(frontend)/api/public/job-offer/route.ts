import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getCandidateJobOffer, PortalJobError } from '@/modules/portal-sync/portalJobActions.ts'

/** Job Offer kandidata: podaci iz kataloga agencije, šta nedostaje, otisak i postojeći potpis. */
export async function GET() {
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return Response.json({ message: 'Prijavi se ponovo.' }, { status: 401 })
  try {
    return Response.json(await getCandidateJobOffer(actor.email), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PortalJobError) return Response.json({ message: error.message }, { status: error.status })
    throw error
  }
}
