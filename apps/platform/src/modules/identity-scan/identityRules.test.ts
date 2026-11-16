import { describe, expect, it } from 'vitest'

import {
  cleanMrzName,
  combineIdentityRead,
  crossCheckDocuments,
  type IdentityRead,
  jmbgBirthDate,
  jmbgChecksumValid,
  jmbgSex,
  normalizeMrzLines,
  passportRequiredUntil,
  readMrz,
  toLatin,
} from './identityRules.ts'

/** ICAO 9303 kontrolna cifra (težine 7-3-1). */
function check(value: string) {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    const v = ch === '<' ? 0 : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 55
    sum += v * weights[i % 3]!
  }
  return String(sum % 10)
}

/** Ispravan JMBG za datum DDMMGGG, region 71, redni broj 0nn. */
function makeJmbg(ddmmggg: string, rrr = '001') {
  const base = `${ddmmggg}71${rrr}`
  const d = base.split('').map(Number)
  const sum = 7 * (d[0]! + d[6]!) + 6 * (d[1]! + d[7]!) + 5 * (d[2]! + d[8]!) + 4 * (d[3]! + d[9]!) + 3 * (d[4]! + d[10]!) + 2 * (d[5]! + d[11]!)
  let k = 11 - (sum % 11)
  if (k > 9) k = 0
  return `${base}${k}`
}

const JMBG = makeJmbg('1403004') // 14.03.2004, muški (001)

function passportMrz({ doc = '012345678', birth = '040314', expiry = '320101', jmbg = JMBG, sex = 'M' } = {}) {
  const l1 = 'P<SRBPETROVIC<<SARA<<<<<<<<<<<<<<<<<<<<<<<<<'.slice(0, 44)
  const personal = jmbg.padEnd(14, '<')
  const body = `${doc}${check(doc)}SRB${birth}${check(birth)}${sex}${expiry}${check(expiry)}${personal}${check(personal)}`
  const composite = `${doc}${check(doc)}${birth}${check(birth)}${expiry}${check(expiry)}${personal}${check(personal)}`
  return [l1, `${body}${check(composite)}`]
}

function idcardMrz({ doc = '009876543', birth = '040314', expiry = '330515', jmbg = JMBG, sex = 'M' } = {}) {
  const opt1 = jmbg.padEnd(15, '<')
  const l1 = `IDSRB${doc}${check(doc)}${opt1}`
  const opt2 = '<<<<<<<<<<<'
  const l2core = `${birth}${check(birth)}${sex}${expiry}${check(expiry)}SRB${opt2}`
  const composite = `${doc}${check(doc)}${opt1}${birth}${check(birth)}${expiry}${check(expiry)}${opt2}`
  const l2 = `${l2core}${check(composite)}`
  const l3 = 'PETROVIC<<SARA<<<<<<<<<<<<<<<<'.slice(0, 30)
  return [l1, l2, l3]
}

const now = new Date('2026-11-15T12:00:00Z')

function read(over: Partial<IdentityRead>): IdentityRead {
  return {
    dateOfBirth: '',
    dateOfExpiry: '',
    documentNumber: '',
    documentType: 'passport',
    givenNames: '',
    mrzLines: [],
    nationality: '',
    notes: [],
    personalNumber: '',
    placeOfBirth: '',
    readable: true,
    sex: '',
    surname: '',
    ...over,
  }
}

describe('JMBG', () => {
  it('validates the control digit and decodes birth date and sex', () => {
    expect(jmbgChecksumValid(JMBG)).toBe(true)
    expect(jmbgChecksumValid(`${JMBG.slice(0, 12)}${(Number(JMBG[12]) + 1) % 10}`)).toBe(false)
    expect(jmbgBirthDate(JMBG)).toBe('2004-03-14')
    expect(jmbgBirthDate(makeJmbg('0101990'))).toBe('1990-01-01')
    expect(jmbgSex(JMBG)).toBe('M')
    expect(jmbgSex(makeJmbg('0101990', '501'))).toBe('F')
  })
})

describe('MRZ', () => {
  it('reads a Serbian passport (TD3) with JMBG in the personal number field', () => {
    const mrz = readMrz('passport', passportMrz(), now)!
    expect(mrz.valid).toBe(true)
    expect(mrz.fields).toMatchObject({
      birthDate: { value: '2004-03-14', verified: true },
      documentNumber: { value: '012345678', verified: true },
      expiryDate: { value: '2032-01-01', verified: true },
      jmbg: { value: JMBG, verified: true },
      // Ime nije pokriveno kontrolnom cifrom.
      lastName: { value: 'PETROVIC', verified: false },
      sex: { value: 'M', verified: true },
    })
  })

  it('cleans OCR misreads of the filler in the name line', () => {
    expect(cleanMrzName('BRATIC<K<LUKA<K<LLLLLLLLKLLLLL', 30)).toBe('BRATIC<<LUKA<<<<<<<<<<<<<<<<<<')
    expect(cleanMrzName('PETROVIC<NIKOLIC<<ANA<MARIJA<<', 30)).toBe('PETROVIC<NIKOLIC<<ANA<MARIJA<<')
    expect(cleanMrzName('BRATICSSLUKAC<LLLLLLL<LLCKLLLX', 30)).toBe('BRATICSSLUKAC<<<<<<<<<<<<<<<<<')
  })

  it('reads a Serbian ID card (TD1) with JMBG in line 1, positions 16–28', () => {
    const mrz = readMrz('idcard', idcardMrz(), now)!
    expect(mrz.valid).toBe(true)
    expect(mrz.fields.documentNumber).toEqual({ value: '009876543', verified: true })
    expect(mrz.fields.jmbg).toEqual({ value: JMBG, verified: true })
    expect(mrz.fields.expiryDate?.value).toBe('2033-05-15')
  })

  it('cleans spaces and lookalike fillers and rejects the wrong format', () => {
    const [l1, l2] = passportMrz()
    expect(normalizeMrzLines('passport', [` ${l1!.replace(/</g, '« ')} `.slice(0, 80), l2!])).toHaveLength(2)
    expect(readMrz('idcard', passportMrz(), now)).toBeNull()
  })

  it('marks a field unverified when its check digit fails', () => {
    const [l1, l2] = passportMrz()
    const broken = `${l2!.slice(0, 13)}${l2![13] === '1' ? '2' : '1'}${l2!.slice(14)}` // pokvaren datum rođenja
    const mrz = readMrz('passport', [l1!, broken], now)!
    expect(mrz.valid).toBe(false)
    expect(mrz.fields.birthDate?.verified).toBe(false)
    expect(mrz.fields.documentNumber?.verified).toBe(true)
  })
})

describe('combineIdentityRead', () => {
  it('prefers verified MRZ values and keeps diacritics from the visual zone', () => {
    const result = combineIdentityRead(
      'passport',
      read({
        dateOfBirth: '2004-03-14',
        documentNumber: '012345678',
        givenNames: 'Сара',
        mrzLines: passportMrz(),
        surname: 'Петровић',
      }),
      now,
    )
    expect(result.blocking).toBeNull()
    expect(result.fields.lastName).toEqual({ value: 'Petrović', verified: true })
    expect(result.fields.firstName).toEqual({ value: 'Sara', verified: true })
    expect(result.fields.jmbg).toEqual({ value: JMBG, verified: true })
    expect(result.mrzValid).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('turns upper-case printed names into normal case', () => {
    const result = combineIdentityRead('passport', read({ givenNames: 'SARA', mrzLines: passportMrz(), surname: 'PETROVIĆ' }), now)
    expect(result.fields.lastName).toEqual({ value: 'Petrović', verified: true })
  })

  it('blocks unreadable images and the wrong document', () => {
    expect(combineIdentityRead('passport', read({ readable: false }), now).blocking).toMatch(/Ne vidi se/)
    expect(combineIdentityRead('passport', read({ documentType: 'id_card' }), now).blocking).toMatch(/Lična karta/)
    expect(combineIdentityRead('idcard', read({ documentType: 'other' }), now).blocking).toMatch(/lična karta/)
  })

  it('warns about an expiring passport, a bad JMBG and a missing MRZ', () => {
    const soon = combineIdentityRead('passport', read({ mrzLines: passportMrz({ expiry: '270901' }) }), now)
    expect(soon.warnings.join(' ')).toMatch(/2028-04-15/)
    expect(passportRequiredUntil(now)).toBe('2028-04-15')

    const visualOnly = combineIdentityRead(
      'idcard',
      read({ dateOfBirth: '15.03.2004.', documentType: 'id_card', personalNumber: JMBG.replace(/.$/, '0'), surname: 'Петровић' }),
      now,
    )
    expect(visualOnly.fields.jmbg?.verified).toBe(false)
    expect(visualOnly.warnings.join(' ')).toMatch(/kontrolnu cifru/)
    expect(visualOnly.warnings.join(' ')).toMatch(/MRZ zona/)
    expect(visualOnly.fields.lastName).toEqual({ value: 'Petrović', verified: false })
  })

  it('reads the ID card from front (names) and back (MRZ + JMBG) together', () => {
    const result = combineIdentityRead(
      'idcard',
      read({ documentType: 'id_card', givenNames: 'Sara', mrzLines: idcardMrz(), surname: 'Petrović' }),
      now,
    )
    expect(result.fields).toMatchObject({
      documentNumber: { value: '009876543', verified: true },
      firstName: { value: 'Sara', verified: true },
      jmbg: { value: JMBG, verified: true },
      lastName: { value: 'Petrović', verified: true },
    })
  })
})

describe('cross check', () => {
  it('flags different person data on passport and ID card', () => {
    const passport = combineIdentityRead('passport', read({ mrzLines: passportMrz(), surname: 'Petrović' }), now).fields
    const idcard = combineIdentityRead('idcard', read({ documentType: 'id_card', mrzLines: idcardMrz({ birth: '040315' }) }), now).fields
    expect(crossCheckDocuments(passport, passport)).toEqual([])
    expect(crossCheckDocuments(passport, idcard)).toContain('Datum rođenja nije isti u pasošu i na ličnoj karti.')
  })

  it('transliterates Cyrillic with Serbian digraphs', () => {
    expect(toLatin('Љубица Ђорђевић Џаковић')).toBe('Ljubica Đorđević Džaković')
  })
})
