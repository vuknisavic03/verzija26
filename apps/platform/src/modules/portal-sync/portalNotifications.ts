import { readPlatformEnvironment } from '../../config/environment.ts'
import { createCandidateEmailProvider } from '../candidate-communications/emailProvider.ts'
import type { RenderedCandidateMessage } from '../candidate-communications/templates.ts'
import {
  agencyNoticesFor,
  candidateNoticesFor,
  type CandidateNoticeKind,
  type Notice,
  publicSiteUrl,
  renderAgencyNotice,
  renderCandidateNotice,
  type RenderedNotice,
} from './portalNotificationRules.ts'

/**
 * Slanje obaveštenja iz portala (Resend; u razvoju CANDIDATE_EMAIL_PROVIDER=capture ne šalje ništa).
 *
 * Slanje nikad ne obara akciju koja ga je izazvala: greška se samo upisuje u log (bez adrese i
 * sadržaja). Idempotency-Key sprečava dupli mejl kad se ista promena sačuva dvaput u kratkom roku.
 */

type Candidate = Record<string, unknown>

function agencyAddress(replyTo: string) {
  return process.env.AGENCY_NOTIFICATION_EMAIL?.trim() || replyTo
}

async function deliver(to: string, notice: RenderedNotice, key: string, kind: string) {
  const environment = readPlatformEnvironment().candidateCommunication
  const provider = createCandidateEmailProvider(environment)
  try {
    await provider.send({
      idempotencyKey: key.slice(0, 250),
      message: notice as unknown as RenderedCandidateMessage,
      recipientEmail: to,
    })
    if (provider.name === 'capture') console.info(`Portal email captured (${kind}).`)
  } catch (error) {
    console.error(`Portal email failed (${kind}).`, error instanceof Error ? error.message : 'UNKNOWN_ERROR')
  }
}

function minuteBucket(now = new Date()) {
  return now.toISOString().slice(0, 16)
}

function firstName(candidate: Candidate) {
  const value = candidate.firstName || String(candidate.name || '').split(' ')[0]
  return typeof value === 'string' ? value.trim() : ''
}

function fullName(candidate: Candidate) {
  return [candidate.firstName, candidate.lastName].filter((v) => typeof v === 'string' && v).join(' ') || String(candidate.name || '')
}

/** Pošalji kandidatu jedno obaveštenje (ne čeka se; ne baca grešku). */
export function notifyCandidate(candidate: Candidate, notice: Notice<CandidateNoticeKind>) {
  const email = String(candidate.email || '').trim()
  if (!email) return
  const rendered = renderCandidateNotice(notice, { firstName: firstName(candidate), portalUrl: `${publicSiteUrl()}/profil` })
  const key = `portal:${notice.kind}:${String(candidate.id)}:${notice.details.invoiceNumber || notice.details.document || ''}:${minuteBucket()}`
  void deliver(email, rendered, key, notice.kind)
}

/** Agencija sačuvala dosije: obavesti kandidata o promenama koje ga se tiču. */
export function notifyCandidateChanges(before: Candidate | null, after: Candidate) {
  for (const notice of candidateNoticesFor(before, after)) notifyCandidate(after, notice)
}

/** Kandidat sačuvao promenu: obavesti agenciju (poslat dosije, prijavljena uplata). */
export function notifyAgencyChanges(before: Candidate | null, after: Candidate) {
  const notices = agencyNoticesFor(before, after)
  if (!notices.length) return
  const environment = readPlatformEnvironment().candidateCommunication
  const to = agencyAddress(environment.replyTo)
  for (const notice of notices) {
    const rendered = renderAgencyNotice(notice, {
      adminUrl: `${publicSiteUrl()}/admin`,
      candidateEmail: String(after.email || ''),
      candidateName: fullName(after),
    })
    const key = `portal-agency:${notice.kind}:${String(after.id)}:${notice.details.installment || ''}:${minuteBucket()}`
    void deliver(to, rendered, key, notice.kind)
  }
}
