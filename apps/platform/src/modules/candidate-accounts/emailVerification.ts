import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

import { deliverPortalEmail, localEmailPreview } from '../portal-sync/portalNotifications.ts'
import { publicSiteUrl, renderEmailVerification } from '../portal-sync/portalNotificationRules.ts'

/**
 * Potvrda emaila posle registracije.
 *
 * Nalog se pravi kao neaktivan (`_verified: false`, PENDING_ACTIVATION). Payload odbija prijavu
 * takvog naloga (posle provere lozinke, pa se ne otkriva da li nalog postoji). Link iz mejla važi
 * 48 sati i radi jednom; novi link poništava stari.
 */

export const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1_000
export const RESEND_COOLDOWN_MS = 60 * 1_000

export class EmailVerificationError extends Error {
  constructor(
    message: string,
    readonly reason: 'expired' | 'invalid',
  ) {
    super(message)
  }
}

type Account = {
  _verified?: boolean | null
  accountStatus?: string | null
  activationExpiresAt?: string | null
  activationIssuedAt?: string | null
  email: string
  fullName?: string | null
  id: number
}

export function verificationLink(token: string, siteUrl = publicSiteUrl()) {
  return `${siteUrl}/potvrda-emaila?token=${encodeURIComponent(token)}`
}

/** Novi token (stari prestaje da važi) i mejl sa linkom. Vraća da li je mejl predat za slanje. */
export async function issueEmailVerification(payload: Payload, account: Account, now = new Date()) {
  const token = randomBytes(32).toString('hex')
  await payload.update({
    collection: 'candidate-accounts',
    data: {
      _verificationToken: token,
      activationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS).toISOString(),
      activationIssuedAt: now.toISOString(),
    } as never,
    id: account.id,
    overrideAccess: true,
  })
  const firstName = String(account.fullName || '').trim().split(/\s+/)[0] || ''
  const link = verificationLink(token)
  const sent = await deliverPortalEmail(
    account.email,
    renderEmailVerification({ firstName, link }),
    `portal:verify:${account.id}:${now.toISOString().slice(0, 16)}`,
    'emailVerification',
  )
  // Samo lokalno (mejlovi se ne šalju): link se vraća aplikaciji da bi tok mogao da se prođe.
  return { devLink: localEmailPreview() ? link : undefined, sent }
}

/** Klik na link iz mejla: aktivira nalog. Vraća email naloga (za popunjavanje forme za prijavu). */
export async function confirmEmailVerification(payload: Payload, token: string, now = new Date()) {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new EmailVerificationError('Link nije ispravan. Otvori ga ponovo iz mejla.', 'invalid')
  }
  const found = await payload.find({
    collection: 'candidate-accounts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    where: { _verificationToken: { equals: token } },
  })
  const account = found.docs[0] as unknown as Account | undefined
  if (!account) {
    throw new EmailVerificationError('Link je već iskorišćen ili ga je zamenio noviji. Prijavi se ili zatraži novi link.', 'invalid')
  }
  if (account.accountStatus === 'SUSPENDED') {
    throw new EmailVerificationError('Nalog je privremeno zaključan. Javi se agenciji.', 'invalid')
  }
  const expires = account.activationExpiresAt ? new Date(account.activationExpiresAt).getTime() : 0
  if (!expires || expires < now.getTime()) {
    throw new EmailVerificationError('Link je istekao. Zatraži novi.', 'expired')
  }
  await payload.update({
    collection: 'candidate-accounts',
    data: {
      _verificationToken: null,
      _verified: true,
      accountStatus: 'ACTIVE',
      activationExpiresAt: null,
      verifiedAt: now.toISOString(),
    } as never,
    id: account.id,
    overrideAccess: true,
  })
  return { email: account.email }
}

/**
 * Ponovno slanje linka. Uvek se završava bez greške i bez informacije da li nalog postoji;
 * šalje se samo nepotvrđenom, nezaključanom nalogu, najviše jednom u minuti.
 */
export async function resendEmailVerification(payload: Payload, email: string, now = new Date()) {
  const found = await payload.find({
    collection: 'candidate-accounts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: email.trim().toLowerCase() } },
  })
  const account = found.docs[0] as unknown as Account | undefined
  if (!account || account._verified || account.accountStatus === 'SUSPENDED') return
  const lastIssued = account.activationIssuedAt ? new Date(account.activationIssuedAt).getTime() : 0
  if (now.getTime() - lastIssued < RESEND_COOLDOWN_MS) return
  return (await issueEmailVerification(payload, account, now)).devLink
}
