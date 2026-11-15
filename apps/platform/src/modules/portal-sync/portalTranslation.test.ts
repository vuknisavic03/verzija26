import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it } from 'vitest'

import { keepServerManagedFields, sanitizeCandidateUpdate } from './candidateFields.ts'
import { translateWithAi, TranslationUnavailableError } from './portalTranslationAi.ts'
import { renderTranslationPdf, translationFooter } from './portalTranslationPdf.ts'
import {
  checkTranslation,
  extractToolInput,
  namesMatch,
  normalizeTranslationData,
  type PortalTranslation,
  recentAttempts,
  translationAccepted,
} from './portalTranslationRules.ts'

const police = normalizeTranslationData({
  documentType: 'police_clearance_certificate',
  issueDate: '2026-11-02',
  issuerEn: 'Republic of Serbia, Ministry of Internal Affairs, Police Administration for the City of Belgrade',
  personName: 'Sara Petrović',
  readable: true,
  referenceNumber: '03/7-2-236-12345/2026',
  sections: [
    {
      fields: [
        { labelEn: 'Name and surname', valueEn: 'Sara Petrović' },
        { labelEn: 'Date of birth', valueEn: '14.03.2004' },
      ],
      headingEn: '',
      paragraphsEn: ['According to the records kept by this administration, the above-named person has not been convicted.'],
    },
  ],
  sourceLanguage: 'Serbian (Cyrillic)',
  stampsAndSignatures: ['[Round seal: Republic of Serbia, Ministry of Internal Affairs]', '[Signature]'],
  titleEn: 'Certificate',
  translatorNotes: [],
})

describe('portal translation rules', () => {
  it('matches names across Cyrillic, diacritics and extra middle names', () => {
    expect(namesMatch('Сара Петровић', 'Sara', 'Petrović')).toBe(true)
    expect(namesMatch('PETROVIC SARA MILAN', 'Sara', 'Petrovic')).toBe(true)
    expect(namesMatch('Đorđe Jović', 'Djordje', 'Jovic')).toBe(true)
    expect(namesMatch('Marko Marković', 'Sara', 'Petrović')).toBe(false)
    expect(namesMatch('', 'Sara', 'Petrović')).toBeNull()
  })

  it('blocks unreadable documents and the wrong document type', () => {
    const now = new Date('2026-11-15T10:00:00Z')
    const person = { firstName: 'Sara', lastName: 'Petrović' }
    expect(checkTranslation('police', { ...police, readable: false }, person, now).blocking).toMatch(/čitljiv/)
    expect(checkTranslation('police', { ...police, sections: [] }, person, now).blocking).toMatch(/čitljiv/)
    expect(checkTranslation('faculty', police, person, now).blocking).toMatch(/uverenje o studiranju/)
    expect(checkTranslation('police', police, person, now)).toEqual({ blocking: null, warnings: [] })
  })

  it('warns about a different name, an old police certificate and illegible parts', () => {
    const now = new Date('2026-11-15T10:00:00Z')
    const old = {
      ...police,
      issueDate: '12. 01. 2026.',
      sections: [{ fields: [{ labelEn: 'Address', valueEn: '[illegible]' }], headingEn: '', paragraphsEn: [] }],
      translatorNotes: ['Pečat je delimično nečitak.'],
    }
    const result = checkTranslation('police', old, { firstName: 'Marko', lastName: 'Marković' }, now)
    expect(result.blocking).toBeNull()
    expect(result.warnings).toHaveLength(4)
    expect(result.warnings[0]).toMatch(/ne poklapa/)
    expect(result.warnings[1]).toMatch(/6 meseci/)
    expect(result.warnings[2]).toMatch(/illegible/)
    expect(result.warnings[3]).toBe('Pečat je delimično nečitak.')
  })

  it('normalizes model output and agency edits into a bounded shape', () => {
    const data = normalizeTranslationData({
      documentType: 'something-else',
      sections: [{ fields: [{ labelEn: 'A', valueEn: 'x'.repeat(5_000) }, {}], paragraphsEn: ['', 'Text'] }],
      titleEn: 42,
    })
    expect(data.documentType).toBe('other')
    expect(data.titleEn).toBe('')
    expect(data.sections[0]!.fields).toHaveLength(1)
    expect(data.sections[0]!.fields[0]!.valueEn).toHaveLength(1_000)
    expect(data.sections[0]!.paragraphsEn).toEqual(['Text'])
    expect(data.readable).toBe(true)
  })

  it('rejects truncated or tool-less model responses', () => {
    expect(() => extractToolInput({ content: [], stop_reason: 'max_tokens' })).toThrow('TRANSLATION_TRUNCATED')
    expect(() => extractToolInput({ content: [{ text: 'hi', type: 'text' }] })).toThrow('TRANSLATION_NO_TOOL_RESULT')
    expect(extractToolInput({ content: [{ input: { a: 1 }, name: 'record_translation', type: 'tool_use' }] })).toEqual({ a: 1 })
  })

  it('counts only attempts from the last 24 hours and accepts only confirmed or approved translations', () => {
    const now = new Date('2026-11-15T10:00:00Z')
    expect(recentAttempts(['2026-11-14T09:00:00Z', '2026-11-15T09:00:00Z'], now)).toEqual(['2026-11-15T09:00:00Z'])
    const base = { status: 'ready' } as PortalTranslation
    expect(translationAccepted(null)).toBe(false)
    expect(translationAccepted(base)).toBe(false)
    expect(translationAccepted({ ...base, candidateConfirmedAt: '2026-11-15' })).toBe(true)
    expect(translationAccepted({ ...base, candidateConfirmedAt: '2026-11-15', status: 'rejected' })).toBe(false)
    expect(translationAccepted({ ...base, status: 'approved' })).toBe(true)
  })

  it('keeps translations and discounts out of the candidate’s and the admin form’s reach', () => {
    const existing = {
      discount: 200,
      discountTiming: 'end',
      email: 'sara@test.rs',
      facultyCertAiTranslation: false,
      facultyCertTranslation: { status: 'ready' },
      groupCode: 'G1',
      id: 'c1',
    }
    const fromCandidate = sanitizeCandidateUpdate(
      {
        discount: 1_000,
        discountId: 'x',
        discountTiming: 'immediate',
        facultyCertAiTranslation: true,
        facultyCertTranslation: { status: 'approved' },
        groupCode: 'MINE',
      },
      existing,
      'sara@test.rs',
    )
    expect(fromCandidate).toMatchObject({ discount: 200, discountTiming: 'end', facultyCertAiTranslation: false, groupCode: 'G1' })
    expect(fromCandidate.discountId).toBeUndefined()
    expect(fromCandidate.facultyCertTranslation).toEqual({ status: 'ready' })

    const fromAdminForm = keepServerManagedFields({ facultyCertAiTranslation: true, facultyCertTranslation: null, notes: 'x' }, existing)
    expect(fromAdminForm).toMatchObject({ facultyCertAiTranslation: false, facultyCertTranslation: { status: 'ready' }, notes: 'x' })
    expect(keepServerManagedFields({ policeCertTranslation: { status: 'approved' } }, existing)).not.toHaveProperty('policeCertTranslation')
  })
})

describe('AI translation call', () => {
  const key = process.env.ANTHROPIC_API_KEY
  afterEach(() => {
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = key
  })

  it('refuses without an API key instead of producing anything', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(
      translateWithAi({ bytes: Buffer.from('%PDF-1.4'), doc: 'police', mimeType: 'application/pdf' }),
    ).rejects.toBeInstanceOf(TranslationUnavailableError)
  })

  it('sends the original as a document with a forced tool call and parses the result', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    let sent: Record<string, unknown> = {}
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key')
      return new Response(JSON.stringify({ content: [{ input: police, name: 'record_translation', type: 'tool_use' }], stop_reason: 'tool_use' }))
    }) as unknown as typeof fetch
    const result = await translateWithAi({ bytes: Buffer.from('%PDF-1.4 test'), doc: 'police', fetchImpl, mimeType: 'application/pdf' })
    expect(result.data.personName).toBe('Sara Petrović')
    expect(sent.tool_choice).toEqual({ name: 'record_translation', type: 'tool' })
    const content = (sent.messages as Array<{ content: Array<{ source?: { media_type: string }; type: string }> }>)[0]!.content
    expect(content[0]!.type).toBe('document')
    expect(content[0]!.source!.media_type).toBe('application/pdf')
  })

  it('turns API failures into a clear message without leaking the response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const fetchImpl = (async () => new Response('{"error":"overloaded"}', { status: 529 })) as unknown as typeof fetch
    await expect(
      translateWithAi({ bytes: Buffer.from('%PDF-1.4'), doc: 'faculty', fetchImpl, mimeType: 'application/pdf' }),
    ).rejects.toThrow(/Pokušaj ponovo/)
  })
})

describe('translation PDF', () => {
  const translation: PortalTranslation = {
    createdAt: '2026-11-15T09:00:00Z',
    data: police,
    doc: 'police',
    source: 'ai',
    sourceDocUrl: '/api/public/documents/upload?doc=1',
    sourceFileName: 'uverenje.pdf',
    sourceSha256: 'a'.repeat(64),
    status: 'ready',
    warnings: [],
  }

  it('never claims to be a sworn translation and marks drafts as unreviewed', () => {
    const draft = translationFooter(translation).join(' ')
    expect(draft).toMatch(/not yet been reviewed/)
    expect(draft).toMatch(/not a sworn/)
    const approved = translationFooter({ ...translation, reviewedAt: '2026-11-16T09:00:00Z', status: 'approved' }).join(' ')
    expect(approved).toMatch(/reviewed against the original document on 16 November 2026/)
    expect(approved).toMatch(/not a sworn/)
  })

  it('renders a valid multi-page PDF with Serbian names', async () => {
    const long = {
      ...police,
      sections: [{ fields: [], headingEn: 'Long', paragraphsEn: Array.from({ length: 60 }, () => 'Čačak Đurđevdan šđčćž '.repeat(12)) }],
    }
    const bytes = await renderTranslationPdf(translation, long)
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(1)
    expect(pdf.getTitle()).toBe('English translation — Certificate')
  })
})
