import fs from 'node:fs'
import path from 'node:path'
import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState } from '@/modules/portal-sync/localStore.ts'
import { preparePaymentSlip } from '@/modules/invoices/paymentSlips.ts'
import { renderPaymentSlipPdf } from '@/modules/invoices/renderPaymentSlipPdf.ts'
import { parseInstallment, portalPaymentInstructions } from '@/modules/portal-sync/portalPayments.ts'

export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return new Response('Prijavite se ponovo.', { status: 401 })
  try {
    const url = new URL(request.url)
    // Kandidat uvek dobija sopstveni dokument; agencija bira kandidata po ID-ju ili emailu.
    const idOrEmail =
      actor.kind === 'candidate'
        ? actor.email
        : (url.searchParams.get('id') || url.searchParams.get('email') || '').trim().toLowerCase()
    const type = (url.searchParams.get('type') || '').trim().toLowerCase()

    const state = await getPortalState()
    const candidate = state.candidates.find(
      (c) => String(c.id).toLowerCase() === idOrEmail || c.email.toLowerCase() === idOrEmail,
    )

    if (!candidate) {
      return new Response('Kandidat nije pronađen.', { status: 404 })
    }

    const isSelf = String(candidate.packageId || '').toLowerCase().includes('self') || String(candidate.packageName || '').toLowerCase().includes('self')

    // If official agency PDF slip requested
    if (type === 'official' || url.searchParams.get('official') === 'true') {
      const fileName = isSelf ? 'Uplatnica_avans_AA_SELF.pdf' : 'Uplatnica_avans_AA_FULL.pdf'
      const possiblePaths = [
        path.resolve(process.cwd(), 'public', 'documents', fileName),
        path.resolve(process.cwd(), 'apps', 'platform', 'public', 'documents', fileName),
        path.resolve(process.cwd(), 'dokumentazaswt', isSelf ? 'Uplatnica - avans AA SELF.pdf' : 'Uplatnica - avans AA. FULL.pdf'),
      ]
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const bytes = fs.readFileSync(p)
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Cache-Control': 'no-store',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Type': 'application/pdf',
            },
          })
        }
      }
    }

    // Uplatnica za ratu (1, 2, 3 ili FULL): isti podaci kao u portalu — iznos u USD preračunat
    // po današnjem srednjem kursu NBS, račun iz potpisanog ugovora, model 97.
    const installment =
      parseInstallment(url.searchParams.get('installment') || type) ||
      (candidate.paymentMethod === 'now' ? 'FULL' : '1')
    const instructions = await portalPaymentInstructions(candidate as unknown as Record<string, unknown>, installment)
    if (!instructions.amountRsd) {
      return new Response('Kurs NBS trenutno nije dostupan. Plati iznos u USD preračunat po srednjem kursu NBS na dan uplate.', {
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
        status: 503,
      })
    }
    const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email
    const slipData = preparePaymentSlip({
      candidateAddress: String((candidate as unknown as { address?: string }).address || ''),
      candidateName,
      currency: 'RSD',
      obligationKey: `portal-${installment}`,
      obligationLabel: `${instructions.label} (${instructions.amountUsd.toLocaleString('sr-Latn-RS')} USD po kursu ${instructions.rate?.toFixed(4)})`,
      paymentAmountRsd: instructions.amountRsd,
      paymentModel: instructions.model,
      paymentPurpose: instructions.purpose,
      paymentReference: instructions.reference,
      recipientAccount: instructions.recipientAccount,
      recipientAddress: instructions.recipientAddress,
      recipientName: instructions.recipientName,
    })

    const slipPdf = await renderPaymentSlipPdf(slipData)

    const safeLast = (candidate.lastName || 'Kandidat').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/Đ/g, 'Dj').replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeFirst = (candidate.firstName || 'AA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/Đ/g, 'Dj').replace(/[^a-zA-Z0-9_-]/g, '_')

    return new Response(new Uint8Array(slipPdf.bytes), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="Uplatnica_${safeLast}_${safeFirst}.pdf"`,
        'Content-Type': 'application/pdf',
      },
    })
  } catch (error) {
    console.error('Payment slip PDF generation failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return new Response('Greška pri kreiranju PDF uplatnice.', { status: 500 })
  }
}
