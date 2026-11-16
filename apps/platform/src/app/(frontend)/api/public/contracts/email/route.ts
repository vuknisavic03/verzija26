import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState } from '@/modules/portal-sync/localStore.ts'
import {
  buildPortalContractDraft,
  portalContractFileName,
  renderPortalContractPdf,
} from '@/modules/portal-sync/portalContract.ts'
import { publicSiteUrl, renderContractEmail } from '@/modules/portal-sync/portalNotificationRules.ts'
import { deliverPortalEmail } from '@/modules/portal-sync/portalNotifications.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/** Šalje kandidatu ugovor sa njegovim podacima (PDF u prilogu) na email naloga. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)
  try {
    const state = await getPortalState()
    const candidate = state.candidates.find((c) => c.email.toLowerCase() === actor.email.toLowerCase())
    if (!candidate) return json({ message: 'Kandidat nije pronađen.' }, 404)
    const record = candidate as unknown as Record<string, unknown>
    const draft = buildPortalContractDraft(record)
    if (draft.missing.length) return json({ message: `Za ugovor nedostaje: ${draft.missing.join(', ')}.` }, 409)
    const bytes = await renderPortalContractPdf(draft)
    const firstName = String(candidate.firstName || '').trim()
    const sent = await deliverPortalEmail(
      candidate.email,
      renderContractEmail({ contractNumber: draft.facts.contractNumber, firstName, portalLink: `${publicSiteUrl()}/profil` }),
      `portal:contract-email:${candidate.email}:${new Date().toISOString().slice(0, 16)}`,
      'contractEmail',
      [{ content: Buffer.from(bytes).toString('base64'), filename: portalContractFileName(record, draft.facts.contractNumber) }],
    )
    if (!sent) return json({ message: 'Mejl trenutno ne može da se pošalje. Preuzmi ugovor ovde ili probaj ponovo za par minuta.' }, 502)
    return json({ email: candidate.email, message: `Ugovor je poslat na ${candidate.email}.` })
  } catch (error) {
    console.error('Contract email failed.', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return json({ message: 'Slanje nije uspelo. Preuzmi ugovor ovde.' }, 500)
  }
}
