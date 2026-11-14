import config from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState, savePortalCandidate } from '@/modules/portal-sync/localStore.ts'
import {
  acceptanceReference,
  buildPortalContractDraft,
  renderPortalContractPdf,
} from '@/modules/portal-sync/portalContract.ts'
import { storePortalDocument } from '@/modules/portal-sync/portalDb.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const schema = z.object({ confirm: z.literal(true), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict()

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/**
 * Elektronsko prihvatanje ugovora iz prijavljenog kandidatskog naloga.
 *
 * Kandidat šalje otisak sadržaja koji mu je prikazan; server ga ponovo izračunava iz sačuvanih
 * podataka i prihvata samo ako se poklapa. Konačan PDF (zvaničan ugovor + prilog + izjava +
 * dokaz) pravi se jednom, čuva šifrovano i posle toga se više ne generiše. Ponovljen zahtev
 * vraća isto prihvatanje.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ message: 'Potvrdi da prihvataš ugovor.' }, 400)

  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email) as
    | (Record<string, unknown> & { id: string | number })
    | undefined
  if (!candidate) return json({ message: 'Profil nije pronađen.' }, 404)

  if (candidate.contractAcceptance) {
    return json({ acceptance: candidate.contractAcceptance, alreadyAccepted: true })
  }

  const draft = buildPortalContractDraft(candidate)
  if (draft.missing.length > 0) {
    return json({ message: `Pre potpisa nedostaje: ${draft.missing.join(', ')}.`, missing: draft.missing }, 409)
  }
  if (draft.fingerprint !== parsed.data.fingerprint) {
    return json({ message: 'Podaci u ugovoru su se u međuvremenu promenili. Otvori ugovor ponovo i proveri ga.' }, 409)
  }

  try {
    const acceptedAt = new Date().toISOString()
    const acceptance = {
      acceptedAt,
      fingerprint: draft.fingerprint,
      reference: acceptanceReference(draft.fingerprint, acceptedAt, draft.facts.contractNumber),
      statement: draft.statement,
      statementVersion: draft.statementVersion,
    }
    const pdf = await renderPortalContractPdf(draft, acceptance)
    const payload = await getPayload({ config })
    const fileName = `Ugovor_${draft.facts.contractNumber}_potpisan.pdf`
    const stored = await storePortalDocument(payload, {
      bytes: pdf,
      email: actor.email,
      field: 'signedContractUrl',
      fileName,
      mimeType: 'application/pdf',
      recordKey: String(candidate.id),
    })
    const evidence = {
      ...acceptance,
      accountId: actor.id,
      contractNumber: draft.facts.contractNumber,
      documentId: stored.id,
      method: 'PORTAL_ELECTRONIC',
      officialFile: draft.facts.officialFile,
      officialSha256: draft.facts.officialSha256,
      userAgent: (request.headers.get('user-agent') || '').slice(0, 200),
    }
    await savePortalCandidate({
      ...(candidate as object),
      contractAcceptance: evidence,
      contractApproved: false,
      contractDownloaded: true,
      contractSigned: true,
      contractSignedAt: acceptedAt,
      contractSignedReference: acceptance.reference,
      contractVerificationStatus: 'pending',
      signedContractFileName: fileName,
      signedContractUploadedAt: acceptedAt,
      signedContractUrl: stored.url,
    } as never)
    return json({ acceptance: evidence, alreadyAccepted: false }, 201)
  } catch (error) {
    console.error('Contract acceptance failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return json({ message: 'Potpis trenutno nije uspeo. Pokušaj ponovo za par minuta.' }, 500)
  }
}
