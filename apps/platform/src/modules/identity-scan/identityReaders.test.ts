import { describe, expect, it } from 'vitest'

import { voteMrzName } from './identityReaders.ts'

const line1 = 'IDSRB0098765431140300471500500'
const line2 = '0403141F3305155SRB<<<<<<<<<<<0'

describe('voteMrzName', () => {
  it('treats a leading or trailing K/L/C as a misread filler when another read has the clean name', () => {
    const reads = [
      [line1, line2, 'PETROVIC<<KSARA<<<<<<<<<<<<<<'],
      [line1, line2, 'PETROVIC<<SARA<<<<<<<<<<<<<<<<'],
      [line1, line2, 'PETROVIC<<KSARA<<<<<<<<<<<<<<'],
      [line1, line2, 'PETROVICK<SARA<<<<<<<<<<<<<<<'],
    ]
    expect(voteMrzName('idcard', reads)).toBe('PETROVIC<<SARA<<<<<<<<<<<<<<<<')
  })

  it('keeps a real name that starts with K', () => {
    const reads = [
      [line1, line2, 'JOVIC<<KATARINA<<<<<<<<<<<<<<<'],
      [line1, line2, 'JOVIC<<KATARINA<<<<<<<<<<<<<<<'],
    ]
    expect(voteMrzName('idcard', reads)).toBe('JOVIC<<KATARINA<<<<<<<<<<<<<<<')
  })
})
