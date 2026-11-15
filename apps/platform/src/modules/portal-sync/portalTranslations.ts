import config from '@payload-config'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'

import { getPortalState, savePortalCandidate } from './localStore.ts'
import { readPortalDocument, storePortalDocument } from './portalDb.ts'
import { notifyCandidate } from './portalNotifications.ts'
import { translateWithAi, TranslationUnavailableError } from './portalTranslationAi.ts'
import { renderTranslationPdf } from './portalTranslationPdf.ts'
import {
  checkTranslation,
  hasTranslatedContent,
  MAX_AI_ATTEMPTS_PER_DAY,
  normalizeTranslationData,
  type PortalTranslation,
  readTranslation,
  recentAttempts,
  TRANSLATION_DOCS,
  type TranslationData,
  type TranslationDoc,
} from './portalTranslationRules.ts'

export class PortalTranslationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type Candidate = Record<string, unknown> & { email?: string; id: number | string }

async function load(email: string) {
  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === email) as unknown as
    | Candidate
    | undefined
  if (!candidate) throw new PortalTranslationError('Profil nije pronađen.', 404)
  return candidate
}

export function documentIdFromUrl(url: unknown) {
  const match = /[?&]doc=([A-Za-z0-9_-]+)/.exec(String(url || ''))
  return match ? match[1] : null
}

async function readOriginal(candidate: Candidate, doc: TranslationDoc) {
  const config_ = TRANSLATION_DOCS[doc]
  const id = documentIdFromUrl(candidate[config_.sourceUrl])
  if (!id) throw new PortalTranslationError(`Prvo okači ${config_.labelSr}.`, 409)
  const payload = await getPayload({ config })
  const original = await readPortalDocument(payload, id)
  if (!original || String(original.email).toLowerCase() !== String(candidate.email).toLowerCase()) {
    throw new PortalTranslationError('Original nije pronađen. Okači dokument ponovo.', 404)
  }
  return {
    bytes: original.bytes,
    fileName: original.fileName || String(candidate[config_.sourceFileName] || 'dokument'),
    mimeType: original.mimeType,
    sha256: createHash('sha256').update(original.bytes).digest('hex'),
    url: String(candidate[config_.sourceUrl]),
  }
}

function withTranslation(candidate: Candidate, doc: TranslationDoc, translation: PortalTranslation | null) {
  const { field, flag } = TRANSLATION_DOCS[doc]
  const accepted =
    translation !== null &&
    (translation.status === 'approved' || (translation.status === 'ready' && Boolean(translation.candidateConfirmedAt)))
  return { ...candidate, [field]: translation, [flag]: accepted }
}

function attemptsOf(candidate: Candidate) {
  const value = candidate.translationAttempts
  return (value && typeof value === 'object' ? value : {}) as Partial<Record<TranslationDoc, string[]>>
}

/** AI prevod otpremljenog originala. Kandidat za sebe, agencija za bilo kog kandidata. */
export async function createAiTranslation(input: {
  doc: TranslationDoc
  email: string
  translate?: typeof translateWithAi
}) {
  const candidate = await load(input.email)
  const existing = readTranslation(candidate, input.doc)
  const original = await readOriginal(candidate, input.doc)
  if (existing?.status === 'approved' && existing.sourceSha256 === original.sha256) {
    throw new PortalTranslationError('Prevod ovog dokumenta je već odobren.', 409)
  }

  const now = new Date()
  const attempts = attemptsOf(candidate)
  const recent = recentAttempts(attempts[input.doc], now)
  if (recent.length >= MAX_AI_ATTEMPTS_PER_DAY) {
    throw new PortalTranslationError(
      'Danas si već nekoliko puta pokušao prevod ovog dokumenta. Pokušaj sutra ili okači overen prevod sudskog tumača.',
      429,
    )
  }
  // Pokušaj se upisuje pre poziva modela, da se ograničenje ne može zaobići ponovnim slanjem.
  const counted = await savePortalCandidate({
    ...(candidate as object),
    translationAttempts: { ...attempts, [input.doc]: [...recent, now.toISOString()] },
  } as never)

  let result: Awaited<ReturnType<typeof translateWithAi>>
  try {
    result = await (input.translate || translateWithAi)({
      bytes: original.bytes,
      doc: input.doc,
      mimeType: original.mimeType,
    })
  } catch (error) {
    if (error instanceof TranslationUnavailableError) throw new PortalTranslationError(error.message, error.status)
    throw error
  }

  const check = checkTranslation(input.doc, result.data, candidate as { firstName?: unknown; lastName?: unknown; name?: unknown }, now)
  if (check.blocking) throw new PortalTranslationError(check.blocking, 422)

  const translation: PortalTranslation = {
    candidateConfirmedAt: null,
    createdAt: now.toISOString(),
    data: result.data,
    doc: input.doc,
    model: result.model,
    source: 'ai',
    sourceDocUrl: original.url,
    sourceFileName: original.fileName,
    sourceSha256: original.sha256,
    status: 'ready',
    warnings: check.warnings,
  }
  return savePortalCandidate(withTranslation(counted as unknown as Candidate, input.doc, translation) as never)
}

/** Kandidat potvrđuje da je prevod proverio uz original. */
export async function confirmTranslation(input: { doc: TranslationDoc; email: string; note?: string }) {
  const candidate = await load(input.email)
  const translation = readTranslation(candidate, input.doc)
  if (!translation) throw new PortalTranslationError('Prevod još nije napravljen.', 409)
  if (translation.status !== 'ready') {
    throw new PortalTranslationError(
      translation.status === 'approved' ? 'Agencija je prevod već odobrila.' : 'Agencija je vratila ovaj prevod. Napravi novi.',
      409,
    )
  }
  const original = await readOriginal(candidate, input.doc)
  if (original.sha256 !== translation.sourceSha256) {
    throw new PortalTranslationError('Original se promenio posle prevoda. Napravi novi prevod.', 409)
  }
  return savePortalCandidate(
    withTranslation(candidate, input.doc, {
      ...translation,
      candidateConfirmedAt: translation.candidateConfirmedAt || new Date().toISOString(),
      candidateNote: (input.note || '').trim().slice(0, 1_000),
    }) as never,
  )
}

/** Overen prevod sudskog tumača koji je kandidat (ili agencija) okačio umesto AI prevoda. */
export async function attachUploadedTranslation(input: {
  doc: TranslationDoc
  email: string
  fileName: string
  fileUrl: string
}) {
  const candidate = await load(input.email)
  const original = await readOriginal(candidate, input.doc)
  const now = new Date().toISOString()
  return savePortalCandidate(
    withTranslation(candidate, input.doc, {
      candidateConfirmedAt: now,
      createdAt: now,
      doc: input.doc,
      source: 'uploaded',
      sourceDocUrl: original.url,
      sourceFileName: original.fileName,
      sourceSha256: original.sha256,
      status: 'ready',
      uploadedFileName: input.fileName,
      uploadedFileUrl: input.fileUrl,
      warnings: [],
    }) as never,
  )
}

/** Novi original poništava prethodni prevod. */
export function clearTranslation(candidate: Candidate, doc: TranslationDoc) {
  return withTranslation(candidate, doc, null)
}

/** Agencija: ispravka teksta, odobrenje ili vraćanje kandidatu. */
export async function reviewTranslation(input: {
  action: 'approve' | 'reject' | 'save'
  data?: unknown
  doc: TranslationDoc
  email: string
  reason?: string
  reviewer: string
}) {
  const candidate = await load(input.email)
  const translation = readTranslation(candidate, input.doc)
  if (!translation) throw new PortalTranslationError('Kandidat još nema prevod ovog dokumenta.', 409)
  if (translation.status === 'approved' && input.action !== 'reject') {
    throw new PortalTranslationError('Prevod je već odobren.', 409)
  }

  if (input.action === 'reject') {
    const reason = (input.reason || '').trim()
    if (reason.length < 3) throw new PortalTranslationError('Napiši kandidatu šta treba da ispravi.', 400)
    const label = input.doc === 'faculty' ? 'Uverenje o studiranju' : 'Uverenje o nekažnjavanju (MUP)'
    notifyCandidate(candidate, { details: { document: label, reason: reason.slice(0, 1_000) }, kind: 'translationRejected' })
    return savePortalCandidate(
      withTranslation(candidate, input.doc, {
        ...translation,
        rejectionReason: reason.slice(0, 1_000),
        reviewedAt: new Date().toISOString(),
        reviewedBy: input.reviewer,
        status: 'rejected',
      }) as never,
    )
  }

  let data: TranslationData | undefined = translation.data
  let edited = Boolean(translation.editedByAgency)
  if (input.data !== undefined) {
    if (translation.source !== 'ai') throw new PortalTranslationError('Okačen prevod sudskog tumača se ne menja.', 400)
    data = normalizeTranslationData({ ...input.data, readable: true })
    edited = true
  }

  if (input.action === 'save') {
    return savePortalCandidate(
      withTranslation(candidate, input.doc, { ...translation, data, editedByAgency: edited }) as never,
    )
  }

  // approve
  if (translation.status === 'rejected') {
    throw new PortalTranslationError('Ovaj prevod je vraćen kandidatu. Sačekaj novi prevod.', 409)
  }
  const original = await readOriginal(candidate, input.doc)
  if (original.sha256 !== translation.sourceSha256) {
    throw new PortalTranslationError('Original se promenio posle prevoda. Potreban je novi prevod.', 409)
  }
  const reviewedAt = new Date().toISOString()
  const approved: PortalTranslation = {
    ...translation,
    data,
    editedByAgency: edited,
    rejectionReason: '',
    reviewedAt,
    reviewedBy: input.reviewer,
    status: 'approved',
  }
  if (translation.source === 'ai') {
    if (!data || !hasTranslatedContent(data)) throw new PortalTranslationError('Prevod je prazan.', 400)
    const payload = await getPayload({ config })
    const stored = await storePortalDocument(payload, {
      bytes: await renderTranslationPdf(approved, data),
      email: String(candidate.email),
      field: `${TRANSLATION_DOCS[input.doc].field}Pdf`,
      fileName: `${input.doc === 'faculty' ? 'Certificate_of_Enrollment' : 'Police_Clearance'}_EN.pdf`,
      mimeType: 'application/pdf',
      recordKey: String(candidate.id),
    })
    approved.finalPdfUrl = stored.url
  }
  return savePortalCandidate(withTranslation(candidate, input.doc, approved) as never)
}

/** PDF prevoda: odobren (sačuvan), nacrt (pravi se na zahtev) ili okačen prevod sudskog tumača. */
export async function translationPdf(input: { doc: TranslationDoc; email: string }) {
  const candidate = await load(input.email)
  const translation = readTranslation(candidate, input.doc)
  if (!translation) throw new PortalTranslationError('Prevod još nije napravljen.', 404)
  const payload = await getPayload({ config })
  const storedId = documentIdFromUrl(
    translation.source === 'uploaded' ? translation.uploadedFileUrl : translation.status === 'approved' ? translation.finalPdfUrl : '',
  )
  if (storedId) {
    const stored = await readPortalDocument(payload, storedId)
    if (stored && String(stored.email).toLowerCase() === input.email) {
      return { bytes: stored.bytes, fileName: stored.fileName, mimeType: stored.mimeType }
    }
  }
  if (translation.source !== 'ai' || !translation.data) throw new PortalTranslationError('Prevod nije pronađen.', 404)
  return {
    bytes: await renderTranslationPdf(translation),
    fileName: `${input.doc === 'faculty' ? 'Certificate_of_Enrollment' : 'Police_Clearance'}_EN_draft.pdf`,
    mimeType: 'application/pdf',
  }
}
