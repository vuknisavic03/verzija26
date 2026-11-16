import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createWorker, PSM } from 'tesseract.js'

import { extractImageFromPdf } from '../passport-ocr/imageUtils.ts'
import {
  IDENTITY_SYSTEM_PROMPT,
  IDENTITY_TOOL,
  IDENTITY_TOOL_NAME,
  type IdentityKind,
  type IdentityRead,
  identityUserPrompt,
  normalizeIdentityRead,
  normalizeMrzLines,
  readMrz,
} from './identityRules.ts'

/**
 * Čitači dokumenata. Prvi izbor je AI model (ANTHROPIC_API_KEY): pouzdano čita MRZ i ćirilicu sa
 * fotografije telefona. Bez ključa radi lokalni OCR (Tesseract), koji čita samo MRZ zonu.
 * U oba slučaja server posle toga proverava kontrolne cifre (identityRules.ts).
 */

export class IdentityScanError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 422 | 503 = 503,
  ) {
    super(message)
  }
}

export interface ScanFile {
  bytes: Buffer
  mimeType: string
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const TIMEOUT_MS = 90_000

function isPdf(file: ScanFile) {
  return file.mimeType === 'application/pdf' || file.bytes.subarray(0, 5).toString('latin1') === '%PDF-'
}

/** Fotografija: ispravi rotaciju (EXIF), smanji na najviše 2000 px, JPEG. */
async function toJpeg(bytes: Buffer, maxSide = 2_000) {
  try {
    return await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({ fit: 'inside', height: maxSide, width: maxSide, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
  } catch {
    throw new IdentityScanError(
      'Ovaj format slike ne može da se pročita. Okači JPG, PNG ili PDF (na iPhone-u: Podešavanja → Kamera → Formati → „Najkompatibilnije").',
      400,
    )
  }
}

export function aiReaderConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function readWithAi(
  kind: IdentityKind,
  files: ScanFile[],
  fetchImpl: typeof fetch = fetch,
): Promise<IdentityRead> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new IdentityScanError('AI čitač nije podešen.')
  const blocks = await Promise.all(
    files.map(async (file) =>
      isPdf(file)
        ? { source: { data: file.bytes.toString('base64'), media_type: 'application/pdf', type: 'base64' }, type: 'document' }
        : { source: { data: (await toJpeg(file.bytes)).toString('base64'), media_type: 'image/jpeg', type: 'base64' }, type: 'image' },
    ),
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetchImpl(API_URL, {
      body: JSON.stringify({
        max_tokens: 2_000,
        messages: [{ content: [...blocks, { text: identityUserPrompt(kind, files.length), type: 'text' }], role: 'user' }],
        model: process.env.IDENTITY_SCAN_MODEL?.trim() || process.env.TRANSLATION_MODEL?.trim() || 'claude-sonnet-5-5',
        system: IDENTITY_SYSTEM_PROMPT,
        tool_choice: { name: IDENTITY_TOOL_NAME, type: 'tool' },
        tools: [IDENTITY_TOOL],
      }),
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'x-api-key': apiKey },
      method: 'POST',
      signal: controller.signal,
    })
  } catch {
    throw new IdentityScanError('Očitavanje trenutno ne radi. Pokušaj ponovo za minut ili upiši podatke ručno.')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    // Telo greške se ne loguje: može da sadrži delove dokumenta.
    const hint =
      response.status === 401
        ? ' — ANTHROPIC_API_KEY nije ispravan.'
        : response.status === 404
          ? ' — model ne postoji (IDENTITY_SCAN_MODEL).'
          : response.status === 429
            ? ' — prekoračen limit ili nema kredita na Anthropic nalogu.'
            : ''
    console.error(`Identity scan API error ${response.status}${hint} Prelazi se na lokalno čitanje MRZ-a.`)
    if (response.status === 400) throw new IdentityScanError('Fajl ne može da se pročita (prevelik ili oštećen). Okači jasnu fotografiju.', 400)
    throw new IdentityScanError('Očitavanje trenutno ne radi. Pokušaj ponovo za minut ili upiši podatke ručno.')
  }
  const body = (await response.json().catch(() => null)) as {
    content?: Array<{ input?: unknown; name?: string; type?: string }>
  } | null
  const tool = body?.content?.find((c) => c.type === 'tool_use' && c.name === IDENTITY_TOOL_NAME)
  if (!tool) throw new IdentityScanError('Očitavanje nije uspelo. Pokušaj ponovo sa jasnijom fotografijom.')
  return normalizeIdentityRead(tool.input)
}

/* ── Lokalni OCR (rezerva bez AI ključa): samo MRZ zona ──────────────────── */

function tesseractWorkerOptions(): { langPath?: string; workerPath?: string } {
  const options: { langPath?: string; workerPath?: string } = {}
  for (const candidate of [
    path.resolve(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js'),
    path.resolve(process.cwd(), '../../node_modules/tesseract.js/src/worker-script/node/index.js'),
  ]) {
    if (fs.existsSync(candidate)) {
      options.workerPath = candidate
      break
    }
  }
  // Jezički fajl je deo aplikacije (@tesseract.js-data/eng), pa se ništa ne preuzima sa interneta.
  for (const candidate of [
    path.resolve(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
    path.resolve(process.cwd(), '../../node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
  ]) {
    if (fs.existsSync(path.join(candidate, 'eng.traineddata.gz'))) {
      options.langPath = candidate
      break
    }
  }
  return options
}

/** Donji deo slike (MRZ), uvećan i kontrastan; za ličnu kartu donja polovina zadnje strane. */
const OCR_TIMEOUT_MS = 60_000

export async function readWithOcr(kind: IdentityKind, files: ScanFile[]): Promise<IdentityRead> {
  const options = tesseractWorkerOptions()
  if (!options.langPath) throw new IdentityScanError('Automatsko očitavanje nije dostupno. Upiši podatke ručno.')
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new IdentityScanError('Očitavanje traje predugo. Upiši podatke ručno.')), OCR_TIMEOUT_MS)
  })
  try {
    return await Promise.race([ocrMrz(kind, files, options), timeout])
  } finally {
    clearTimeout(timer)
  }
}

type OcrWorker = Awaited<ReturnType<typeof createWorker>>
interface Box { x0: number; x1: number; y0: number; y1: number }

const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
const LOCATE_SIDE = 2_000

/** Red liči na MRZ: dovoljno dug, sa „<" popunom ili sa mnogo cifara. */
function mrzLike(text: string, length: number) {
  const line = text.replace(/\s+/g, '')
  return line.length >= length - 8 && ((line.match(/</g) || []).length >= 2 || (line.match(/\d/g) || []).length >= 12)
}

/** Koliko polja potvrđuju kontrolne cifre (merilo kvaliteta jednog čitanja). */
function mrzScore(kind: IdentityKind, lines: string[]) {
  const outcome = readMrz(kind, lines)
  if (!outcome) return -1
  const verified = Object.values(outcome.fields).filter((field) => field?.verified).length
  return verified + (outcome.valid ? 2 : 0)
}

/**
 * 1. prolaz: cela slika (retki tekst) — gde je MRZ zona? Kartica može biti bilo gde na fotografiji.
 * Vraća i pročitane redove, i okvir zone u koordinatama slike `image`.
 */
async function locateMrz(worker: OcrWorker, image: Buffer, kind: IdentityKind) {
  const length = kind === 'passport' ? 44 : 30
  const prepared = await sharp(image)
    .resize({ fit: 'inside', height: LOCATE_SIDE, width: LOCATE_SIDE })
    .grayscale()
    .normalize()
    .png()
    .toBuffer({ resolveWithObject: true })
  await worker.setParameters({ tessedit_char_whitelist: MRZ_CHARS, tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  const { data } = await worker.recognize(prepared.data, {}, { blocks: true })
  const lines = (data.blocks || []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
  const hits = lines.filter((line) => mrzLike(line.text, length))
  if (!hits.length) return null
  const meta = await sharp(image).metadata()
  const scale = (meta.width || prepared.info.width) / prepared.info.width
  const box: Box = {
    x0: Math.min(...hits.map((l) => l.bbox.x0)) * scale,
    x1: Math.max(...hits.map((l) => l.bbox.x1)) * scale,
    y0: Math.min(...hits.map((l) => l.bbox.y0)) * scale,
    y1: Math.max(...hits.map((l) => l.bbox.y1)) * scale,
  }
  return { box, lines: hits.map((l) => l.text), size: { height: meta.height || 0, width: meta.width || 0 } }
}

/** 2. prolaz: samo MRZ zona, isečena sa marginom, uvećana i pročitana na nekoliko načina. */
async function readMrzZone(worker: OcrWorker, image: Buffer, box: Box, size: { height: number; width: number }, kind: IdentityKind) {
  const rows = kind === 'passport' ? 2 : 3
  const lineHeight = (box.y1 - box.y0) / rows
  const left = Math.max(0, Math.floor(box.x0 - 0.04 * (box.x1 - box.x0)))
  const top = Math.max(0, Math.floor(box.y0 - 0.6 * lineHeight))
  const right = Math.min(size.width, Math.ceil(box.x1 + 0.04 * (box.x1 - box.x0)))
  const bottom = Math.min(size.height, Math.ceil(box.y1 + 0.6 * lineHeight))
  const region = { height: Math.max(1, bottom - top), left, top, width: Math.max(1, right - left) }
  await worker.setParameters({ tessedit_char_whitelist: MRZ_CHARS, tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
  const results: string[][] = []
  for (const [width, sharpen] of [
    [2_400, false],
    [2_400, true],
    [1_800, false],
    [3_000, true],
  ] as const) {
    let pipeline = sharp(image).extract(region).resize({ kernel: 'lanczos3', width }).grayscale().normalize()
    if (sharpen) pipeline = pipeline.sharpen({ sigma: 1 })
    const { data } = await worker.recognize(await pipeline.png().toBuffer())
    results.push(data.text.split('\n'))
  }
  return results
}

/** Stari način (fiksni donji deo slike) — rezerva kad zona nije pronađena. */
async function readBottom(worker: OcrWorker, image: Buffer, kind: IdentityKind) {
  const meta = await sharp(image).metadata()
  const height = meta.height || 0
  const top = Math.floor(height * (kind === 'idcard' ? 0.5 : 0.6))
  const crop = await sharp(image)
    .extract({ height: Math.max(1, height - top), left: 0, top, width: Math.max(1, meta.width || 0) })
    .resize({ width: 2_000 })
    .grayscale()
    .normalize()
    .png()
    .toBuffer()
  await worker.setParameters({ tessedit_char_whitelist: MRZ_CHARS, tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
  const { data } = await worker.recognize(crop)
  return data.text.split('\n')
}

/**
 * Ime nema kontrolnu cifru, pa se bira glasanjem između čitanja, posebno prezime i posebno ime.
 * Vrednost koja se od druge pročitane razlikuje samo po K/L/C/S/X na početku ili kraju broji se kao
 * ta druga (to je pogrešno pročitan „<").
 */
export function voteMrzName(kind: IdentityKind, reads: string[][]) {
  const length = kind === 'passport' ? 39 : 30
  const parts = reads
    .map((lines) => normalizeMrzLines(kind, lines))
    .filter((lines): lines is string[] => Boolean(lines))
    .map((lines) => {
      const field = kind === 'passport' ? lines[0]!.slice(5) : lines[2]!
      const [surname = '', given = ''] = field.replace(/<+$/, '').split('<<')
      return { given: given.replace(/<+$/, ''), surname }
    })
  if (!parts.length) return ''
  const pick = (values: string[]) => {
    const seen = new Set(values.filter(Boolean))
    const canonical = (value: string) => {
      for (const candidate of [value.replace(/^[KLCSX]/, ''), value.replace(/[KLCSX]$/, ''), value.replace(/^[KLCSX]|[KLCSX]$/g, '')]) {
        if (candidate && candidate !== value && seen.has(candidate)) return candidate
      }
      return value
    }
    const counted = values.filter(Boolean).map(canonical)
    const votes = new Map<string, number>()
    for (const value of counted) votes.set(value, (votes.get(value) || 0) + 1)
    const [winner = '', count = 0] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] || []
    // Bez saglasnosti bar dva čitanja i većine, ime se ne upisuje (kandidat ga upisuje sam).
    return count >= 2 && count * 2 > counted.length ? winner : ''
  }
  const surname = pick(parts.map((p) => p.surname))
  const given = pick(parts.map((p) => p.given))
  if (!surname || !given) return '<'.repeat(length)
  const line = `${surname}<<${given}`
  return line.length >= length ? line.slice(0, length) : line.padEnd(length, '<')
}

async function ocrMrz(kind: IdentityKind, files: ScanFile[], options: { langPath?: string; workerPath?: string }) {
  const worker = await createWorker('eng', 1, { ...options, cacheMethod: 'none', gzip: true }).catch(() => {
    throw new IdentityScanError('Automatsko očitavanje nije dostupno. Upiši podatke ručno.')
  })
  try {
    const length = kind === 'passport' ? 44 : 30
    const candidates: string[][] = []
    // Kod lične karte MRZ je na zadnjoj strani, ali se čita svaka okačena slika (strane mogu biti zamenjene).
    for (const file of files) {
      const raw = isPdf(file) ? extractImageFromPdf(file.bytes) : file.bytes
      if (!raw) continue
      const upright = await toJpeg(Buffer.from(raw), 3_000)
      // Fotografija može biti okrenuta: prvo uspravno, pa ostali uglovi dok se zona ne nađe.
      for (const angle of [0, 90, 270, 180]) {
        const image = angle ? await sharp(upright).rotate(angle).jpeg({ quality: 92 }).toBuffer() : upright
        const located = await locateMrz(worker, image, kind)
        if (!located) continue
        // Isečena zona prva: ona daje čistije ime kad su ostala čitanja jednako dobra.
        const reads = [...(await readMrzZone(worker, image, located.box, located.size, kind)), located.lines]
        candidates.push(...reads)
        // Zona bez ijednog polja potvrđenog kontrolnom cifrom je lažni pogodak: probaj sledeći ugao.
        if (reads.some((lines) => mrzScore(kind, lines) >= 3)) break
      }
      if (!candidates.length) candidates.push(await readBottom(worker, upright, kind))
      if (candidates.some((lines) => mrzScore(kind, lines) >= 5)) break
    }
    const cleaned = candidates.map((lines) =>
      lines.map((l) => l.replace(/\s+/g, '')).filter((l) => mrzLike(l, length) || l.length >= length - 8),
    )
    const scores = cleaned.map((lines) => mrzScore(kind, lines))
    const top = Math.max(-1, ...scores)
    const finalists = cleaned.filter((_, i) => scores[i] === top)
    // Ime nema kontrolnu cifru: od jednako dobrih čitanja uzmi ime koje se najčešće ponavlja.
    const best = [...(finalists[0] || [])]
    const normalizedBest = normalizeMrzLines(kind, best)
    // Za glasanje o imenu važe sva čitanja koja su potvrdila bar nekoliko polja, ne samo najbolje.
    const voters = cleaned.filter((_, i) => scores[i]! >= Math.min(3, top))
    const votedName = voteMrzName(kind, voters)
    if (normalizedBest) {
      normalizedBest[kind === 'passport' ? 0 : 2] = kind === 'passport' ? normalizedBest[0]!.slice(0, 5) + votedName : votedName
      best.splice(0, best.length, ...normalizedBest)
    }
    const read: IdentityRead = {
      dateOfBirth: '',
      dateOfExpiry: '',
      documentNumber: '',
      documentType: kind === 'passport' ? 'passport' : 'id_card',
      givenNames: '',
      mrzLines: best,
      nationality: '',
      notes: [],
      personalNumber: '',
      placeOfBirth: '',
      readable: true,
      sex: '',
      surname: '',
    }
    return read
  } finally {
    await worker.terminate().catch(() => {})
  }
}
