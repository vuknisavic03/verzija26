import fs from 'node:fs'
import path from 'node:path'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import {
  deletePortalDocument,
  MAX_PORTAL_DOCUMENT_BYTES,
  readPortalDocument,
  storePortalDocument,
} from '@/modules/portal-sync/portalDb.ts'
import { getPortalState, savePortalCandidate } from '@/modules/portal-sync/localStore.ts'
import {
  DocumentRemovalError,
  documentIdFromUrl,
  isRemovableDocument,
  removeCandidateDocument,
} from '@/modules/portal-sync/portalDocumentRemoval.ts'
import { notifyAgencyChanges } from '@/modules/portal-sync/portalNotifications.ts'
import { attachUploadedTranslation, clearTranslation, PortalTranslationError } from '@/modules/portal-sync/portalTranslations.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })
}

/** Kandidat briše dokument koji je okačio (CV, uverenja, potpisan ugovor). */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)
  const type = new URL(request.url).searchParams.get('type') || ''
  if (!isRemovableDocument(type)) return json({ message: 'Ovaj dokument ne može da se obriše.' }, 400)
  try {
    const state = await getPortalState()
    const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email.toLowerCase())
    if (!candidate) return json({ message: 'Profil nije pronađen.' }, 404)
    const { label, next, url } = removeCandidateDocument(candidate as unknown as Record<string, unknown>, type)
    const saved = await savePortalCandidate(next as never)
    // Isti fajl se čuva jednom: briši ga samo ako ga više ništa u dosijeu ne koristi.
    const docId = documentIdFromUrl(url)
    if (docId && !JSON.stringify(saved).includes(`doc=${docId}"`)) {
      const payload = await getPayload({ config })
      const doc = await readPortalDocument(payload, docId)
      if (doc && doc.email === actor.email) await deletePortalDocument(payload, docId)
    }
    return json({ candidate: saved, message: `${label} je obrisan.`, success: true })
  } catch (error) {
    if (error instanceof DocumentRemovalError) return json({ message: error.message }, error.status)
    console.error('Document removal failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Brisanje nije uspelo. Probaj ponovo.' }, 500)
  }
}

export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return new Response('Prijavite se ponovo.', { status: 401 })
  try {
    const url = new URL(request.url)
    const docId = url.searchParams.get('doc')
    if (docId) {
      const payload = await getPayload({ config })
      const doc = await readPortalDocument(payload, docId)
      if (!doc || (actor.kind === 'candidate' && doc.email !== actor.email)) {
        return new Response('Dokument nije pronađen.', { status: 404 })
      }
      return new Response(new Uint8Array(doc.bytes), {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `inline; filename="${encodeURIComponent(doc.fileName)}"`,
          'Content-Type': doc.mimeType,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    const preview = url.searchParams.get('preview') || url.searchParams.get('name')
    if (preview) {
      const safeName = path.basename(preview)
      // Kandidat sme da otvori samo sopstvene fajlove (ime fajla sadrži njegov ID).
      if (actor.kind === 'candidate') {
        const state = await getPortalState()
        const own = state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email)
        const ownId = own ? String(own.id).replace(/[^a-zA-Z0-9_-]/g, '_') : null
        if (!ownId || !safeName.includes(`-${ownId}-`)) {
          return new Response('Dokument nije pronađen.', { status: 404 })
        }
      }
      const filePath = path.resolve(process.cwd(), '.data', 'uploads', safeName)
      if (fs.existsSync(filePath)) {
        const fileBytes = fs.readFileSync(filePath)
        const ext = path.extname(safeName).toLowerCase()
        const mimeMap: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
        }
        const contentType = mimeMap[ext] || 'application/octet-stream'
        return new Response(fileBytes, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${safeName}"`,
          },
        })
      }
    }
    return new Response('Dokument nije pronađen.', { status: 404 })
  } catch {
    return new Response('Greška pri preuzimanju dokumenta.', { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.', success: false }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return json({ message: 'Prijavite se ponovo.', success: false }, 401)
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const docType = String(formData.get('type') || 'cv')
    // Kandidat uvek otprema za sebe; agencija bira kandidata emailom.
    const email =
      actor.kind === 'candidate'
        ? actor.email
        : String(formData.get('email') || '').trim().toLowerCase()

    if (!(file instanceof File) || file.size === 0) {
      return json({ message: 'Nije priložen validan fajl.', success: false }, 400)
    }

    if (file.size > 15 * 1024 * 1024) {
      return json({ message: 'Fajl je prevelik (maksimalno 15 MB).', success: false }, 413)
    }

    const state = await getPortalState()
    const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === email)
    if (!candidate) return json({ message: 'Kandidat nije pronađen.', success: false }, 404)

    // Posle odobrenja dosijea kandidat ne menja uverenja ni prevode (to bi poništilo odobren prevod).
    const dossierDocs = ['facultyCert', 'policeCert', 'facultyCertTranslation', 'policeCertTranslation']
    if (actor.kind === 'candidate' && dossierDocs.includes(docType) && candidate.documentsApproved === true) {
      return json({ message: 'Dosije je već odobren. Za izmenu dokumenta javi se agenciji.', success: false }, 409)
    }

    // Fajl se čuva šifrovano u bazi (portal-documents), ne na disku kontejnera.
    const rawBytes = Buffer.from(await file.arrayBuffer())
    if (rawBytes.length > MAX_PORTAL_DOCUMENT_BYTES) {
      return json({ message: 'Fajl je prevelik (maksimalno 10 MB).', success: false }, 413)
    }
    const ext = path.extname(file.name).toLowerCase()
    const mime = file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg')
    const translationUpload =
      docType === 'facultyCertTranslation' ? 'faculty' : docType === 'policeCertTranslation' ? 'police' : null
    const linkField = translationUpload
      ? `${docType}Upload`
      : docType === 'facultyCert'
        ? 'facultyCertUrl'
        : docType === 'signedContract' || docType === 'contract'
          ? 'signedContractUrl'
          : docType === 'policeCert'
            ? 'policeCertificateUrl'
            : docType === 'passport'
              ? 'passportScanUrl'
              : 'cvUrl'
    const payload = await getPayload({ config })
    let fileUrl: string
    try {
      const stored = await storePortalDocument(payload, {
        bytes: rawBytes,
        email,
        field: linkField,
        fileName: file.name,
        mimeType: mime,
        recordKey: String(candidate.id),
      })
      fileUrl = stored.url
    } catch (error) {
      console.error('Encrypted document storage failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
      return json({ message: 'Dokument trenutno ne može da se sačuva. Pokušaj ponovo.', success: false }, 503)
    }
    // Pregled odmah posle otpremanja ide samo u odgovor, ne u dosije.
    const previewDataUrl = rawBytes.length < 5 * 1024 * 1024
      ? `data:${mime};base64,${rawBytes.toString('base64')}`
      : undefined

    // Overen prevod sudskog tumača (umesto AI prevoda).
    if (translationUpload) {
      try {
        await attachUploadedTranslation({ doc: translationUpload, email, fileName: file.name, fileUrl })
      } catch (error) {
        if (error instanceof PortalTranslationError) return json({ message: error.message, success: false }, error.status)
        throw error
      }
      return json({
        fileName: file.name,
        fileUrl,
        message: 'Prevod je okačen. Agencija će ga proveriti uz original.',
        success: true,
      })
    }

    // Novi original poništava prethodni prevod: prevod mora da odgovara tačno ovom fajlu.
    if (docType === 'facultyCert') {
      await savePortalCandidate({
        ...clearTranslation(candidate as never, 'faculty'),
        facultyCertFileName: file.name,
        facultyCertUrl: fileUrl,
        facultyCertDataUrl: undefined,
        facultyCertUploadedAt: new Date().toISOString(),
      } as never)

      return json({
        fileName: file.name,
        fileUrl,
        previewDataUrl,
        message: 'Uverenje je otpremljeno. Sledeći korak: prevod na engleski.',
        success: true,
      })
    }

    if (docType === 'signedContract' || docType === 'contract') {
      if (candidate) {
        const updated = {
          ...candidate,
          // Novi potpisan ugovor uvek ide na proveru agencije.
          contractApproved: false,
          contractRejectionReason: '',
          contractVerificationStatus: 'pending',
          contractDownloaded: true,
          contractSigned: true,
          contractSignedAt: new Date().toISOString(),
          contractSignedReference: `AA-POTPIS-${String(candidate.id).replace(/[^0-9]/g, '').slice(-4) || '1042'}-${Date.now().toString(36).toUpperCase()}`,
          signedContractFileName: file.name,
          signedContractUploadedAt: new Date().toISOString(),
          signedContractUrl: fileUrl,
          signedContractDataUrl: undefined,
        }
        await savePortalCandidate(updated as never)
        notifyAgencyChanges(candidate as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>)
      }

      return json({
        fileName: file.name,
        fileUrl,
        previewDataUrl,
        message: 'Potpisan ugovor je okačen. Uplata ti je otvorena, a agencija proverava ugovor.',
        success: true,
      })
    }

    if (docType === 'policeCert') {
      if (candidate) {
        await savePortalCandidate({
          ...clearTranslation(candidate as never, 'police'),
          policeCertificateFileName: file.name,
          policeCertificateUrl: fileUrl,
          policeCertificateDataUrl: undefined,
          policeCertificateUploaded: true,
          policeCertificateUploadedAt: new Date().toISOString(),
        } as never)
      }

      return json({
        fileName: file.name,
        fileUrl,
        previewDataUrl,
        message: 'Uverenje iz MUP-a je otpremljeno. Sledeći korak: prevod na engleski.',
        success: true,
      })
    }

    if (docType === 'passport') {
      if (candidate) {
        await savePortalCandidate({
          ...candidate,
          passportScanFileName: file.name,
          passportScanUrl: fileUrl,
          passportScanDataUrl: undefined,
          passportImage: undefined,
        })
      }

      return json({
        fileName: file.name,
        fileUrl,
        previewDataUrl,
        message: 'Sken biometrijskog pasoša je uspešno otpremljen.',
        success: true,
      })
    }

    // Default: CV upload
    if (candidate) {
      await savePortalCandidate({
        ...candidate,
        cvFileName: file.name,
        cvUrl: fileUrl,
        cvDataUrl: undefined,
        cvUploadedAt: new Date().toISOString(),
      })
    }

    return json({
      fileName: file.name,
      fileUrl,
      previewDataUrl,
      message: 'CV je uspešno otpremljen.',
      success: true,
    })
  } catch (error) {
    console.error('Document upload error:', error)
    return json({ message: 'Greška pri otpremanju dokumenta.', success: false }, 500)
  }
}
