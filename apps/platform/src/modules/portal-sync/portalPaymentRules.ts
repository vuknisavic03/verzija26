import { createHash } from 'node:crypto'
import QRCode from 'qrcode'

import { buildNbsIpsQrPayload, calculateMod97 } from '../invoices/paymentSlips.ts'
import { isSelfPackage, portalContractNumber } from './portalContract.ts'

/** Čista pravila uplata u portalu (bez baze): iznosi rata, kurs NBS, poziv na broj, instrukcije. */

export const PORTAL_CURRENCY = 'USD' as const

/** Podrazumevani iznosi I i II rate kakve portal i do sada koristi (ako pozivnica ne kaže drugačije). */
export const DEFAULT_FIRST_INSTALLMENT_USD = 250
export const DEFAULT_SECOND_INSTALLMENT_USD = 400

export type PortalInstallment = '1' | '2' | '3' | 'FULL'

export type Candidate = Record<string, unknown> & { email?: string; id: number | string }

export class PortalPaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

function num(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Iznosi rata u USD za kandidata, iz cene iz pozivnice (finalPrice). */
export function portalInstallmentAmounts(candidate: Record<string, unknown>) {
  const total = num(candidate.finalPrice) || num(candidate.basePrice)
  if (!total) throw new PortalPaymentError('Kandidat nema ugovorenu cenu.', 409)
  const first = num(candidate.firstInstallmentAmount) || DEFAULT_FIRST_INSTALLMENT_USD
  const second = num(candidate.secondInstallmentAmount) || DEFAULT_SECOND_INSTALLMENT_USD
  const third = num(candidate.thirdInstallmentAmount) || Math.max(0, total - first - second)
  return { '1': first, '2': second, '3': third, FULL: total, total } as const
}

export const PURPOSE: Record<PortalInstallment, string> = {
  '1': 'Uplata I rate programa Work and Travel USA 2027 — registracija i ugovor',
  '2': 'Uplata II rate programa Work and Travel USA 2027 — potvrđena radna ponuda',
  '3': 'Uplata III (završne) rate programa Work and Travel USA 2027',
  FULL: 'Uplata programa Work and Travel USA 2027 u celosti',
}

export const PREFIX: Record<Exclude<PortalInstallment, 'FULL'>, 'first' | 'second' | 'third'> = {
  '1': 'first',
  '2': 'second',
  '3': 'third',
}

export function parseInstallment(value: unknown): PortalInstallment | null {
  const text = String(value ?? '').trim().toUpperCase()
  if (text === '1' || text === '2' || text === '3' || text === 'FULL') return text
  return null
}

/* ── Kurs NBS ────────────────────────────────────────────────────────────── */

/**
 * Srednji kurs NBS za USD na dan. Izvor je javni API koji prenosi kursnu listu NBS-a; ako nije
 * dostupan, agencija kurs unosi ručno. Kurs se nikad ne izmišlja.
 */
export async function fetchNbsUsdMiddleRate(date: string, fetcher: typeof fetch = fetch) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  try {
    const res = await fetcher(`https://kurs.resenje.org/api/v1/currencies/usd/rates/${date}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { exchange_middle?: number }
    const rate = Number(data.exchange_middle)
    return Number.isFinite(rate) && rate > 50 && rate < 500 ? rate : null
  } catch {
    return null
  }
}

const rateCache = new Map<string, { at: number; rate: number | null }>()

/** Kurs NBS za dan, keširan 6 sati (i neuspeh 10 minuta), da uplatnice ne opterećuju izvor. */
export async function cachedNbsUsdRate(date: string) {
  const hit = rateCache.get(date)
  const ttl = hit?.rate ? 6 * 60 * 60 * 1000 : 10 * 60 * 1000
  if (hit && Date.now() - hit.at < ttl) return hit.rate
  const rate = await fetchNbsUsdMiddleRate(date)
  rateCache.set(date, { at: Date.now(), rate })
  return rate
}

/* ── Instrukcije za uplatu ───────────────────────────────────────────────── */

/**
 * Račun agencije na koji se plaća — isti onaj koji stoji u ugovoru koji je kandidat potpisao
 * (SELF ugovor: Erste, FULL/Lifeguard ugovor: Banca Intesa).
 */
export const AGENCY_ACCOUNTS = {
  full: { account: '160-6000000728717-84', bank: 'Banca Intesa' },
  self: { account: '340-11015676-26', bank: 'Erste Bank' },
} as const

export const AGENCY_RECIPIENT = {
  address: 'Gospodar Jevremova 59/4, 11000 Beograd',
  name: 'American Adventure DOO',
}

/** Račun u punom obliku od 18 cifara (banka 3 + partija 13 + kontrolni 2), kako ga traži NBS IPS. */
export function normalizeAccount18(account: string) {
  const [bank, middle, control] = account.split('-')
  if (!bank || !middle || !control) return account.replace(/\D/g, '')
  return `${bank.padStart(3, '0')}${middle.padStart(13, '0')}${control.padStart(2, '0')}`
}

/** Poziv na broj (model 97): stabilan po kandidatu i rati, sa ispravnim kontrolnim ciframa. */
export function portalPaymentReference(email: string, installment: PortalInstallment) {
  const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  const base = (parseInt(digest.slice(0, 10), 16) % 10_000_000).toString().padStart(7, '0')
  const suffix = installment === 'FULL' ? '0' : installment
  return calculateMod97(`2027${base}${suffix}`)
}

export interface PortalPaymentInstructions {
  amountRsd: number | null
  amountUsd: number
  bank: string
  installment: PortalInstallment
  ipsPayload: string | null
  label: string
  model: '97'
  payer: string
  paymentCode: '289'
  purpose: string
  qrSvg: string | null
  rate: number | null
  rateDate: string
  recipientAccount: string
  recipientAddress: string
  recipientName: string
  reference: string
}

export async function portalPaymentInstructions(
  candidate: Record<string, unknown>,
  installment: PortalInstallment,
  now = new Date(),
): Promise<PortalPaymentInstructions> {
  const email = String(candidate.email || '').trim().toLowerCase()
  const amounts = portalInstallmentAmounts(candidate)
  const amountUsd = amounts[installment]
  const target = isSelfPackage(candidate) ? AGENCY_ACCOUNTS.self : AGENCY_ACCOUNTS.full
  const payerName = `${String(candidate.firstName || '')} ${String(candidate.lastName || '')}`.trim() || String(candidate.name || '')
  const payerAddress = String(candidate.address || '').trim()
  const payer = [payerName, payerAddress].filter(Boolean).join(', ')
  const reference = portalPaymentReference(email, installment)
  const label = installment === 'FULL' ? 'Program u celosti' : `${installment === '1' ? 'I' : installment === '2' ? 'II' : 'III'} rata`
  const purpose = `${label} SWT 2027 ${portalContractNumber(email)}`.slice(0, 35)

  // Procena u dinarima po današnjem srednjem kursu; faktura koristi kurs na dan prijema.
  const rateDate = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const rate = await cachedNbsUsdRate(rateDate)
  const amountRsd = rate ? Math.round(amountUsd * rate * 100) / 100 : null

  let ipsPayload: string | null = null
  let qrSvg: string | null = null
  if (amountRsd) {
    ipsPayload = buildNbsIpsQrPayload({
      amountRsd,
      candidateAddress: payerAddress,
      candidateName: payerName,
      paymentModel: '97',
      paymentPurpose: purpose,
      paymentReference: reference,
      recipientAccount: normalizeAccount18(target.account),
      recipientName: AGENCY_RECIPIENT.name,
    })
    qrSvg = await QRCode.toString(ipsPayload, { errorCorrectionLevel: 'M', margin: 1, type: 'svg' })
  }

  return {
    amountRsd,
    amountUsd,
    bank: target.bank,
    installment,
    ipsPayload,
    label,
    model: '97',
    payer,
    paymentCode: '289',
    purpose,
    qrSvg,
    rate,
    rateDate,
    recipientAccount: target.account,
    recipientAddress: AGENCY_RECIPIENT.address,
    recipientName: AGENCY_RECIPIENT.name,
    reference,
  }
}

