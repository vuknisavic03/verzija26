import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState } from '@/modules/portal-sync/localStore.ts'
import { buildPortalContractDraft } from '@/modules/portal-sync/portalContract.ts'

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/**
 * Šta kandidat potpisuje: broj ugovora, tekst izjave, otisak sadržaja i šta još nedostaje.
 * Ako je ugovor već prihvaćen, vraća dokaz o prihvatanju.
 */
export async function GET() {
  const actor = await resolvePortalActor()
  if (actor.kind !== 'candidate') return json({ message: 'Prijavi se ponovo.' }, 401)

  const state = await getPortalState()
  const candidate = state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email)
  if (!candidate) return json({ message: 'Profil nije pronađen.' }, 404)

  const draft = buildPortalContractDraft(candidate as unknown as Record<string, unknown>)
  const acceptance = (candidate as unknown as Record<string, unknown>).contractAcceptance || null
  return json({
    acceptance,
    contractNumber: draft.facts.contractNumber,
    facts: {
      candidateName: draft.facts.candidateName,
      optionLabel: draft.facts.optionLabel,
      priceLabel: draft.facts.priceLabel,
      programLabel: draft.facts.programLabel,
    },
    fingerprint: draft.fingerprint,
    missing: draft.missing,
    statement: draft.statement,
    statementVersion: draft.statementVersion,
  })
}
