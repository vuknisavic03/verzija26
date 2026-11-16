import { randomInt } from 'node:crypto'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Verifikacioni kod pozivnice: AA-XXXX-XXXX (≈ 8,5 · 10¹¹ kombinacija). */
export function generateInvitationCode() {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  const block = () => Array.from({ length: 4 }, pick).join('')
  return `AA-${block()}-${block()}`
}

const STRONG_CODE = new RegExp(`^AA-[${CODE_ALPHABET}]{4}-[${CODE_ALPHABET}]{4}$`)

/** Kod koji je agencija već prikazala zadržava se samo ako je u jakom formatu; inače novi. */
export function acceptOrGenerateInvitationCode(proposed: unknown) {
  const code = typeof proposed === 'string' ? proposed.trim().toUpperCase() : ''
  return STRONG_CODE.test(code) ? code : generateInvitationCode()
}
