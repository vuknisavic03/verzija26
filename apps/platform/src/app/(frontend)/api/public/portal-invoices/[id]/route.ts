import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'

/** PDF fakture: kandidat samo svoje, agencija sve. Uvek isti, sačuvan pri izdavanju. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return new Response('Prijavi se ponovo.', { status: 401 })
  const { id } = await context.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) return new Response('Faktura nije pronađena.', { status: 404 })

  const payload = await getPayload({ config })
  const invoice = await payload
    .findByID({ collection: 'candidate-invoices', depth: 0, id: numericId, overrideAccess: true, showHiddenFields: true })
    .catch(() => null)
  if (!invoice?.pdfBase64 || (actor.kind === 'candidate' && invoice.portalEmail !== actor.email)) {
    return new Response('Faktura nije pronađena.', { status: 404 })
  }
  return new Response(new Uint8Array(Buffer.from(invoice.pdfBase64, 'base64')), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
