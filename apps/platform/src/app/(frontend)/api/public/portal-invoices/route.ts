import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { listPortalInvoices } from '@/modules/portal-sync/portalPayments.ts'

/** Fakture iz portala: kandidat dobija svoje, agencija sve (ili za `?email=`). */
export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return Response.json({ message: 'Prijavi se ponovo.' }, { status: 401 })
  const payload = await getPayload({ config })
  const requested = new URL(request.url).searchParams.get('email') || undefined
  const email = actor.kind === 'candidate' ? actor.email : requested
  const invoices = await listPortalInvoices(payload, email)
  return Response.json({ invoices }, { headers: { 'Cache-Control': 'no-store' } })
}
