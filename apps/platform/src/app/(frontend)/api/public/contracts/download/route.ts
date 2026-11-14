import config from '@payload-config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { buildPortalContractDraft, renderPortalContractPdf } from '@/modules/portal-sync/portalContract.ts'
import { readPortalDocument } from '@/modules/portal-sync/portalDb.ts'
import { getPortalState, markPortalCandidateContractDownloaded } from '@/modules/portal-sync/localStore.ts'
import { renderResponsibilityStatementPdf } from '@/modules/generated-contracts/renderResponsibilityStatementPdf.ts'

function findDocFile(fileName: string): Buffer | null {
  const possiblePaths = [
    path.resolve(process.cwd(), 'public', 'documents', fileName),
    path.resolve(process.cwd(), 'apps', 'platform', 'public', 'documents', fileName),
    path.resolve(process.cwd(), 'front', 'public', 'documents', fileName),
    path.resolve(process.cwd(), 'dokumentazaswt', fileName),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p)
    }
  }
  return null
}

export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return new Response('Prijavite se ponovo.', { status: 401 })
  try {
    const url = new URL(request.url)
    // Kandidat uvek dobija sopstveni dokument; agencija bira kandidata po ID-ju ili emailu.
    const idOrEmail =
      actor.kind === 'candidate'
        ? actor.email
        : (url.searchParams.get('id') || url.searchParams.get('email') || '').trim().toLowerCase()
    const type = (url.searchParams.get('type') || '').trim().toLowerCase()

    const state = await getPortalState()
    const candidate =
      state.candidates.find(
        (c) => String(c.id).toLowerCase() === idOrEmail || c.email.toLowerCase() === idOrEmail,
      )

    if (!candidate) {
      return new Response('Kandidat nije pronađen.', { status: 404 })
    }

    // Mark as downloaded
    await markPortalCandidateContractDownloaded(candidate.id || candidate.email).catch(() => {})

    // Ugovor se uvek pravi iz sačuvanih podataka — nikad iz parametara u adresi (JMBG ne sme u URL)
    // i nikad sa izmišljenim vrednostima.
    const draft = buildPortalContractDraft(candidate as unknown as Record<string, unknown>)
    const candidateName = draft.facts.candidateName || 'Kandidat'
    const jmbg = draft.facts.jmbg
    const passportNumber = draft.facts.passportNumber
    const contractNumber = draft.facts.contractNumber
    const acceptance = (candidate as unknown as { contractAcceptance?: { acceptedAt: string; documentId: number; reference: string } }).contractAcceptance
    const isSigned = Boolean(acceptance)
    const signedAt = acceptance ? new Date(acceptance.acceptedAt) : undefined
    const signedReference = acceptance?.reference

    const isSelf = String(candidate.packageId || '').toLowerCase().includes('self') || String(candidate.packageName || '').toLowerCase().includes('self')

    const safeLast = (candidate.lastName || 'Kandidat')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'dj')
      .replace(/Đ/g, 'Dj')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeFirst = (candidate.firstName || 'AA')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'dj')
      .replace(/Đ/g, 'Dj')
      .replace(/[^a-zA-Z0-9_-]/g, '_')

    // 1. Zvanična saglasnost i važne informacije
    if (type === 'consent' || type === 'saglasnost') {
      const bytes = findDocFile('Saglasnost_Vazne_informacije_SWT_USA_2027.pdf')
      if (bytes) {
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="Saglasnost_Vazne_informacije_SWT_USA_2027.pdf"`,
            'Content-Type': 'application/pdf',
          },
        })
      }
    }

    // 2. Prilog 1 - Promocije i popusti
    if (type === 'promotions' || type === 'prilog1') {
      const bytes = findDocFile('Prilog_1_Promocije_i_popusti_2026.pdf')
      if (bytes) {
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="Prilog_1_Promocije_i_popusti.pdf"`,
            'Content-Type': 'application/pdf',
          },
        })
      }
    }

    // 3. Zvanični originalni ugovor agencije
    if (type === 'official' || url.searchParams.get('official') === 'true') {
      const targetDoc = isSelf ? 'SELF_UGOVOR_2027.pdf' : 'FULL_Lifeguard_UGOVOR_2027.pdf'
      const bytes = findDocFile(targetDoc)
      if (bytes) {
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${targetDoc}"`,
            'Content-Type': 'application/pdf',
          },
        })
      }
    }

    // 4. Izjava o odgovornosti
    if (type === 'statement' || type === 'izjava') {
      const statementPdfBytes = await renderResponsibilityStatementPdf({
        acceptedAt: signedAt,
        candidateName,
        contractNumber,
        date: new Date(),
        isAccepted: isSigned,
        jmbg,
        passportNumber,
        reference: signedReference,
        sourceInfo: candidate.referredBy ? `Preporuka (${candidate.referredBy})` : 'Zvanični portal i preporuka',
      })

      return new Response(new Uint8Array(statementPdfBytes), {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="Izjava_o_odgovornosti_${safeLast}_${safeFirst}.pdf"`,
          'Content-Type': 'application/pdf',
        },
      })
    }

    // 5. Ugovor: zvaničan tekst agencije + prilog sa podacima + Izjava.
    //    Prihvaćen ugovor se vraća tačno onakav kakav je sačuvan pri potpisu.
    if (acceptance?.documentId) {
      const payload = await getPayload({ config })
      const stored = await readPortalDocument(payload, acceptance.documentId)
      if (stored) {
        return new Response(new Uint8Array(stored.bytes), {
          headers: {
            'Cache-Control': 'private, no-store',
            'Content-Disposition': `attachment; filename="${stored.fileName}"`,
            'Content-Type': 'application/pdf',
          },
        })
      }
    }
    if (draft.missing.length > 0) {
      return new Response(`Za ugovor nedostaje: ${draft.missing.join(', ')}.`, {
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
        status: 409,
      })
    }
    const pdfBytes = await renderPortalContractPdf(draft)
    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="Ugovor_${contractNumber}_${safeLast}_${safeFirst}.pdf"`,
        'Content-Type': 'application/pdf',
      },
    })
  } catch (error) {
    console.error('Contract PDF generation failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return new Response('Greška pri kreiranju PDF ugovora.', { status: 500 })
  }
}
