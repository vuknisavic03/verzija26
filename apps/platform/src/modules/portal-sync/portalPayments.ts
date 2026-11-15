import type { Payload } from 'payload'

import { EXCHANGE_RATE_SCALE, prepareCandidateInvoice } from '../invoices/rules.ts'
import { renderInvoicePdf } from '../invoices/renderInvoicePdf.ts'
import { getPortalState, savePortalCandidate } from './localStore.ts'
import {
  type Candidate,
  fetchNbsUsdMiddleRate,
  PREFIX,
  PURPOSE,
  type PortalInstallment,
  PORTAL_CURRENCY,
  PortalPaymentError,
  portalInstallmentAmounts,
} from './portalPaymentRules.ts'
import { notifyCandidate } from './portalNotifications.ts'

export * from './portalPaymentRules.ts'

/**
 * Uplate kroz kandidatski portal.
 *
 * Kandidat uplatu samo PRIJAVI (status „pending“). Agencija je POTVRDI kad vidi novac na izvodu;
 * tek tada server upisuje uplatu u dosije i izdaje fakturu u zajedničkoj KIR numeraciji
 * (`candidate-invoices`, FAKT-GGGG-NNNN). Sve je u USD; faktura preračunava u RSD po srednjem
 * kursu NBS na dan prijema uplate.
 *
 * Potvrda je idempotentna: ista rata istog kandidata nikad ne dobija dve fakture (i baza to
 * garantuje jedinstvenim indeksom).
 */

/* ── Potvrda uplate ──────────────────────────────────────────────────────── */

export interface ConfirmPortalPaymentInput {
  administratorId: number
  email: string
  exchangeRate?: number
  installment: PortalInstallment
  now?: Date
  payload: Payload
  receivedAt: string
  reference?: string
}

async function nextSequence(payload: Payload, year: number) {
  const last = await payload.find({
    collection: 'candidate-invoices',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    sort: '-sequenceNumber',
    where: { year: { equals: year } },
  })
  return (last.docs[0]?.sequenceNumber || 0) + 1
}

async function existingInvoice(payload: Payload, email: string, installment: PortalInstallment) {
  const found = await payload.find({
    collection: 'candidate-invoices',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ portalEmail: { equals: email } }, { portalInstallment: { equals: installment } }] },
  })
  return found.docs[0] || null
}

export async function confirmPortalPayment(input: ConfirmPortalPaymentInput) {
  const { payload } = input
  const now = input.now || new Date()
  const email = input.email.trim().toLowerCase()

  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === email) as
    | Candidate
    | undefined
  if (!candidate) throw new PortalPaymentError('Kandidat nije pronađen.', 404)

  const isFullPlan = candidate.paymentMethod === 'now'
  if (isFullPlan && input.installment !== 'FULL') {
    throw new PortalPaymentError('Kandidat plaća program u celosti — potvrdi celu uplatu.', 409)
  }
  if (!isFullPlan && input.installment === 'FULL') {
    throw new PortalPaymentError('Kandidat plaća u ratama — potvrdi pojedinačnu ratu.', 409)
  }

  const already = await existingInvoice(payload, email, input.installment)
  if (already) return { alreadyConfirmed: true, candidate, invoice: already }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedAt)) {
    throw new PortalPaymentError('Unesi datum prijema uplate.', 400)
  }
  if (new Date(`${input.receivedAt}T00:00:00Z`).getTime() > now.getTime()) {
    throw new PortalPaymentError('Datum prijema ne može biti u budućnosti.', 400)
  }

  const amounts = portalInstallmentAmounts(candidate)
  const amountUsd = amounts[input.installment]
  if (!amountUsd) throw new PortalPaymentError('Iznos rate je 0 — proveri cenu i rate kandidata.', 409)

  let rate = input.exchangeRate && input.exchangeRate > 0 ? input.exchangeRate : null
  let rateSource = 'Srednji kurs NBS (uneo administrator)'
  if (!rate) {
    rate = await fetchNbsUsdMiddleRate(input.receivedAt)
    rateSource = 'Srednji kurs NBS'
  }
  if (!rate) {
    throw new PortalPaymentError('Kurs NBS za taj dan nije dostupan. Unesi srednji kurs ručno.', 422)
  }

  const year = now.getFullYear()
  const buyerName = `${String(candidate.firstName || '')} ${String(candidate.lastName || '')}`.trim() || String(candidate.name || email)
  const buyerAddress = String(candidate.address || '').trim() || 'Srbija'
  const jmbg = String(candidate.jmbg || '').replace(/\D/g, '')

  // Redni broj: sledeći slobodan u godini; ako ga istovremeno zauzme druga potvrda, probaj ponovo.
  let created = null
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const sequenceNumber = await nextSequence(payload, year)
    const invoiceData = prepareCandidateInvoice({
      accountingDate: now.toISOString(),
      buyerAddress,
      buyerIdentificationNumber: jmbg || undefined,
      buyerName,
      candidateAccountId: 0,
      candidatePaymentId: 0,
      candidateProcessId: 0,
      exchangeRateDate: input.receivedAt,
      exchangeRateScaled: Math.round(rate * EXCHANGE_RATE_SCALE),
      exchangeRateSource: rateSource,
      issueDate: now.toISOString(),
      note: PURPOSE[input.installment],
      originalAmountCents: Math.round(amountUsd * 100),
      originalCurrency: PORTAL_CURRENCY,
      preApplicationId: 0,
      sequenceNumber,
      year,
    })
    const { bytes, checksum } = await renderInvoicePdf(invoiceData)
    try {
      created = await payload.create({
        collection: 'candidate-invoices',
        data: {
          accountingDate: invoiceData.accountingDate,
          amountInWords: invoiceData.amountInWords,
          buyerAddress: invoiceData.buyerAddress,
          buyerName: invoiceData.buyerName,
          buyerTaxId: jmbg || undefined,
          exchangeRateDate: invoiceData.exchangeRateDate,
          exchangeRateScaled: invoiceData.exchangeRateScaled,
          exchangeRateSource: invoiceData.exchangeRateSource,
          invoiceNumber: invoiceData.invoiceNumber,
          issueDate: invoiceData.issueDate,
          issuedBy: input.administratorId,
          note: invoiceData.note,
          originalAmountCents: invoiceData.originalAmountCents,
          originalCurrency: PORTAL_CURRENCY,
          paymentReceivedAt: new Date(`${input.receivedAt}T12:00:00Z`).toISOString(),
          paymentReference: input.reference?.trim().slice(0, 160) || undefined,
          pdfBase64: Buffer.from(bytes).toString('base64'),
          pdfSha256: checksum,
          portalEmail: email,
          portalInstallment: input.installment,
          portalRecordKey: String(candidate.id),
          sequenceNumber,
          settlementAmountRsdCents: invoiceData.settlementAmountRsdCents,
          year,
        },
        overrideAccess: true,
      })
    } catch (error) {
      // Ista rata potvrđena istovremeno iz drugog prozora: vrati tu fakturu.
      const raced = await existingInvoice(payload, email, input.installment)
      if (raced) return { alreadyConfirmed: true, candidate, invoice: raced }
      if (attempt === 4) throw error
    }
  }
  if (!created) throw new PortalPaymentError('Faktura nije izdata. Pokušaj ponovo.', 500)

  // Dosije: ista polja kao i ranije, sada postavljena isključivo sa servera.
  const iso = now.toISOString()
  const rsd = (usd: number) => Math.round(usd * rate * 100) / 100
  const updates: Record<string, unknown> = {}
  const mark = (prefix: 'first' | 'second' | 'third', usd: number) => {
    updates[`${prefix}InstallmentStatus`] = 'paid'
    updates[`${prefix}InstallmentApproved`] = true
    updates[`${prefix}InstallmentPaidAt`] = iso
    updates[`${prefix}InstallmentPaidDate`] = input.receivedAt
    updates[`${prefix}InstallmentExchangeRate`] = rate
    updates[`${prefix}InstallmentPaidRsd`] = rsd(usd)
    if (prefix !== 'first') updates[`${prefix}InstallmentPaid`] = true
  }
  if (input.installment === 'FULL') {
    mark('first', amounts['1'])
    mark('second', amounts['2'])
    mark('third', amounts['3'])
    updates.firstPaymentStatus = 'paid'
    updates.isFullPaymentPaid = true
    updates.fullPaymentStatus = 'paid'
    updates.fullPaymentPaidAt = iso
    updates.fullPaymentPaidDate = input.receivedAt
    updates.fullPaymentExchangeRate = rate
    updates.fullPaymentPaidRsd = rsd(amounts.FULL)
    updates.fullPaymentInvoiceNumber = created.invoiceNumber
  } else {
    const prefix = PREFIX[input.installment]
    mark(prefix, amountUsd)
    if (input.installment === '1') updates.firstPaymentStatus = 'paid'
    updates[`${prefix}InstallmentInvoiceNumber`] = created.invoiceNumber
    const paid = (p: string) => p === prefix || candidate[`${p}InstallmentStatus`] === 'paid'
    if (paid('first') && paid('second') && paid('third')) updates.isFullPaymentPaid = true
  }
  const day = new Date(`${input.receivedAt}T12:00:00Z`).toLocaleDateString('sr-Latn-RS')
  const line = `[${day}] Potvrđena uplata (${input.installment === 'FULL' ? 'u celosti' : `${input.installment}. rata`}): ${amountUsd.toLocaleString('sr-Latn-RS')} USD po kursu ${rate.toFixed(4)} = ${rsd(amountUsd).toLocaleString('sr-Latn-RS')} RSD. Faktura ${created.invoiceNumber}.`
  updates.notes = candidate.notes ? `${String(candidate.notes)}\n${line}` : line

  const saved = await savePortalCandidate({ ...(candidate as object), ...updates } as never)
  notifyCandidate(saved as unknown as Record<string, unknown>, {
    details: {
      amount: amountUsd.toLocaleString('sr-Latn-RS'),
      installment: input.installment === 'FULL' ? 'cela cena' : `${input.installment}. rata`,
      invoiceNumber: String(created.invoiceNumber),
    },
    kind: 'paymentConfirmed',
  })
  return { alreadyConfirmed: false, candidate: saved, invoice: created }
}

/** Fakture iz portala za jednog kandidata (bez PDF sadržaja). */
export async function listPortalInvoices(payload: Payload, email?: string) {
  const result = await payload.find({
    collection: 'candidate-invoices',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    sort: '-sequenceNumber',
    where: email ? { portalEmail: { equals: email.trim().toLowerCase() } } : { portalEmail: { exists: true } },
  })
  return result.docs.map((doc) => ({
    amountUsd: doc.originalAmountCents / 100,
    currency: doc.originalCurrency,
    email: doc.portalEmail,
    exchangeRate: doc.exchangeRateScaled / EXCHANGE_RATE_SCALE,
    exchangeRateDate: doc.exchangeRateDate,
    exchangeRateSource: doc.exchangeRateSource,
    id: doc.id,
    installment: doc.portalInstallment,
    invoiceNumber: doc.invoiceNumber,
    issueDate: doc.issueDate,
    note: doc.note,
    paymentReceivedAt: doc.paymentReceivedAt,
    paymentReference: doc.paymentReference,
    settlementRsd: doc.settlementAmountRsdCents / 100,
    buyerName: doc.buyerName,
  }))
}
