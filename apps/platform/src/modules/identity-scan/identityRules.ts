import { parse as parseMrz } from 'mrz'

/**
 * Očitavanje pasoša i lične karte: pravila bez baze i mreže.
 *
 *  - MRZ: pasoš je TD3 (2 × 44 znaka), srpska lična karta TD1 (3 × 30, JMBG u 1. redu, poz. 16–28).
 *  - Svako polje iz MRZ-a važi samo ako mu kontrolna cifra prolazi; inače se koristi ono što piše
 *    na dokumentu, a polje ostaje neprovereno (kandidat ga potvrđuje u formi).
 *  - JMBG se proverava kontrolnom cifrom i datumom rođenja.
 */

export type IdentityKind = 'passport' | 'idcard'

export function isIdentityKind(value: unknown): value is IdentityKind {
  return value === 'passport' || value === 'idcard'
}

/** Ono što čitač (AI ili OCR) vrati sa slike, pre provere. */
export interface IdentityRead {
  dateOfBirth: string
  dateOfExpiry: string
  documentNumber: string
  documentType: 'passport' | 'id_card' | 'other'
  givenNames: string
  mrzLines: string[]
  nationality: string
  notes: string[]
  personalNumber: string
  placeOfBirth: string
  readable: boolean
  sex: string
  surname: string
}

export type FieldKey =
  | 'birthDate'
  | 'documentNumber'
  | 'expiryDate'
  | 'firstName'
  | 'jmbg'
  | 'lastName'
  | 'nationality'
  | 'placeOfBirth'
  | 'sex'

export interface IdentityScanResult {
  blocking: string | null
  /** Vrednost i da li je potvrđena kontrolnom cifrom (MRZ ili JMBG). */
  fields: Partial<Record<FieldKey, { value: string; verified: boolean }>>
  kind: IdentityKind
  mrzFound: boolean
  mrzValid: boolean
  warnings: string[]
}

/* ── Pomoćno ─────────────────────────────────────────────────────────────── */

const CYRILLIC: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I', Ј: 'J', К: 'K', Л: 'L',
  Љ: 'Lj', М: 'M', Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H',
  Ц: 'C', Ч: 'Č', Џ: 'Dž', Ш: 'Š',
}

/** Ćirilica u latinicu (čuva dijakritike). */
export function toLatin(value: string) {
  return value.replace(/[Ѐ-ӿ]/g, (ch) => {
    const upper = ch.toUpperCase()
    const latin = CYRILLIC[upper]
    if (!latin) return ch
    return ch === upper ? latin : latin.toLowerCase()
  })
}

/** Za poređenje sa MRZ-om: bez dijakritika, Đ → DJ, samo slova. */
export function mrzToken(value: string) {
  return toLatin(value)
    .toUpperCase()
    .replace(/Đ/g, 'DJ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '')
}

/** „PETROVIC" → „Petrovic", „ANA MARIJA" → „Ana Marija". */
export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (part.trim() && part !== '-' ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
    .trim()
}

function clean(value: unknown, max = 120) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : ''
}

/** Prihvata „2027-04-15", „15.04.2027." ili „15. 04. 2027"; vraća ISO ili ''. */
export function toIsoDate(value: string) {
  const v = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  const local = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?$/.exec(v)
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2].padStart(2, '0'), local[1].padStart(2, '0')] : null
  if (!parts) return ''
  const [y, m, d] = parts
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d)) return ''
  return `${y}-${m}-${d}`
}

/** MRZ datum YYMMDD → ISO. Rođenje: nikad u budućnosti; važenje: 2000-te. */
export function mrzDate(yymmdd: string | null | undefined, kind: 'birth' | 'expiry', now = new Date()) {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return ''
  const yy = Number(yymmdd.slice(0, 2))
  const currentYY = now.getUTCFullYear() % 100
  const century = kind === 'expiry' ? 2000 : yy > currentYY ? 1900 : 2000
  return toIsoDate(`${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`)
}

/* ── JMBG ────────────────────────────────────────────────────────────────── */

export function jmbgChecksumValid(jmbg: string) {
  if (!/^\d{13}$/.test(jmbg)) return false
  const d = jmbg.split('').map(Number)
  const sum = 7 * (d[0]! + d[6]!) + 6 * (d[1]! + d[7]!) + 5 * (d[2]! + d[8]!) + 4 * (d[3]! + d[9]!) + 3 * (d[4]! + d[10]!) + 2 * (d[5]! + d[11]!)
  let control = 11 - (sum % 11)
  if (control > 9) control = 0
  return control === d[12]
}

/** Datum rođenja iz JMBG-a (DDMMGGG): 9xx → 1900-te, 0xx → 2000-te. */
export function jmbgBirthDate(jmbg: string) {
  if (!/^\d{13}$/.test(jmbg)) return ''
  const ggg = Number(jmbg.slice(4, 7))
  const year = ggg >= 800 ? 1000 + ggg : 2000 + ggg
  return toIsoDate(`${year}-${jmbg.slice(2, 4)}-${jmbg.slice(0, 2)}`)
}

/** JMBG pol: 000–499 muški, 500–999 ženski. */
export function jmbgSex(jmbg: string) {
  if (!/^\d{13}$/.test(jmbg)) return ''
  return Number(jmbg.slice(9, 12)) < 500 ? 'M' : 'F'
}

/* ── MRZ ─────────────────────────────────────────────────────────────────── */

const MRZ_SHAPE: Record<IdentityKind, { length: number; lines: number }> = {
  idcard: { length: 30, lines: 3 },
  passport: { length: 44, lines: 2 },
}

/** Čisti MRZ redove koje je čitač vratio (razmaci, slična slova, dužina). */
export function normalizeMrzLines(kind: IdentityKind, lines: string[]) {
  const { length, lines: count } = MRZ_SHAPE[kind]
  const cleaned = lines
    .map((line) =>
      line
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[«‹＜]/g, '<')
        .replace(/[^A-Z0-9<]/g, ''),
    )
    .filter((line) => line.length >= length - 6)
  if (cleaned.length < count) return null
  // Uzmi poslednje redove odgovarajuće dužine (MRZ je na dnu).
  const picked = cleaned.slice(-count).map((line) => (line.length > length ? line.slice(0, length) : line.padEnd(length, '<')))
  // Srpski pasoš i lična karta imaju broj dokumenta od 9 cifara: slova slična ciframa su greška čitanja.
  const digitsOnly = (v: string) => v.replace(/O|Q|D/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6')
  if (kind === 'passport' && picked[0]!.slice(2, 5) === 'SRB') {
    picked[1] = digitsOnly(picked[1]!.slice(0, 10)) + picked[1]!.slice(10)
  }
  if (kind === 'idcard' && picked[0]!.slice(2, 5) === 'SRB') {
    picked[0] = picked[0]!.slice(0, 5) + digitsOnly(picked[0]!.slice(5, 15)) + picked[0]!.slice(15)
  }
  // Red sa imenom (pasoš: 1. red od 6. znaka, lična karta: ceo 3. red).
  if (kind === 'passport') picked[0] = picked[0]!.slice(0, 5) + cleanMrzName(picked[0]!.slice(5), length - 5)
  else picked[2] = cleanMrzName(picked[2]!, length)
  return picked
}

/**
 * OCR često pročita popunu „<" kao K, L, C, S ili X. Svako ime ima samoglasnik, pa se delovi bez
 * samoglasnika odbacuju kao pogrešno pročitana popuna. Prezime i ime razdvaja „<<"; ako je pročitano
 * pogrešno, razdvajač je odbačeni deo između dva imena.
 */
export function cleanMrzName(field: string, length: number) {
  const parts = field.split('<')
  const isName = (part: string) => /^[A-Z]+$/.test(part) && /[AEIOU]/.test(part)
  const surname: string[] = []
  const given: string[] = []
  let target = surname
  let seenName = false
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (isName(part)) {
      target.push(part)
      seenName = true
      continue
    }
    // Prazan deo („<<") ili odbačen deo posle prezimena prebacuje na ime.
    if (seenName && target === surname) target = given
  }
  if (!surname.length) return field
  const rebuilt = `${surname.join('<')}<<${given.join('<')}`
  return rebuilt.length >= length ? rebuilt.slice(0, length) : rebuilt.padEnd(length, '<')
}

interface MrzOutcome {
  fields: Partial<Record<FieldKey, { value: string; verified: boolean }>>
  valid: boolean
}

export function readMrz(kind: IdentityKind, rawLines: string[], now = new Date()): MrzOutcome | null {
  const lines = normalizeMrzLines(kind, rawLines)
  if (!lines) return null
  let parsed: ReturnType<typeof parseMrz>
  try {
    parsed = parseMrz(lines, { autocorrect: true })
  } catch {
    return null
  }
  const expectedFormat = kind === 'passport' ? 'TD3' : 'TD1'
  if (parsed.format !== expectedFormat) return null

  const ok = (field: string) => parsed.details.find((d) => d.field === field)?.valid !== false
  const composite = ok('compositeCheckDigit')
  const f = parsed.fields
  const out: MrzOutcome['fields'] = {}

  if (f.documentNumber) out.documentNumber = { value: f.documentNumber, verified: ok('documentNumberCheckDigit') }
  const birth = mrzDate(f.birthDate, 'birth', now)
  if (birth) out.birthDate = { value: birth, verified: ok('birthDateCheckDigit') }
  const expiry = mrzDate(f.expirationDate, 'expiry', now)
  if (expiry) out.expiryDate = { value: expiry, verified: ok('expirationDateCheckDigit') }
  if (f.sex === 'male' || f.sex === 'female') out.sex = { value: f.sex === 'male' ? 'M' : 'F', verified: composite }
  if (f.nationality) out.nationality = { value: f.nationality, verified: composite }
  // Ime i prezime nisu pokriveni nijednom kontrolnom cifrom: „provereno" je tek kad se slažu
  // sa odštampanim imenom (vidi combineIdentityRead).
  if (f.lastName) out.lastName = { value: f.lastName, verified: false }
  if (f.firstName) out.firstName = { value: f.firstName, verified: false }

  // JMBG: pasoš → lični broj (sopstvena kontrolna cifra); lična karta → opciono polje 1. reda.
  const personal = (kind === 'passport' ? f.personalNumber : f.optional1)?.replace(/[^0-9]/g, '') || ''
  const jmbg = personal.slice(0, 13)
  if (jmbg.length === 13) {
    const mrzOk = kind === 'passport' ? ok('personalNumberCheckDigit') : composite
    out.jmbg = { value: jmbg, verified: mrzOk && jmbgChecksumValid(jmbg) }
  }

  return { fields: out, valid: parsed.valid }
}

/* ── Spajanje MRZ-a i vizuelne zone ──────────────────────────────────────── */

/** Program počinje sledećeg leta; pasoš treba da važi bar 6 meseci posle povratka (15. april naredne godine). */
export function passportRequiredUntil(now = new Date()) {
  const season = now.getUTCMonth() >= 8 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
  return `${season + 1}-04-15`
}

export function combineIdentityRead(kind: IdentityKind, read: IdentityRead, now = new Date()): IdentityScanResult {
  const warnings: string[] = []
  const expected = kind === 'passport' ? 'passport' : 'id_card'
  const label = kind === 'passport' ? 'pasoš' : 'lična karta'

  if (!read.readable) {
    return {
      blocking: `Ne vidi se dovoljno dobro. Slikaj ${kind === 'passport' ? 'stranu pasoša sa fotografijom' : 'ličnu kartu'} ceo, ravno, bez odsjaja i senki.`,
      fields: {},
      kind,
      mrzFound: false,
      mrzValid: false,
      warnings,
    }
  }
  if (read.documentType !== expected) {
    return {
      blocking:
        read.documentType === 'other'
          ? `Ovo ne izgleda kao ${label}. Proveri da li si okačio pravi dokument.`
          : `Ovo izgleda kao ${read.documentType === 'passport' ? 'pasoš' : 'lična karta'}. Okači ga u deo „${read.documentType === 'passport' ? 'Pasoš' : 'Lična karta'}".`,
      fields: {},
      kind,
      mrzFound: false,
      mrzValid: false,
      warnings,
    }
  }

  const mrz = read.mrzLines.length ? readMrz(kind, read.mrzLines, now) : null
  const fields: IdentityScanResult['fields'] = {}
  const take = (key: FieldKey, visual: string) => {
    const fromMrz = mrz?.fields[key]
    if (fromMrz?.verified) fields[key] = fromMrz
    else if (visual) fields[key] = { value: visual, verified: false }
    else if (fromMrz) fields[key] = { ...fromMrz, verified: false }
  }

  take('documentNumber', clean(read.documentNumber, 20).toUpperCase().replace(/[^A-Z0-9]/g, ''))
  take('birthDate', toIsoDate(clean(read.dateOfBirth)))
  take('expiryDate', toIsoDate(clean(read.dateOfExpiry)))
  take('sex', /^[MF]$/i.test(clean(read.sex)) ? clean(read.sex).toUpperCase() : '')
  take('nationality', clean(read.nationality, 3).toUpperCase())

  // Imena: sa dokumenta (latinica, sa dijakriticima) ako se slažu sa MRZ-om; inače MRZ.
  for (const [key, visualRaw] of [
    ['lastName', read.surname],
    ['firstName', read.givenNames],
  ] as const) {
    const printed = toLatin(clean(visualRaw)).replace(/\s+/g, ' ')
    // Pasoš štampa imena velikim slovima: „PETROVIĆ" → „Petrović".
    const visual = printed && printed === printed.toUpperCase() ? titleCase(printed) : printed
    const fromMrz = mrz?.fields[key]
    if (fromMrz && visual && mrzToken(visual) === mrzToken(fromMrz.value)) {
      // Dva nezavisna čitanja (odštampano ime i MRZ) se slažu.
      fields[key] = { value: visual, verified: true }
    } else if (visual) {
      if (fromMrz) warnings.push(`Ime na dokumentu (${visual}) se razlikuje od MRZ zapisa; proveri ${key === 'lastName' ? 'prezime' : 'ime'}.`)
      fields[key] = { value: visual, verified: false }
    } else if (fromMrz) {
      fields[key] = { value: titleCase(fromMrz.value), verified: false }
    }
  }

  // JMBG: iz MRZ-a ako je proveren, inače sa dokumenta uz proveru kontrolne cifre. JMBG iz MRZ-a
  // koji ne prolazi kontrolnu cifru se ne upisuje (verovatno je red pomeren pri čitanju).
  const visualJmbg = clean(read.personalNumber, 20).replace(/\D/g, '')
  if (mrz?.fields.jmbg?.verified) fields.jmbg = mrz.fields.jmbg
  else if (visualJmbg.length === 13) fields.jmbg = { value: visualJmbg, verified: jmbgChecksumValid(visualJmbg) }
  else if (mrz?.fields.jmbg && jmbgChecksumValid(mrz.fields.jmbg.value)) fields.jmbg = { ...mrz.fields.jmbg, verified: false }

  const placePrinted = toLatin(clean(read.placeOfBirth))
  const place = placePrinted && placePrinted === placePrinted.toUpperCase() ? titleCase(placePrinted) : placePrinted
  if (place) fields.placeOfBirth = { value: place, verified: false }

  // Provere
  const jmbg = fields.jmbg?.value
  if (jmbg && !jmbgChecksumValid(jmbg)) warnings.push('JMBG nema ispravnu kontrolnu cifru. Proveri ga i ispravi.')
  if (jmbg && fields.birthDate?.value && jmbgBirthDate(jmbg) && jmbgBirthDate(jmbg) !== fields.birthDate.value) {
    warnings.push('Datum rođenja se ne slaže sa JMBG-om. Proveri oba podatka.')
  }
  if (!jmbg) warnings.push(kind === 'idcard' ? 'JMBG nije očitan. Okači i zadnju stranu lične karte ili ga upiši.' : 'JMBG nije očitan. Upiši ga ručno.')

  const expiry = fields.expiryDate?.value
  const today = now.toISOString().slice(0, 10)
  if (expiry && expiry < today) warnings.push(`${kind === 'passport' ? 'Pasoš' : 'Lična karta'} je istekla (${expiry}).`)
  else if (kind === 'passport' && expiry && expiry < passportRequiredUntil(now)) {
    warnings.push(`Pasoš važi do ${expiry}. Za program treba da važi bar do ${passportRequiredUntil(now)} (6 meseci posle povratka), pa ga verovatno moraš produžiti.`)
  }

  if (!mrz) warnings.push(kind === 'idcard' ? 'MRZ zona (zadnja strana) nije očitana, pa podaci nisu provereni kontrolnim ciframa.' : 'MRZ zona (dva reda sa < na dnu strane) nije očitana, pa podaci nisu provereni kontrolnim ciframa.')
  else if (!mrz.valid) warnings.push('Neke kontrolne cifre u MRZ zoni ne prolaze. Proveri označena polja.')

  for (const note of read.notes.slice(0, 5)) warnings.push(note)

  return { blocking: null, fields, kind, mrzFound: Boolean(mrz), mrzValid: Boolean(mrz?.valid), warnings }
}

/** Poređenje pasoša i lične karte (posle oba očitavanja). */
export function crossCheckDocuments(
  passport: IdentityScanResult['fields'],
  idcard: IdentityScanResult['fields'],
) {
  const issues: string[] = []
  // Porede se samo provereni podaci; nesigurno čitanje ne sme da pravi lažno upozorenje.
  type Field = { value: string; verified: boolean } | undefined
  const differ = (a: Field, b: Field, normalize = (v: string) => v) =>
    Boolean(a?.verified && b?.verified && normalize(a.value) !== normalize(b.value))
  if (differ(passport.lastName, idcard.lastName, mrzToken) || differ(passport.firstName, idcard.firstName, mrzToken)) {
    issues.push('Ime i prezime nisu isti u pasošu i na ličnoj karti.')
  }
  if (differ(passport.birthDate, idcard.birthDate)) issues.push('Datum rođenja nije isti u pasošu i na ličnoj karti.')
  if (differ(passport.jmbg, idcard.jmbg)) issues.push('JMBG nije isti u pasošu i na ličnoj karti.')
  return issues
}

/* ── Zahtev ka AI čitaču ─────────────────────────────────────────────────── */

export const IDENTITY_TOOL_NAME = 'record_identity_document'

export const IDENTITY_SYSTEM_PROMPT = [
  'You read Serbian identity documents (passport data page, identity card front and back) from photos or scans.',
  'Transcribe exactly what is printed. Never guess, infer or complete a value; leave it as an empty string if it is not visible or not legible.',
  'MRZ: copy every machine readable zone line character by character, including all "<" fillers, one array item per line. Do not correct check digits.',
  'Names: write them as printed in the visual zone, in Serbian Latin script with diacritics (č, ć, š, ž, đ). Transliterate Cyrillic to Latin.',
  'Dates in the visual zone: return as YYYY-MM-DD.',
  'personalNumber is the JMBG (13 digits) if printed anywhere outside the MRZ.',
  'If several images are given, they are the sides of the same document; combine them.',
  'documentType: "passport" for a passport data page, "id_card" for an identity card (either side), "other" for anything else.',
  'readable: false if the image is too blurry, dark, cropped or reflective to read reliably.',
  'notes: short remarks in Serbian (Latin) for the applicant, e.g. that part of the MRZ is cut off. Empty if nothing.',
  'Return the result only by calling the record_identity_document tool.',
].join('\n')

const str = { type: 'string' } as const

export const IDENTITY_TOOL = {
  description: 'Record the data read from the identity document.',
  input_schema: {
    properties: {
      dateOfBirth: str,
      dateOfExpiry: str,
      documentNumber: str,
      documentType: { enum: ['passport', 'id_card', 'other'], type: 'string' },
      givenNames: str,
      mrzLines: { items: str, type: 'array' },
      nationality: { description: 'ISO 3166-1 alpha-3, e.g. SRB', type: 'string' },
      notes: { items: str, type: 'array' },
      personalNumber: str,
      placeOfBirth: str,
      readable: { type: 'boolean' },
      sex: { description: 'M, F or empty', type: 'string' },
      surname: str,
    },
    required: [
      'readable',
      'documentType',
      'mrzLines',
      'surname',
      'givenNames',
      'documentNumber',
      'personalNumber',
      'dateOfBirth',
      'dateOfExpiry',
      'sex',
      'nationality',
      'placeOfBirth',
      'notes',
    ],
    type: 'object',
  },
  name: IDENTITY_TOOL_NAME,
} as const

export function identityUserPrompt(kind: IdentityKind, imageCount: number) {
  return kind === 'passport'
    ? 'The applicant says this is the data page of their passport. Read it.'
    : `The applicant says ${imageCount > 1 ? 'these are the front and back of' : 'this is'} their identity card (lična karta). Read it.`
}

export function normalizeIdentityRead(input: unknown): IdentityRead {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const type = raw.documentType
  return {
    dateOfBirth: clean(raw.dateOfBirth, 30),
    dateOfExpiry: clean(raw.dateOfExpiry, 30),
    documentNumber: clean(raw.documentNumber, 30),
    documentType: type === 'passport' || type === 'id_card' ? type : 'other',
    givenNames: clean(raw.givenNames, 120),
    mrzLines: Array.isArray(raw.mrzLines) ? raw.mrzLines.map((l) => clean(l, 60)).filter(Boolean).slice(0, 4) : [],
    nationality: clean(raw.nationality, 10),
    notes: Array.isArray(raw.notes) ? raw.notes.map((n) => clean(n, 300)).filter(Boolean).slice(0, 5) : [],
    personalNumber: clean(raw.personalNumber, 30),
    placeOfBirth: clean(raw.placeOfBirth, 120),
    readable: raw.readable !== false,
    sex: clean(raw.sex, 5),
    surname: clean(raw.surname, 120),
  }
}
