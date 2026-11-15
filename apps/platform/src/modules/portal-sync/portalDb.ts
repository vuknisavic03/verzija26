import { createHash } from 'node:crypto'
import type { Payload } from 'payload'

import {
  decryptSensitiveBytes,
  encryptSensitiveBytes,
  readSensitiveDataKeyring,
} from '../candidate-documents/sensitiveDataCrypto.ts'

/**
 * Trajno skladište portala u Postgresu (kolekcije `portal-records` i `portal-documents`).
 *
 * - jedan red po kandidatu (`kind = candidate`, ključ = ID kandidata iz portala),
 * - jedan red `kind = settings` (ključ `__settings__`) za pozivnice, obaveštenja, FAQ, promocije
 *   i sadržaj sajta,
 * - dokumenta (data: URL-ovi iz portala) se vade iz dosijea, šifruju i čuvaju zasebno; u dosijeu
 *   ostaje samo link `/api/public/documents/upload?doc=<id>`.
 *
 * Upis nikad ne briše kandidate implicitno — brisanje ide samo preko `deletePortalRecord`, tako
 * da dva istovremena zahteva ne mogu jedan drugom da „pojedu“ zapise.
 */

export const SETTINGS_KEY = '__settings__'
export const MAX_PORTAL_DOCUMENT_BYTES = 10 * 1_024 * 1_024

type Json = Record<string, unknown>

export interface PortalSettingsData {
  announcements: unknown[]
  faqItems: unknown[]
  invitations: unknown[]
  jobs?: unknown[]
  legacyImportedAt?: string
  promotions: unknown[]
  siteContent: Record<string, unknown>
}

export interface PortalDbSnapshot {
  candidates: Json[]
  settings: PortalSettingsData | null
}

function candidateKey(candidate: Json) {
  const id = candidate.id
  if (id !== undefined && id !== null && String(id).trim()) return String(id).trim()
  return `email:${String(candidate.email || '').trim().toLowerCase()}`
}

export async function readPortalDb(payload: Payload): Promise<PortalDbSnapshot> {
  const rows = await payload.find({
    collection: 'portal-records',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    sort: 'createdAt',
  })
  let settings: PortalSettingsData | null = null
  const candidates: Json[] = []
  for (const row of rows.docs) {
    if (row.kind === 'settings') settings = row.data as unknown as PortalSettingsData
    else if (row.data && typeof row.data === 'object') candidates.push(decryptFields(row.data as Json))
  }
  return { candidates, settings }
}

/* ── Dokumenta ──────────────────────────────────────────────────────────── */

const DATA_URL = /^data:([a-z0-9.+/-]+);base64,(.+)$/i

/** Polje sa data: URL-om → polje u koje ide link (cvDataUrl → cvUrl, passportImage → passportScanUrl). */
function linkFieldFor(field: string) {
  if (field === 'passportImage') return 'passportScanUrl'
  if (field.endsWith('DataUrl')) return `${field.slice(0, -'DataUrl'.length)}Url`
  return null
}

function fileNameFieldFor(field: string) {
  if (field === 'passportImage' || field === 'passportScanDataUrl') return 'passportScanFileName'
  if (field.endsWith('DataUrl')) return `${field.slice(0, -'DataUrl'.length)}FileName`
  return null
}

const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function documentContext(sha256: string) {
  return `portal-document:${sha256}`
}

export function portalDocumentUrl(id: number | string) {
  return `/api/public/documents/upload?doc=${encodeURIComponent(String(id))}`
}

/** Čuva bajtove dokumenta šifrovano; isti sadržaj za isto polje istog kandidata se ne duplira. */
export async function storePortalDocument(
  payload: Payload,
  input: { bytes: Uint8Array; email: string; field: string; fileName: string; mimeType: string; recordKey: string },
) {
  if (input.bytes.length === 0) throw new Error('EMPTY_DOCUMENT')
  if (input.bytes.length > MAX_PORTAL_DOCUMENT_BYTES) throw new Error('DOCUMENT_TOO_LARGE')
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  const email = input.email.trim().toLowerCase()

  const existing = await payload.find({
    collection: 'portal-documents',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ email: { equals: email } }, { field: { equals: input.field } }, { sha256: { equals: sha256 } }],
    },
  })
  if (existing.docs[0]) return { id: existing.docs[0].id, url: portalDocumentUrl(existing.docs[0].id) }

  const encrypted = encryptSensitiveBytes(input.bytes, readSensitiveDataKeyring(), documentContext(sha256))
  const created = await payload.create({
    collection: 'portal-documents',
    data: {
      authTag: encrypted.authTag,
      ciphertext: encrypted.ciphertext,
      email,
      field: input.field,
      fileName: input.fileName.replace(/[\\/]/g, '_').slice(0, 200) || 'dokument',
      iv: encrypted.iv,
      keyId: encrypted.keyId,
      mimeType: input.mimeType,
      recordKey: input.recordKey,
      sha256,
      sizeBytes: input.bytes.length,
    },
    overrideAccess: true,
  })
  return { id: created.id, url: portalDocumentUrl(created.id) }
}

export async function readPortalDocument(payload: Payload, id: number | string) {
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) return null
  const doc = await payload
    .findByID({ collection: 'portal-documents', depth: 0, id: numericId, overrideAccess: true, showHiddenFields: true })
    .catch(() => null)
  if (!doc) return null
  const bytes = decryptSensitiveBytes(
    { authTag: doc.authTag, ciphertext: doc.ciphertext, iv: doc.iv, keyId: doc.keyId },
    readSensitiveDataKeyring(),
    documentContext(doc.sha256),
  )
  return { bytes, email: doc.email, fileName: doc.fileName, mimeType: doc.mimeType }
}

/**
 * Vadi data: URL-ove iz dosijea u šifrovana dokumenta. Ako šifrovanje nije podešeno
 * (nedostaju SENSITIVE_DATA_* ključevi), dosije se čuva kakav jeste da se ništa ne izgubi.
 */
async function extractDocuments(payload: Payload, candidate: Json, recordKey: string): Promise<Json> {
  const email = String(candidate.email || '').trim().toLowerCase()
  if (!email) return candidate
  const result: Json = { ...candidate }
  for (const [field, value] of Object.entries(candidate)) {
    if (typeof value !== 'string' || !value.startsWith('data:')) continue
    const linkField = linkFieldFor(field)
    if (!linkField) continue
    const match = value.match(DATA_URL)
    if (!match) continue
    const mimeType = match[1].toLowerCase()
    const bytes = Buffer.from(match[2], 'base64')
    const nameField = fileNameFieldFor(field)
    const declaredName = nameField && typeof candidate[nameField] === 'string' ? String(candidate[nameField]) : ''
    const fileName = declaredName || `${linkField.replace(/Url$/, '')}.${EXTENSION[mimeType] || 'bin'}`
    try {
      const stored = await storePortalDocument(payload, { bytes, email, field: linkField, fileName, mimeType, recordKey })
      result[linkField] = stored.url
      delete result[field]
      if (field === 'passportImage') delete result.passportScanDataUrl
      if (field === 'passportScanDataUrl') delete result.passportImage
    } catch (error) {
      console.error(
        'Portal document could not be stored encrypted; keeping it inline.',
        error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      )
    }
  }
  return result
}

/* ── Šifrovanje osetljivih polja ───────────────────────────────────────────
 * JMBG, brojevi dokumenata, podaci žiranta i DS-160 odgovori u bazi stoje samo šifrovani
 * (AES-256-GCM, SENSITIVE_DATA_*). Ostatak koda ih vidi dešifrovane, kao i ranije.
 */

export const SENSITIVE_RECORD_FIELDS = [
  'jmbg',
  'idCardNumber',
  'passportNumber',
  'guarantor',
  'ds160',
  'facultyCertTranslation',
  'policeCertTranslation',
] as const

type EncryptedField = { __enc: { authTag: string; ciphertext: string; iv: string; keyId: string } }

function isEncryptedField(value: unknown): value is EncryptedField {
  return Boolean(value && typeof value === 'object' && '__enc' in (value as Json))
}

function fieldContext(field: string) {
  return `portal-record-field:${field}`
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ''
}

export function encryptFields(data: Json): Json {
  let keyring: ReturnType<typeof readSensitiveDataKeyring>
  try {
    keyring = readSensitiveDataKeyring()
  } catch (error) {
    console.error(
      'Sensitive portal fields stored without encryption: SENSITIVE_DATA_* is not configured.',
      error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    )
    return data
  }
  const out: Json = { ...data }
  for (const field of SENSITIVE_RECORD_FIELDS) {
    const value = out[field]
    if (isEmpty(value) || isEncryptedField(value)) continue
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
    out[field] = { __enc: encryptSensitiveBytes(plaintext, keyring, fieldContext(field)) }
  }
  return out
}

export function decryptFields(data: Json): Json {
  if (!SENSITIVE_RECORD_FIELDS.some((field) => isEncryptedField(data[field]))) return data
  const keyring = readSensitiveDataKeyring()
  const out: Json = { ...data }
  for (const field of SENSITIVE_RECORD_FIELDS) {
    const value = out[field]
    if (!isEncryptedField(value)) continue
    out[field] = JSON.parse(decryptSensitiveBytes(value.__enc, keyring, fieldContext(field)).toString('utf8'))
  }
  return out
}

/* ── Upis ───────────────────────────────────────────────────────────────── */

async function upsertRow(
  payload: Payload,
  existing: Map<string, { id: number | string; json: string }>,
  key: string,
  kind: 'candidate' | 'settings',
  email: string | undefined,
  data: Json,
) {
  // Poređenje ide nad dešifrovanim sadržajem (šifrat je svaki put drugačiji zbog IV-a).
  const json = JSON.stringify(data)
  const current = existing.get(key)
  if (current?.json === json) return
  const stored = kind === 'candidate' ? encryptFields(data) : data
  if (current) {
    await payload.update({ collection: 'portal-records', data: { data: stored, email }, id: current.id, overrideAccess: true })
    existing.set(key, { id: current.id, json })
  } else {
    const created = await payload.create({ collection: 'portal-records', data: { data: stored, email, key, kind }, overrideAccess: true })
    existing.set(key, { id: created.id, json })
  }
}

export async function writePortalDb(
  payload: Payload,
  state: { candidates: Json[]; settings: Omit<PortalSettingsData, 'legacyImportedAt'> },
  options: { legacyImportedAt?: string } = {},
) {
  const rows = await payload.find({
    collection: 'portal-records',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
  })
  const existing = new Map<string, { id: number | string; json: string }>()
  let previousSettings: PortalSettingsData | null = null
  for (const row of rows.docs) {
    const plain = row.kind === 'candidate' ? decryptFields(row.data as Json) : row.data
    // Red koji još nije šifrovan (stariji upis) dobija prazan otisak, pa se ponovo upiše šifrovan.
    const needsEncryption =
      row.kind === 'candidate' &&
      SENSITIVE_RECORD_FIELDS.some((f) => !isEmpty((row.data as Json)[f]) && !isEncryptedField((row.data as Json)[f]))
    existing.set(row.key, { id: row.id, json: needsEncryption ? '' : JSON.stringify(plain) })
    if (row.kind === 'settings') previousSettings = row.data as unknown as PortalSettingsData
  }

  // Kandidatu se ID menja (npr. `preapp-…` → ID iz baze). Stari red sa istim emailom se uklanja,
  // da ista osoba ne postoji dvaput. Dokumenta ostaju (vezana su za email i link u dosijeu).
  const emailOfKey = new Map<string, string>()
  for (const row of rows.docs) if (row.kind === 'candidate' && row.email) emailOfKey.set(row.key, row.email)

  const savedCandidates: Json[] = []
  for (const candidate of state.candidates) {
    const key = candidateKey(candidate)
    const clean = await extractDocuments(payload, candidate, key)
    // Pozivalac (npr. savePortalCandidate) vraća isti objekat pregledaču: neka i on dobije
    // linkove umesto ugrađenih fajlova.
    for (const field of Object.keys(candidate)) if (!(field in clean)) delete candidate[field]
    Object.assign(candidate, clean)
    const email = String(clean.email || '').trim().toLowerCase() || undefined
    await upsertRow(payload, existing, key, 'candidate', email, clean)
    savedCandidates.push(clean)
    if (email) {
      for (const [otherKey, otherEmail] of emailOfKey) {
        if (otherKey === key || otherEmail !== email) continue
        const stale = existing.get(otherKey)
        if (stale) await payload.delete({ collection: 'portal-records', id: stale.id, overrideAccess: true })
        existing.delete(otherKey)
        emailOfKey.delete(otherKey)
      }
      emailOfKey.set(key, email)
    }
  }

  const settings: PortalSettingsData = {
    ...state.settings,
    legacyImportedAt: options.legacyImportedAt || previousSettings?.legacyImportedAt,
  }
  await upsertRow(payload, existing, SETTINGS_KEY, 'settings', undefined, settings as unknown as Json)
  return savedCandidates
}

/** Brisanje kandidata i njegovih dokumenata (jedini put kojim zapis nestaje). */
export async function deletePortalRecord(payload: Payload, idOrEmail: string | number) {
  const needle = String(idOrEmail).trim()
  const lowered = needle.toLowerCase()
  const rows = await payload.find({
    collection: 'portal-records',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        { kind: { equals: 'candidate' } },
        { or: [{ key: { equals: needle } }, { email: { equals: lowered } }] },
      ],
    },
  })
  for (const row of rows.docs) {
    await payload.delete({
      collection: 'portal-documents',
      overrideAccess: true,
      where: row.email
        ? { or: [{ recordKey: { equals: row.key } }, { email: { equals: row.email } }] }
        : { recordKey: { equals: row.key } },
    })
    await payload.delete({ collection: 'portal-records', id: row.id, overrideAccess: true })
  }
  return rows.docs.length
}
