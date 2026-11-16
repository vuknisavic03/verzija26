/**
 * Prevod dokumenata kandidata na engleski (uverenje o studiranju, uverenje iz MUP-a).
 *
 * Ovaj fajl nema zavisnosti od baze ni mreže, da bi pravila bila testirana:
 *  - šta se traži od AI modela i u kom obliku se vraća prevod,
 *  - provera odgovora (čitljivost, vrsta dokumenta, ime),
 *  - stanje prevoda u dosijeu.
 *
 * Prevod se pravi isključivo iz otpremljenog originala. Ništa se ne dopunjuje iz prijave
 * kandidata, i ništa se ne izmišlja: nečitko se označava kao [illegible].
 */

export type TranslationDoc = 'faculty' | 'police'

export const TRANSLATION_DOCS: Record<
  TranslationDoc,
  {
    expectedType: TranslationDocumentType
    field: 'facultyCertTranslation' | 'policeCertTranslation'
    flag: 'facultyCertAiTranslation' | 'policeCertificateTranslated'
    labelSr: string
    sourceFileName: 'facultyCertFileName' | 'policeCertificateFileName'
    sourceUrl: 'facultyCertUrl' | 'policeCertificateUrl'
  }
> = {
  faculty: {
    expectedType: 'student_status_certificate',
    field: 'facultyCertTranslation',
    flag: 'facultyCertAiTranslation',
    labelSr: 'uverenje o studiranju',
    sourceFileName: 'facultyCertFileName',
    sourceUrl: 'facultyCertUrl',
  },
  police: {
    expectedType: 'police_clearance_certificate',
    field: 'policeCertTranslation',
    flag: 'policeCertificateTranslated',
    labelSr: 'uverenje o nekažnjavanju iz MUP-a',
    sourceFileName: 'policeCertificateFileName',
    sourceUrl: 'policeCertificateUrl',
  },
}

export function isTranslationDoc(value: unknown): value is TranslationDoc {
  return value === 'faculty' || value === 'police'
}

export type TranslationDocumentType = 'student_status_certificate' | 'police_clearance_certificate' | 'other'

export interface TranslationField {
  labelEn: string
  valueEn: string
}

export interface TranslationSection {
  fields: TranslationField[]
  headingEn: string
  paragraphsEn: string[]
}

export interface TranslationData {
  documentType: TranslationDocumentType
  issueDate: string
  issuerEn: string
  personName: string
  readable: boolean
  referenceNumber: string
  sections: TranslationSection[]
  sourceLanguage: string
  stampsAndSignatures: string[]
  titleEn: string
  translatorNotes: string[]
}

export type TranslationStatus = 'ready' | 'approved' | 'rejected'

/** Prevod u dosijeu kandidata (`facultyCertTranslation` / `policeCertTranslation`). */
export interface PortalTranslation {
  attempts?: string[]
  candidateConfirmedAt?: string | null
  candidateNote?: string
  createdAt: string
  data?: TranslationData
  doc: TranslationDoc
  editedByAgency?: boolean
  finalPdfUrl?: string
  model?: string
  rejectionReason?: string
  reviewedAt?: string
  reviewedBy?: string
  source: 'ai' | 'uploaded'
  sourceDocUrl: string
  sourceFileName: string
  sourceSha256: string
  status: TranslationStatus
  uploadedFileName?: string
  uploadedFileUrl?: string
  warnings: string[]
}

export const TRANSLATION_STATEMENT_VERSION = 'translation-2027.1'
export const MAX_AI_ATTEMPTS_PER_DAY = 5

/* ── Zahtev ka modelu ────────────────────────────────────────────────────── */

export const TRANSLATION_TOOL_NAME = 'record_translation'

export const TRANSLATION_SYSTEM_PROMPT = [
  'You are a professional translator from Serbian (Latin or Cyrillic script) into English.',
  'You translate official documents for a U.S. J-1 exchange program application.',
  'Translate the attached document faithfully and completely, and only what is actually written on it.',
  'Rules:',
  '- Never add, infer, complete or "fix" information that is not on the document. Do not use outside knowledge about the person.',
  '- Keep all numbers, dates, ID numbers, reference numbers and codes exactly as written.',
  '- Write personal names and place names in Serbian Latin script with diacritics (č, ć, š, ž, đ); transliterate Cyrillic to Latin. Do not anglicize names.',
  '- Translate institution names in their established official English form when one exists (e.g. "Univerzitet u Beogradu" → "University of Belgrade"); otherwise translate literally.',
  '- Where text cannot be read, write [illegible] in its place. Never guess.',
  '- Describe stamps, seals and signatures in square brackets, as sworn translators do, e.g. "[Round seal: Republic of Serbia, Ministry of Internal Affairs]", "[Signature]".',
  '- Preserve the structure of the document: headings, labelled fields, and running text paragraphs.',
  '- If the image is not a document, is blank, or is too blurry to translate reliably, set readable to false.',
  '- translatorNotes are for the agency staff and must be written in Serbian (Latin script). Note anything uncertain, partially illegible or ambiguous. Leave empty if nothing.',
  'Return the result only by calling the record_translation tool.',
].join('\n')

export function translationUserPrompt(doc: TranslationDoc) {
  const expected =
    doc === 'faculty'
      ? 'The applicant says this is a certificate of student status / enrollment issued by a faculty in Serbia (uverenje o studiranju / potvrda o statusu studenta).'
      : 'The applicant says this is a criminal record / police clearance certificate issued by the Ministry of Internal Affairs of Serbia or a court (uverenje o nekažnjavanju).'
  return `${expected} Check whether that is true and set documentType accordingly. Translate the document into English.`
}

const stringArray = { items: { type: 'string' }, type: 'array' } as const

export const TRANSLATION_TOOL = {
  description: 'Record the complete English translation of the attached document.',
  input_schema: {
    properties: {
      documentType: {
        description: 'What the document actually is.',
        enum: ['student_status_certificate', 'police_clearance_certificate', 'other'],
        type: 'string',
      },
      issueDate: {
        description: 'Date of issue exactly as on the document (YYYY-MM-DD only if unambiguous). Empty string if none.',
        type: 'string',
      },
      issuerEn: { description: 'Issuing institution in English. Empty string if none.', type: 'string' },
      personName: {
        description: 'Full name of the person the document is about, in Serbian Latin script, exactly as written. Empty string if none.',
        type: 'string',
      },
      readable: { description: 'false if the document cannot be translated reliably.', type: 'boolean' },
      referenceNumber: { description: 'Document/reference number as written. Empty string if none.', type: 'string' },
      sections: {
        items: {
          properties: {
            fields: {
              items: {
                properties: { labelEn: { type: 'string' }, valueEn: { type: 'string' } },
                required: ['labelEn', 'valueEn'],
                type: 'object',
              },
              type: 'array',
            },
            headingEn: { description: 'Section heading in English, or empty string.', type: 'string' },
            paragraphsEn: stringArray,
          },
          required: ['headingEn', 'fields', 'paragraphsEn'],
          type: 'object',
        },
        type: 'array',
      },
      sourceLanguage: { description: 'e.g. "Serbian (Cyrillic)" or "Serbian (Latin)".', type: 'string' },
      stampsAndSignatures: stringArray,
      titleEn: { description: 'Document title in English.', type: 'string' },
      translatorNotes: { ...stringArray, description: 'Notes for agency staff, in Serbian Latin script.' },
    },
    required: [
      'readable',
      'documentType',
      'sourceLanguage',
      'titleEn',
      'issuerEn',
      'personName',
      'issueDate',
      'referenceNumber',
      'sections',
      'stampsAndSignatures',
      'translatorNotes',
    ],
    type: 'object',
  },
  name: TRANSLATION_TOOL_NAME,
} as const

/* ── Čitanje i čišćenje odgovora ─────────────────────────────────────────── */

const MAX_TEXT = 4_000

function text(value: unknown, max = 600) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : ''
}

function texts(value: unknown, maxItems: number, max = MAX_TEXT) {
  return Array.isArray(value) ? value.map((v) => text(v, max)).filter(Boolean).slice(0, maxItems) : []
}

/** Pretvara odgovor modela (ili izmenu agencije) u ograničen, čist oblik. */
export function normalizeTranslationData(input: unknown): TranslationData {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const type = raw.documentType
  const sections = Array.isArray(raw.sections) ? raw.sections : []
  return {
    documentType:
      type === 'student_status_certificate' || type === 'police_clearance_certificate' ? type : 'other',
    issueDate: text(raw.issueDate, 60),
    issuerEn: text(raw.issuerEn, 300),
    personName: text(raw.personName, 200),
    readable: raw.readable !== false,
    referenceNumber: text(raw.referenceNumber, 120),
    sections: sections.slice(0, 30).map((s) => {
      const section = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
      const fields = Array.isArray(section.fields) ? section.fields : []
      return {
        fields: fields
          .slice(0, 60)
          .map((f) => {
            const field = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>
            return { labelEn: text(field.labelEn, 200), valueEn: text(field.valueEn, 1_000) }
          })
          .filter((f) => f.labelEn || f.valueEn),
        headingEn: text(section.headingEn, 200),
        paragraphsEn: texts(section.paragraphsEn, 40),
      }
    }),
    sourceLanguage: text(raw.sourceLanguage, 60),
    stampsAndSignatures: texts(raw.stampsAndSignatures, 20, 300),
    titleEn: text(raw.titleEn, 300),
    translatorNotes: texts(raw.translatorNotes, 20, 500),
  }
}

export function hasTranslatedContent(data: TranslationData) {
  return data.sections.some((s) => s.fields.length > 0 || s.paragraphsEn.length > 0)
}

/** Izvlači rezultat alata iz odgovora Messages API-ja. */
export function extractToolInput(response: unknown): unknown {
  const body = (response && typeof response === 'object' ? response : {}) as {
    content?: Array<{ input?: unknown; name?: string; type?: string }>
    stop_reason?: string
  }
  if (body.stop_reason === 'max_tokens') throw new Error('TRANSLATION_TRUNCATED')
  const block = body.content?.find((c) => c.type === 'tool_use' && c.name === TRANSLATION_TOOL_NAME)
  if (!block) throw new Error('TRANSLATION_NO_TOOL_RESULT')
  return block.input
}

/* ── Provera prevoda ─────────────────────────────────────────────────────── */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l',
  љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h',
  ц: 'c', ч: 'c', џ: 'dz', ш: 's',
}

/** Ime za poređenje: mala slova, bez dijakritika, ćirilica u latinicu. */
export function nameTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? ch)
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter((t) => t.length > 1)
}

/** Ime i prezime iz prijave se moraju naći na dokumentu (srednje ime ili dvostruko prezime ne smetaju). */
export function namesMatch(documentName: string, firstName: string, lastName: string) {
  const doc = new Set(nameTokens(documentName))
  const expected = [...nameTokens(firstName), ...nameTokens(lastName)]
  if (!doc.size || !expected.length) return null
  return expected.every((t) => doc.has(t))
}

function parseIssueDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const local = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?$/.exec(value)
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : []
  if (!y) return null
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return Number.isNaN(date.getTime()) ? null : date
}

export interface TranslationCheck {
  blocking: string | null
  warnings: string[]
}

/**
 * Provera posle prevoda. Blokira samo kad je jasno da prevod nema smisla (nečitljivo, pogrešan
 * dokument). Sve ostalo ide kao upozorenje kandidatu i agenciji.
 */
export function checkTranslation(
  doc: TranslationDoc,
  data: TranslationData,
  candidate: { firstName?: unknown; lastName?: unknown; name?: unknown },
  now = new Date(),
): TranslationCheck {
  const config = TRANSLATION_DOCS[doc]
  if (!data.readable || !hasTranslatedContent(data)) {
    return {
      blocking: 'Dokument nije dovoljno čitljiv za prevod. Okači jasniji sken ili fotografiju celog lista, bez odsjaja i senki.',
      warnings: [],
    }
  }
  if (data.documentType !== config.expectedType) {
    return {
      blocking: `Ovo ne izgleda kao ${config.labelSr}. Proveri da li si okačio pravi dokument.`,
      warnings: [],
    }
  }

  const warnings: string[] = []
  const first = typeof candidate.firstName === 'string' ? candidate.firstName : ''
  const last = typeof candidate.lastName === 'string' ? candidate.lastName : ''
  const fallback = typeof candidate.name === 'string' ? candidate.name : ''
  const match = first || last ? namesMatch(data.personName, first, last) : namesMatch(data.personName, fallback, '')
  if (!data.personName) {
    warnings.push('Na dokumentu nije pronađeno ime osobe.')
  } else if (match === false) {
    warnings.push(
      `Ime na dokumentu (${data.personName}) se ne poklapa sa imenom u prijavi (${`${first} ${last}`.trim() || fallback}).`,
    )
  }

  const issued = parseIssueDate(data.issueDate)
  if (doc === 'police' && issued) {
    const ageDays = (now.getTime() - issued.getTime()) / 86_400_000
    if (ageDays > 183) warnings.push('Uverenje je izdato pre više od 6 meseci. Proveri da li ga sponzor prihvata.')
  }
  if (issued && issued.getTime() > now.getTime() + 86_400_000) {
    warnings.push('Datum izdavanja na prevodu je u budućnosti. Proveri datum uz original.')
  }
  const illegible = JSON.stringify(data.sections).includes('[illegible]')
  if (illegible) warnings.push('Deo dokumenta nije čitljiv i označen je kao [illegible].')

  return { blocking: null, warnings: [...warnings, ...data.translatorNotes] }
}

/* ── Stanje u dosijeu ────────────────────────────────────────────────────── */

export function readTranslation(candidate: Record<string, unknown>, doc: TranslationDoc): PortalTranslation | null {
  const value = candidate[TRANSLATION_DOCS[doc].field]
  return value && typeof value === 'object' ? (value as PortalTranslation) : null
}

/** Prevod je „spreman za dosije" kad ga je kandidat potvrdio (ili ga je agencija odobrila). */
export function translationAccepted(t: PortalTranslation | null) {
  if (!t) return false
  if (t.status === 'approved') return true
  return t.status === 'ready' && Boolean(t.candidateConfirmedAt)
}

export function translationApproved(t: PortalTranslation | null) {
  return t?.status === 'approved'
}

/** Pokušaji AI prevoda u poslednja 24 sata (zaštita od troška). */
export function recentAttempts(attempts: string[] | undefined, now = new Date()) {
  return (attempts || []).filter((at) => now.getTime() - new Date(at).getTime() < 86_400_000)
}

/** Javni prikaz prevoda (kandidatu): bez internih podataka o pregledu. */
export function translationFlags(candidate: Record<string, unknown>) {
  return {
    facultyCertAiTranslation: translationAccepted(readTranslation(candidate, 'faculty')),
    policeCertificateTranslated: translationAccepted(readTranslation(candidate, 'police')),
  }
}

/**
 * Uverenje bez prevoda (već je na engleskom ili dvojezično): kandidat to prijavi ('requested'),
 * agencija odobri ('approved'). Novi original briše ovu oznaku.
 */
export const NO_TRANSLATION_FIELD = {
  faculty: 'facultyCertNoTranslation',
  police: 'policeCertNoTranslation',
} as const satisfies Record<TranslationDoc, string>

export type NoTranslationState = '' | 'requested' | 'approved'

export function noTranslationState(candidate: Record<string, unknown>, doc: TranslationDoc): NoTranslationState {
  const value = candidate[NO_TRANSLATION_FIELD[doc]]
  return value === 'requested' || value === 'approved' ? value : ''
}
