import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { confirmPortalPayment, parseInstallment, PortalPaymentError } from '@/modules/portal-sync/portalPayments.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z
  .object({
    email: z.string().email().max(254),
    exchangeRate: z.number().positive().max(1000).optional(),
    installment: z.union([z.string(), z.number()]),
    receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reference: z.string().max(160).optional(),
  })
  .strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Agencija potvrđuje uplatu rate (ili cele cene) kad je vidi na izvodu; server izdaje fakturu. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'admin') return json({ message: 'Administratorska sesija je neophodna.' }, 401)

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Proveri datum prijema i kurs.' }, 400)
  const installment = parseInstallment(parsed.data.installment)
  if (!installment) return json({ message: 'Nepoznata rata.' }, 400)

  try {
    const payload = await getPayload({ config })
    const result = await confirmPortalPayment({
      administratorId: Number(actor.id),
      email: parsed.data.email,
      exchangeRate: parsed.data.exchangeRate,
      installment,
      payload,
      receivedAt: parsed.data.receivedAt,
      reference: parsed.data.reference,
    })
    return json(
      {
        alreadyConfirmed: result.alreadyConfirmed,
        candidate: result.candidate,
        invoiceNumber: result.invoice.invoiceNumber,
      },
      result.alreadyConfirmed ? 200 : 201,
    )
  } catch (error) {
    if (error instanceof PortalPaymentError) return json({ message: error.message }, error.status)
    console.error('Portal payment confirmation failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return json({ message: 'Potvrda uplate nije uspela. Pokušaj ponovo.' }, 500)
  }
}
