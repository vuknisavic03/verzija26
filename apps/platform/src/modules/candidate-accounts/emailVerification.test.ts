import { describe, expect, it } from 'vitest'

import { renderEmailVerification, renderInvitation } from '../portal-sync/portalNotificationRules.ts'
import {
  confirmEmailVerification,
  EmailVerificationError,
  RESEND_COOLDOWN_MS,
  resendEmailVerification,
  verificationLink,
} from './emailVerification.ts'

type Row = Record<string, unknown> & { id: number }

/** Minimalan Payload: find po emailu ili tokenu i update po id-ju. */
function fakePayload(rows: Row[]) {
  const updates: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({ where }: { where: Record<string, { equals: unknown }> }) => {
      const [field, condition] = Object.entries(where)[0]!
      return { docs: rows.filter((r) => r[field] === condition.equals) }
    },
    update: async ({ data, id }: { data: Record<string, unknown>; id: number }) => {
      updates.push({ id, ...data })
      const row = rows.find((r) => r.id === id)!
      Object.assign(row, data)
      return row
    },
  }
  return { payload: payload as never, updates }
}

const token = 'a'.repeat(64)
const now = new Date('2026-11-15T12:00:00Z')

describe('email verification', () => {
  it('activates a pending account with a valid, unexpired link, once', async () => {
    const rows: Row[] = [
      {
        _verificationToken: token,
        _verified: false,
        accountStatus: 'PENDING_ACTIVATION',
        activationExpiresAt: '2026-11-16T12:00:00Z',
        email: 'nova@test.rs',
        id: 1,
      },
    ]
    const { payload } = fakePayload(rows)
    await expect(confirmEmailVerification(payload, token, now)).resolves.toEqual({ email: 'nova@test.rs' })
    expect(rows[0]).toMatchObject({ _verificationToken: null, _verified: true, accountStatus: 'ACTIVE' })
    await expect(confirmEmailVerification(payload, token, now)).rejects.toBeInstanceOf(EmailVerificationError)
  })

  it('rejects malformed, unknown and expired links', async () => {
    const rows: Row[] = [
      { _verificationToken: token, _verified: false, activationExpiresAt: '2026-11-15T11:59:00Z', email: 'x@test.rs', id: 1 },
    ]
    const { payload } = fakePayload(rows)
    await expect(confirmEmailVerification(payload, 'not-a-token', now)).rejects.toMatchObject({ reason: 'invalid' })
    await expect(confirmEmailVerification(payload, 'b'.repeat(64), now)).rejects.toMatchObject({ reason: 'invalid' })
    await expect(confirmEmailVerification(payload, token, now)).rejects.toMatchObject({ reason: 'expired' })
    expect(rows[0]!._verified).toBe(false)
  })

  it('never resends to verified, suspended or unknown accounts, and not twice within a minute', async () => {
    const recent = new Date(now.getTime() - RESEND_COOLDOWN_MS / 2).toISOString()
    const rows: Row[] = [
      { _verified: true, email: 'done@test.rs', id: 1 },
      { _verified: false, accountStatus: 'SUSPENDED', email: 'locked@test.rs', id: 2 },
      { _verified: false, activationIssuedAt: recent, email: 'recent@test.rs', id: 3 },
    ]
    const { payload, updates } = fakePayload(rows)
    for (const email of ['done@test.rs', 'locked@test.rs', 'recent@test.rs', 'nobody@test.rs']) {
      await resendEmailVerification(payload, email, now)
    }
    expect(updates).toEqual([])
  })

  it('links and messages point to the public site in informal Serbian', () => {
    expect(verificationLink(token, 'https://workandtravel.rs')).toBe(`https://workandtravel.rs/potvrda-emaila?token=${token}`)
    const verify = renderEmailVerification({ firstName: 'Nova', link: verificationLink(token, 'https://x.rs') })
    expect(verify.subject).toBe('Potvrdi email | American Adventure')
    expect(verify.text).toContain('Zdravo Nova,')
    expect(verify.text).toContain('48 sati')

    const invite = renderInvitation({
      candidateName: 'Nova Kandidatkinja',
      code: 'AA-P5RX-9NHM',
      email: 'nova+test@test.rs',
      finalPrice: 1850,
      packageName: 'Work & Travel USA — Full Placement',
      siteUrl: 'https://x.rs',
    })
    expect(invite.text).toContain('AA-P5RX-9NHM')
    expect(invite.text).toContain('https://x.rs/registracija?email=nova%2Btest%40test.rs&kod=AA-P5RX-9NHM')
    expect(invite.html).toContain('Work &amp; Travel')
  })
})
