import { describe, expect, it } from 'vitest'

import { sanitizeDs160Answers } from './ds160Answers.ts'

describe('sanitizeDs160Answers', () => {
  it('zadržava samo poznata polja kao tekst', () => {
    expect(sanitizeDs160Answers({ firstName: '  Sara ', isAdmin: true, jmbg: 101, status: 'ready' })).toEqual({
      firstName: 'Sara',
      jmbg: '101',
    })
  })

  it('odbacuje sve što nije objekat (npr. ID kandidata umesto odgovora)', () => {
    expect(sanitizeDs160Answers('42')).toEqual({})
    expect(sanitizeDs160Answers(null)).toEqual({})
    expect(sanitizeDs160Answers(['a'])).toEqual({})
  })

  it('skraćuje predugačak odgovor', () => {
    expect(sanitizeDs160Answers({ visaRefusal: 'x'.repeat(5000) }).visaRefusal).toHaveLength(1000)
  })
})
