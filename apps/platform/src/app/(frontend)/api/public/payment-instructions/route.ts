import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState } from '@/modules/portal-sync/localStore.ts'
import { parseInstallment, portalPaymentInstructions, PortalPaymentError } from '@/modules/portal-sync/portalPayments.ts'

/**
 * Instrukcije za uplatu jedne rate: iznos u USD, procena u RSD po današnjem kursu NBS, račun iz
 * potpisanog ugovora, model 97 sa ispravnim pozivom na broj i NBS IPS QR kod (pravi ga server).
 * Kandidat dobija svoje; agencija za `?email=`.
 */
export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return Response.json({ message: 'Prijavi se ponovo.' }, { status: 401 })
  const url = new URL(request.url)
  const installment = parseInstallment(url.searchParams.get('installment'))
  if (!installment) return Response.json({ message: 'Nepoznata rata.' }, { status: 400 })
  const email = actor.kind === 'candidate' ? actor.email : String(url.searchParams.get('email') || '').toLowerCase()

  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === email)
  if (!candidate) return Response.json({ message: 'Kandidat nije pronađen.' }, { status: 404 })

  try {
    const instructions = await portalPaymentInstructions(candidate as unknown as Record<string, unknown>, installment)
    return Response.json(instructions, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof PortalPaymentError) return Response.json({ message: error.message }, { status: error.status })
    throw error
  }
}
