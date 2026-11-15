import fontkit from '@pdf-lib/fontkit'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib'

import type { PortalTranslation, TranslationData } from './portalTranslationRules.ts'

/**
 * PDF prevoda. Na svakoj strani piše šta dokument jeste: prevod urađen uz pomoć AI-ja iz
 * originala koji je kandidat otpremio, proveren u agenciji (ili nacrt, ako još nije).
 * Nikad se ne predstavlja kao overen prevod sudskog tumača.
 */

const fontPath = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf')
const INK = rgb(0.137, 0.122, 0.125)
const MUTED = rgb(0.42, 0.42, 0.44)
const LINE = rgb(0.85, 0.84, 0.82)
const DRAFT = rgb(0.72, 0.29, 0.18)
const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const WIDTH = A4[0] - MARGIN * 2
const LABEL_WIDTH = 165

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const paragraph of value.split('\n')) {
    const words = paragraph
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => {
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

/** Font ne mora imati svaki znak (npr. emoji iz odgovora): takve znakove menjamo upitnikom. */
const charsets = new WeakMap<PDFFont, Set<number>>()
function safe(font: PDFFont, value: string) {
  let supported = charsets.get(font)
  if (!supported) {
    supported = new Set(font.getCharacterSet())
    charsets.set(font, supported)
  }
  return Array.from(value)
    .map((ch) => (ch === '\n' || supported.has(ch.codePointAt(0)!) ? ch : '?'))
    .join('')
}

class Writer {
  page!: PDFPage
  y = 0
  pages: PDFPage[] = []
  constructor(
    private pdf: PDFDocument,
    private font: PDFFont,
    private footer: string[],
    private draft: boolean,
  ) {
    this.addPage()
  }
  private addPage() {
    this.page = this.pdf.addPage(A4)
    this.pages.push(this.page)
    this.y = A4[1] - MARGIN
    if (this.draft) {
      this.page.drawText('DRAFT — NOT YET REVIEWED', { color: DRAFT, font: this.font, size: 9, x: MARGIN, y: A4[1] - 34 })
    }
  }
  private footerHeightCache = -1
  private footerHeight() {
    if (this.footerHeightCache < 0) {
      this.footerHeightCache = this.footer.reduce((h, p) => h + wrap(safe(this.font, p), this.font, 7.5, WIDTH).length * 10 + 3, 18)
    }
    return this.footerHeightCache
  }
  private ensure(height: number) {
    if (this.y - height < MARGIN + this.footerHeight()) this.addPage()
  }
  text(value: string, size: number, color = INK, gap = 5) {
    for (const line of wrap(safe(this.font, value), this.font, size, WIDTH)) {
      this.ensure(size + gap)
      this.page.drawText(line, { color, font: this.font, size, x: MARGIN, y: this.y - size })
      this.y -= size + gap
    }
  }
  space(value: number) {
    this.y -= value
  }
  rule() {
    this.ensure(10)
    this.page.drawLine({ color: LINE, end: { x: A4[0] - MARGIN, y: this.y }, start: { x: MARGIN, y: this.y }, thickness: 0.6 })
    this.y -= 12
  }
  row(label: string, value: string) {
    const labelLines = wrap(safe(this.font, label), this.font, 8.5, LABEL_WIDTH - 12)
    const valueLines = wrap(safe(this.font, value || '—'), this.font, 10, WIDTH - LABEL_WIDTH)
    const height = Math.max(labelLines.length * 11, valueLines.length * 14) + 6
    this.ensure(height)
    labelLines.forEach((line, i) =>
      this.page.drawText(line, { color: MUTED, font: this.font, size: 8.5, x: MARGIN, y: this.y - 10 - i * 11 }),
    )
    valueLines.forEach((line, i) =>
      this.page.drawText(line, { color: INK, font: this.font, size: 10, x: MARGIN + LABEL_WIDTH, y: this.y - 10 - i * 14 }),
    )
    this.y -= height
  }
  finish() {
    const total = this.pages.length
    this.pages.forEach((page, index) => {
      let y = MARGIN + this.footerHeight() - 14
      page.drawLine({ color: LINE, end: { x: A4[0] - MARGIN, y: y + 8 }, start: { x: MARGIN, y: y + 8 }, thickness: 0.6 })
      for (const paragraph of this.footer) {
        for (const line of wrap(safe(this.font, paragraph), this.font, 7.5, WIDTH)) {
          page.drawText(line, { color: MUTED, font: this.font, size: 7.5, x: MARGIN, y })
          y -= 10
        }
        y -= 3
      }
      page.drawText(`Page ${index + 1} of ${total}`, { color: MUTED, font: this.font, size: 7.5, x: A4[0] - MARGIN - 50, y: MARGIN - 20 })
    })
  }
}

function utcDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date()
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Europe/Belgrade' }).format(date)
}

export function translationFooter(t: PortalTranslation) {
  const source = `Source: original document "${t.sourceFileName}" uploaded by the applicant on ${utcDate(t.createdAt)} (SHA-256 ${t.sourceSha256.slice(0, 16)}…).`
  const notSworn = 'This is not a sworn (court interpreter) translation.'
  if (t.status === 'approved') {
    return [
      `Translation from ${t.data?.sourceLanguage || 'Serbian'} into English, prepared with AI assistance by American Adventure and reviewed against the original document on ${utcDate(t.reviewedAt)}. ${notSworn}`,
      source,
    ]
  }
  return [
    `Draft translation from ${t.data?.sourceLanguage || 'Serbian'} into English, prepared with AI assistance. It has not yet been reviewed against the original by American Adventure. ${notSworn}`,
    source,
  ]
}

export async function renderTranslationPdf(t: PortalTranslation, data: TranslationData = t.data!) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fs.readFileSync(fontPath), { subset: true })
  pdf.setTitle(`English translation — ${data.titleEn || 'document'}`)
  pdf.setCreator('American Adventure')
  pdf.setProducer('American Adventure portal')

  const w = new Writer(pdf, font, translationFooter(t), t.status !== 'approved')
  w.text('ENGLISH TRANSLATION', 8.5, MUTED, 6)
  w.text(data.titleEn || 'Document', 16, INK, 6)
  if (data.issuerEn) w.text(data.issuerEn, 10.5, INK, 4)
  w.space(8)
  if (data.referenceNumber) w.row('Reference number', data.referenceNumber)
  if (data.issueDate) w.row('Date of issue', data.issueDate)
  if (data.personName) w.row('Person', data.personName)
  w.space(4)
  w.rule()

  for (const section of data.sections) {
    if (section.headingEn) {
      w.space(4)
      w.text(section.headingEn, 11.5, INK, 6)
    }
    for (const field of section.fields) w.row(field.labelEn, field.valueEn)
    for (const paragraph of section.paragraphsEn) {
      w.text(paragraph, 10, INK, 4.5)
      w.space(5)
    }
    w.space(6)
  }

  if (data.stampsAndSignatures.length) {
    w.rule()
    for (const item of data.stampsAndSignatures) w.text(item, 9.5, MUTED, 4)
  }

  w.finish()
  return Buffer.from(await pdf.save())
}
