import {
  createPortalInvitation,
  deletePortalCandidate,
  getPortalState,
  savePortalAnnouncement,
  savePortalCandidate,
  savePortalCandidateDs160,
  savePortalFaq,
  savePortalPromotions,
  savePortalSiteContent,
  signPortalCandidateContract,
  resetPortalInvitation,
  type PortalFaqItem,
  type PortalPromotion,
} from '@/modules/portal-sync/localStore.ts'
import {
  acceptOrGenerateInvitationCode,
  resolvePortalActor,
  sanitizeCandidateUpdate,
} from '@/modules/portal-sync/access.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const MAXIMUM_BODY_SIZE = 25 * 1_024 * 1_024

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })
}

/**
 * Stanje portala. Zahteva prijavu:
 * - agencija (kolekcija `users`) dobija sve,
 * - kandidat dobija samo svoj zapis i javni sadržaj (obaveštenja, FAQ, promocije),
 * - bez prijave: 401.
 */
export async function GET() {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return json({ message: 'Prijavite se ponovo.' }, 401)

  try {
    const state = await getPortalState()
    if (actor.kind === 'admin') return json(state)

    const candidate =
      state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email) || null
    const announcements = (state.announcements || []).filter((a) => {
      const to = String(a.to || '').toLowerCase()
      return !to.includes('@') || to.includes(actor.email)
    })
    return json({
      announcements,
      candidate,
      candidates: candidate ? [candidate] : [],
      faqItems: state.faqItems,
      invitations: [],
      promotions: state.promotions || [],
      siteContent: state.siteContent,
    })
  } catch (error) {
    console.error('Failed to get portal state:', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Greška pri učitavanju stanja portala.' }, 500)
  }
}

const CANDIDATE_ACTIONS = new Set(['saveCandidate', 'saveDs160', 'signContract'])

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)

  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return json({ message: 'Prijavite se ponovo.' }, 401)

  const declaredSize = Number(request.headers.get('content-length') ?? 0)
  if (declaredSize > MAXIMUM_BODY_SIZE) return json({ message: 'Zahtev je prevelik.' }, 413)

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      payload?: Record<string, unknown>
    }
    const action = body.action
    const data = body.payload || {}

    if (!action) return json({ message: 'Nepoznata akcija.' }, 400)
    if (actor.kind === 'candidate' && !CANDIDATE_ACTIONS.has(action)) {
      return json({ message: 'Pristup odbijen.' }, 403)
    }

    // Kandidat radi isključivo nad sopstvenim zapisom, vezanim za email prijavljenog naloga.
    if (actor.kind === 'candidate') {
      const state = await getPortalState()
      const existing =
        state.candidates.find((c) => String(c.email || '').toLowerCase() === actor.email) || null
      if (!existing) return json({ message: 'Profil nije pronađen.' }, 404)

      if (action === 'saveCandidate') {
        const clean = sanitizeCandidateUpdate(
          data,
          existing as unknown as Record<string, unknown>,
          actor.email,
        )
        const candidate = await savePortalCandidate(clean)
        return json({ candidate, candidates: [candidate], invitations: [] })
      }
      if (action === 'saveDs160') {
        const answers = (data.ds160 || {}) as Record<string, string>
        const candidate = await savePortalCandidateDs160(existing.id, answers)
        return json({ candidate, success: true })
      }
      if (action === 'signContract') {
        const reference = typeof data.reference === 'string' ? data.reference : undefined
        const candidate = await signPortalCandidateContract(existing.id, reference)
        return json({ candidate, candidates: candidate ? [candidate] : [], success: true })
      }
    }

    // Odavde nadalje: samo agencija.

    if (action === 'createInvitation') {
      const invitation = await createPortalInvitation({
        basePrice: Number(data.basePrice) || undefined,
        candidateName: typeof data.candidateName === 'string' ? data.candidateName : '',
        code: acceptOrGenerateInvitationCode(data.code),
        discount: Number(data.discount) || 0,
        discountNote: typeof data.discountNote === 'string' ? data.discountNote : '',
        email: String(data.email || ''),
        packageId: typeof data.packageId === 'string' ? data.packageId : 'swt-full',
        packageName: typeof data.packageName === 'string' ? data.packageName : undefined,
      })
      const state = await getPortalState()
      return json({ invitation, invitations: state.invitations }, 201)
    }

    if (action === 'saveCandidate') {
      const candidate = await savePortalCandidate(data)
      const state = await getPortalState()
      return json({
        candidate,
        candidates: state.candidates,
        invitations: state.invitations,
      })
    }

    if (action === 'resetInvitation') {
      const code = String(data.code || '')
      const res = await resetPortalInvitation(code)
      const state = await getPortalState()
      return json({ ...res, invitations: state.invitations })
    }

    if (action === 'deleteCandidate') {
      const id = (data.id || data.email || '') as string | number
      const candidates = await deletePortalCandidate(id)
      return json({ candidates })
    }

    if (action === 'saveAnnouncement') {
      const announcements = await savePortalAnnouncement({
        channel: typeof data.channel === 'string' ? data.channel : 'E-mail',
        date: typeof data.date === 'string' ? data.date : undefined,
        message: typeof data.message === 'string' ? data.message : '',
        subject: typeof data.subject === 'string' ? data.subject : 'Obaveštenje',
        to: typeof data.to === 'string' ? data.to : 'all',
      })
      const state = await getPortalState()
      return json({ announcements, candidates: state.candidates })
    }

    if (action === 'saveSiteContent') {
      const siteContent = await savePortalSiteContent(
        String(data.itemKey || ''),
        String(data.title || ''),
        String(data.content || ''),
      )
      return json({ siteContent })
    }

    if (action === 'saveFaq') {
      const items = Array.isArray(data.items) ? (data.items as PortalFaqItem[]) : []
      const faqItems = await savePortalFaq(items)
      return json({ faqItems })
    }

    if (action === 'savePromotions') {
      const promos = Array.isArray(data.promotions) ? (data.promotions as PortalPromotion[]) : []
      const saved = await savePortalPromotions(promos)
      return json({ promotions: saved })
    }

    if (action === 'saveDs160') {
      const targetId = (data.candidateId || data.email || '') as string | number
      const answers = (data.ds160 || {}) as Record<string, string>
      const candidate = await savePortalCandidateDs160(targetId, answers)
      return json({ candidate, success: true })
    }

    if (action === 'signContract') {
      const targetId = (data.candidateId || data.id || data.email || '') as string | number
      const reference = typeof data.reference === 'string' ? data.reference : undefined
      const candidate = await signPortalCandidateContract(targetId, reference)
      const state = await getPortalState()
      return json({ candidate, candidates: state.candidates, success: true })
    }

    return json({ message: 'Nepoznata akcija.' }, 400)
  } catch (error) {
    console.error('Portal state action failed:', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Greška pri izvršavanju akcije na serveru.' }, 500)
  }
}
