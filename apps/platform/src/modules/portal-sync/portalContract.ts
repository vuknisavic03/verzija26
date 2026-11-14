import fontkit from '@pdf-lib/fontkit'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib'

import { renderResponsibilityStatementPdf } from '../generated-contracts/renderResponsibilityStatementPdf.ts'

/**
 * Ugovor kandidata iz portala.
 *
 * Dokument koji kandidat prihvata je ZVANIČAN ugovor agencije (public/documents, FULL/Lifeguard
 * ili SELF), nepromenjen, uz:
 *   1. prilog sa podacima Naručioca usluga, izabranom opcijom plaćanja i cenom iz pozivnice,
 *   2. Izjavu o odgovornosti (15 tačaka, sezona 2027),
 *   3. posle prihvatanja: stranu sa dokazom elektronskog prihvatanja.
 *
 * Otisak (fingerprint) se računa nad SADRŽAJEM (otisak zvaničnog PDF-a + podaci iz priloga +
 * verzija izjave), ne nad bajtovima generisanog PDF-a, pa je isti pri svakom prikazu. Kandidat
 * prihvata tačno taj otisak; ako se bilo šta promeni između prikaza i potpisa, server odbija.
 */

export const PORTAL_CONTRACT_STATEMENT_VERSION = 'portal-2027.1'

export function portalContractStatement(contractNumber: string) {
  return `Potvrđujem da sam pročitao/la Ugovor o pružanju usluga broj ${contractNumber} sa prilogom (moji podaci, izabrana opcija plaćanja i cena) i Izjavu o odgovornosti, da razumem njihov sadržaj i da ih prihvatam. Prihvatanje dajem elektronski, prijavljen/a na svoj nalog na portalu American Adventure.`
}

type Candidate = Record<string, unknown>

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim()
}

function findDocument(fileName: string) {
  for (const dir of [
    path.resolve(process.cwd(), 'public', 'documents'),
    path.resolve(process.cwd(), 'apps', 'platform', 'public', 'documents'),
  ]) {
    const full = path.join(dir, fileName)
    if (fs.existsSync(full)) return fs.readFileSync(full)
  }
  return null
}

export function isSelfPackage(candidate: Candidate) {
  return `${text(candidate.packageId)} ${text(candidate.packageName)}`.toLowerCase().includes('self')
}

const OPTION: Record<string, string> = {
  installments: 'Opcija A — plaćanje u ratama',
  later: 'Opcija C — plaćanje tokom/nakon programa (PKZ, uz jemca)',
  now: 'Opcija B — puna uplata pri prijavi',
}

export interface PortalContractFacts {
  address: string
  candidateName: string
  contractNumber: string
  email: string
  guarantorName: string
  isSelf: boolean
  jmbg: string
  officialFile: string
  officialSha256: string
  optionLabel: string
  passportNumber: string
  phone: string
  priceLabel: string
  programLabel: string
}

export interface PortalContractDraft {
  facts: PortalContractFacts
  fingerprint: string
  missing: string[]
  officialBytes: Buffer | null
  statement: string
  statementVersion: string
}

/** Stabilan broj ugovora po kandidatu (ne zavisi od ID-ja koji se može promeniti). */
export function portalContractNumber(email: string) {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 6).toUpperCase()
  return `AA-2027-${hash}`
}

export function buildPortalContractDraft(candidate: Candidate): PortalContractDraft {
  const isSelf = isSelfPackage(candidate)
  const officialFile = isSelf ? 'SELF_UGOVOR_2027.pdf' : 'FULL_Lifeguard_UGOVOR_2027.pdf'
  const officialBytes = findDocument(officialFile)
  const email = text(candidate.email).toLowerCase()
  const candidateName =
    `${text(candidate.firstName)} ${text(candidate.lastName)}`.trim() || text(candidate.name)
  const jmbg = text(candidate.jmbg).replace(/\D/g, '')
  const passportNumber = text(candidate.passportNumber) || text(candidate.idCardNumber)
  const price = Number(candidate.finalPrice)
  const guarantor = (candidate.guarantor || null) as { name?: string } | null

  const facts: PortalContractFacts = {
    address: text(candidate.address),
    candidateName,
    contractNumber: portalContractNumber(email),
    email,
    guarantorName: candidate.paymentMethod === 'later' ? text(guarantor?.name) : '',
    isSelf,
    jmbg,
    officialFile,
    officialSha256: officialBytes ? createHash('sha256').update(officialBytes).digest('hex') : '',
    optionLabel: OPTION[text(candidate.paymentMethod)] || OPTION.now,
    passportNumber,
    phone: text(candidate.phone),
    priceLabel: Number.isFinite(price) && price > 0 ? `${price.toLocaleString('sr-Latn-RS')} USD` : '',
    programLabel: isSelf
      ? 'Self Adventure — Work and Travel USA 2027'
      : text(candidate.packageName) || 'Full Adventure — Work and Travel USA 2027',
  }

  const missing: string[] = []
  if (!candidateName) missing.push('ime i prezime')
  if (!/^\d{13}$/.test(jmbg)) missing.push('JMBG (13 cifara)')
  if (passportNumber.length < 5) missing.push('broj pasoša')
  if (!facts.priceLabel) missing.push('cena programa')
  if (candidate.paymentMethod === 'later' && !facts.guarantorName) missing.push('jemac')
  if (!officialBytes) missing.push('zvanični ugovor agencije (fajl nedostaje na serveru)')

  const statement = portalContractStatement(facts.contractNumber)
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ facts, statement, statementVersion: PORTAL_CONTRACT_STATEMENT_VERSION }))
    .digest('hex')

  return { facts, fingerprint, missing, officialBytes, statement, statementVersion: PORTAL_CONTRACT_STATEMENT_VERSION }
}

/* ── PDF ─────────────────────────────────────────────────────────────────── */

const fontPath = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf')
const INK = rgb(0.137, 0.122, 0.125)
const MUTED = rgb(0.42, 0.42, 0.44)
const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const paragraph of value.split('\n')) {
    // Predugačke reči bez razmaka (otisak, referenca) se lome na delove koji staju u red.
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= width) return [word]
      const parts: string[] = []
      let part = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(part + char, size) > width) {
          parts.push(part)
          part = char
        } else part += char
      }
      return part ? [...parts, part] : parts
    })
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

class Writer {
  page: PDFPage
  y: number
  constructor(private pdf: PDFDocument, private font: PDFFont) {
    this.page = pdf.addPage(A4)
    this.y = A4[1] - MARGIN
  }
  private ensure(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.pdf.addPage(A4)
      this.y = A4[1] - MARGIN
    }
  }
  heading(value: string) {
    this.ensure(30)
    this.page.drawText(value, { color: INK, font: this.font, size: 15, x: MARGIN, y: this.y - 15 })
    this.y -= 32
  }
  paragraph(value: string, size = 10, color = INK) {
    for (const line of wrap(value, this.font, size, A4[0] - MARGIN * 2)) {
      this.ensure(size + 6)
      this.page.drawText(line, { color, font: this.font, size, x: MARGIN, y: this.y - size })
      this.y -= size + 5
    }
    this.y -= 6
  }
  row(label: string, value: string) {
    const lines = wrap(value || '—', this.font, 10, A4[0] - MARGIN * 2 - 170)
    this.ensure(lines.length * 15 + 4)
    this.page.drawText(label, { color: MUTED, font: this.font, size: 9, x: MARGIN, y: this.y - 10 })
    lines.forEach((line, i) => {
      this.page.drawText(line, { color: INK, font: this.font, size: 10, x: MARGIN + 170, y: this.y - 10 - i * 14 })
    })
    this.y -= lines.length * 14 + 8
  }
}

function belgradeTime(value: Date) {
  return new Intl.DateTimeFormat('sr-Latn-RS', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'Europe/Belgrade',
  }).format(value)
}

export interface PortalContractAcceptance {
  acceptedAt: string
  fingerprint: string
  reference: string
  statement: string
  statementVersion: string
}

/** Zvaničan ugovor + prilog sa podacima + Izjava (+ dokaz o prihvatanju, ako postoji). */
export async function renderPortalContractPdf(draft: PortalContractDraft, acceptance?: PortalContractAcceptance) {
  if (!draft.officialBytes) throw new Error('OFFICIAL_CONTRACT_MISSING')
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fs.readFileSync(fontPath), { subset: true })

  const official = await PDFDocument.load(draft.officialBytes, { ignoreEncryption: true, updateMetadata: false })
  for (const page of await pdf.copyPages(official, official.getPageIndices())) pdf.addPage(page)

  const { facts } = draft
  const annex = new Writer(pdf, font)
  annex.heading(`Prilog uz ugovor broj ${facts.contractNumber}`)
  annex.paragraph(
    'Podaci Naručioca usluga koji se unose u ugovor, izabrana opcija plaćanja i ugovorena cena. Prilog je sastavni deo ugovora.',
    9.5,
    MUTED,
  )
  annex.row('Naručilac usluga', facts.candidateName)
  annex.row('JMBG', facts.jmbg)
  annex.row('Broj pasoša', facts.passportNumber)
  annex.row('Adresa', facts.address)
  annex.row('E-mail', facts.email)
  annex.row('Telefon', facts.phone)
  annex.row('Program', facts.programLabel)
  annex.row('Opcija plaćanja', facts.optionLabel)
  annex.row('Ugovorena cena', facts.priceLabel)
  if (facts.guarantorName) annex.row('Jemac', facts.guarantorName)
  annex.row('Zvaničan tekst ugovora', `${facts.officialFile} (SHA-256 ${facts.officialSha256.slice(0, 16)}…)`)

  const statementBytes = await renderResponsibilityStatementPdf({
    acceptedAt: acceptance ? new Date(acceptance.acceptedAt) : undefined,
    candidateName: facts.candidateName,
    contractNumber: facts.contractNumber,
    date: acceptance ? new Date(acceptance.acceptedAt) : new Date(),
    isAccepted: Boolean(acceptance),
    jmbg: facts.jmbg,
    passportNumber: facts.passportNumber,
    reference: acceptance?.reference,
  })
  const statementDoc = await PDFDocument.load(statementBytes)
  for (const page of await pdf.copyPages(statementDoc, statementDoc.getPageIndices())) pdf.addPage(page)

  if (acceptance) {
    const proof = new Writer(pdf, font)
    proof.heading('Elektronsko prihvatanje ugovora')
    proof.paragraph(acceptance.statement)
    proof.row('Prihvatio/la', `${facts.candidateName} (${facts.email})`)
    proof.row('Vreme prihvatanja', belgradeTime(new Date(acceptance.acceptedAt)))
    proof.row('Referenca', acceptance.reference)
    proof.row('Verzija izjave', acceptance.statementVersion)
    proof.row('Otisak sadržaja', acceptance.fingerprint)
    proof.paragraph(
      'Kandidat je ugovor prihvatio iz prijavljenog naloga na portalu American Adventure. Ovo je elektronsko prihvatanje unutar portala, a ne kvalifikovani elektronski potpis.',
      8.5,
      MUTED,
    )
  }

  pdf.setTitle(`Ugovor ${facts.contractNumber}`)
  pdf.setProducer('American Adventure portal')
  return Buffer.from(await pdf.save({ useObjectStreams: false }))
}

export function acceptanceReference(fingerprint: string, acceptedAt: string, contractNumber: string) {
  const digest = createHash('sha256').update(`${fingerprint}:${acceptedAt}`).digest('hex').slice(0, 8).toUpperCase()
  return `${contractNumber}-EP-${digest}`
}
