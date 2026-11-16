import {
  createPortalInvitation,
  deletePortalCandidate,
  getPortalState,
  savePortalAnnouncement,
  savePortalCandidate,
  savePortalCandidateDs160,
  deletePortalJob,
  savePortalFaq,
  savePortalJob,
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
  keepServerManagedFields,
  sanitizeCandidateUpdate,
} from '@/modules/portal-sync/access.ts'
import { applyContractVerification, ContractVerificationError } from '@/modules/portal-sync/contractVerification.ts'
import { PortalJobError, selectPortalJob } from '@/modules/portal-sync/portalJobActions.ts'
import { normalizeJobInput, offeredJobsFor, publicJob } from '@/modules/portal-sync/portalJobs.ts'
import { notifyAgencyChanges, notifyCandidateChanges, sendInvitationEmail } from '@/modules/portal-sync/portalNotifications.ts'
import { readTranslation, translationApproved } from '@/modules/portal-sync/portalTranslationRules.ts'
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
      jobs: candidate ? offeredJobsFor(candidate as unknown as Record<string, unknown>, state.jobs || []).map(publicJob) : [],
      promotions: state.promotions || [],
      siteContent: state.siteContent,
    })
  } catch (error) {
    console.error('Failed to get portal state:', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Greška pri učitavanju stanja portala.' }, 500)
  }
}

// Ugovor se potpisuje svojeručno; potpisan sken ide preko /api/public/documents/upload (docType contract).
const CANDIDATE_ACTIONS = new Set(['saveCandidate', 'saveDs160', 'selectJob'])

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
        notifyAgencyChanges(existing as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>)
        return json({ candidate, candidates: [candidate], invitations: [] })
      }
      if (action === 'selectJob') {
        try {
          const candidate = await selectPortalJob(actor.email, String(data.jobId || ''))
          return json({ candidate, candidates: [candidate] })
        } catch (error) {
          if (error instanceof PortalJobError) return json({ message: error.message }, error.status)
          throw error
        }
      }
      if (action === 'saveDs160') {
        const answers = (data.ds160 || {}) as Record<string, string>
        const candidate = await savePortalCandidateDs160(existing.id, answers)
        return json({ candidate, success: true })
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
      // Kandidatu odmah ide mejl sa kodom i linkom za registraciju.
      const emailSent = data.sendEmail === false ? false : await sendInvitationEmail(invitation)
      const state = await getPortalState()
      return json({ emailSent, invitation, invitations: state.invitations }, 201)
    }

    if (action === 'resendInvitation') {
      const code = String(data.code || '').trim().toUpperCase()
      const state = await getPortalState()
      const invitation = state.invitations.find((i) => i.code === code)
      if (!invitation) return json({ message: 'Pozivnica nije pronađena.' }, 404)
      if (invitation.status === 'registered') return json({ message: 'Kandidat se već registrovao.' }, 409)
      const emailSent = await sendInvitationEmail(invitation)
      return json({ emailSent, message: emailSent ? 'Pozivnica je ponovo poslata.' : 'Mejl trenutno nije poslat.' }, emailSent ? 200 : 502)
    }

    if (action === 'saveCandidate') {
      const before = await getPortalState()
      const email = String(data.email || '').toLowerCase()
      const existing = (before.candidates.find(
        (c) => (data.id !== undefined && String(c.id) === String(data.id)) || (email && String(c.email || '').toLowerCase() === email),
      ) || null) as unknown as Record<string, unknown> | null
      const next = keepServerManagedFields(data, existing)
      // Dosije se odobrava tek kad agencija odobri oba prevoda.
      if (next.documentsApproved === true && existing?.documentsApproved !== true) {
        const ready = (['faculty', 'police'] as const).every((doc) => translationApproved(readTranslation(next, doc)))
        if (!ready) {
          return json(
            { message: 'Dosije se odobrava tek kad odobriš oba prevoda (uverenje o studiranju i MUP uverenje).' },
            409,
          )
        }
      }
      const candidate = await savePortalCandidate(next as never)
      notifyCandidateChanges(existing, candidate as unknown as Record<string, unknown>)
      const state = await getPortalState()
      return json({
        candidate,
        candidates: state.candidates,
        invitations: state.invitations,
      })
    }

    // Overa ili vraćanje potpisanog ugovora: nad trenutnim zapisom sa servera, uz obaveštenje kandidatu.
    if (action === 'verifyContract') {
      const before = await getPortalState()
      const email = String(data.email || '').toLowerCase()
      const existing = before.candidates.find((c) => String(c.email || '').toLowerCase() === email)
      if (!existing) return json({ message: 'Kandidat nije pronađen.' }, 404)
      try {
        const next = applyContractVerification(existing as unknown as Record<string, unknown>, {
          approved: data.approved === true,
          reason: typeof data.reason === 'string' ? data.reason : '',
        })
        const candidate = await savePortalCandidate(next as never)
        notifyCandidateChanges(existing as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>)
        return json({ candidate })
      } catch (error) {
        if (error instanceof ContractVerificationError) return json({ message: error.message }, error.status)
        throw error
      }
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

    if (action === 'saveJob') {
      const existing = (await getPortalState()).jobs?.find((j) => j.id === data.id) || null
      const job = normalizeJobInput(data, existing)
      if (!job.title || !job.employer) return json({ message: 'Unesi poziciju i poslodavca.' }, 400)
      const jobs = await savePortalJob(job)
      return json({ job, jobs })
    }
    if (action === 'deleteJob') {
      const jobs = await deletePortalJob(String(data.id || ''))
      return json({ jobs })
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
