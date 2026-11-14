import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { acceptanceReference, buildPortalContractDraft, renderPortalContractPdf } from './portalContract.ts'

const candidate = {
  address: 'Ulica 1, Beograd',
  email: 'Marko@Test.rs',
  finalPrice: 1750,
  firstName: 'Marko',
  idCardNumber: '009988776',
  jmbg: '0101000710000',
  lastName: 'Test',
  packageName: 'Work & Travel USA — Full Placement',
  paymentMethod: 'now',
  phone: '061',
}

describe('portal contract', () => {
  it('has a stable content fingerprint and contract number', () => {
    const a = buildPortalContractDraft(candidate)
    const b = buildPortalContractDraft({ ...candidate })
    expect(a.missing).toEqual([])
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.facts.contractNumber).toMatch(/^AA-2027-[0-9A-F]{6}$/)
    expect(buildPortalContractDraft({ ...candidate, email: 'marko@test.rs' }).facts.contractNumber).toBe(a.facts.contractNumber)
  })

  it('changes the fingerprint when any contract fact changes', () => {
    const base = buildPortalContractDraft(candidate).fingerprint
    expect(buildPortalContractDraft({ ...candidate, finalPrice: 1749 }).fingerprint).not.toBe(base)
    expect(buildPortalContractDraft({ ...candidate, jmbg: '0101000710001' }).fingerprint).not.toBe(base)
    expect(buildPortalContractDraft({ ...candidate, paymentMethod: 'installments' }).fingerprint).not.toBe(base)
  })

  it('refuses to fill a contract with missing data instead of inventing it', () => {
    const draft = buildPortalContractDraft({ ...candidate, idCardNumber: '', jmbg: '123' })
    expect(draft.missing).toEqual(expect.arrayContaining(['JMBG (13 cifara)', 'broj pasoša']))
  })

  it('renders the official contract plus annex, statement and acceptance proof', async () => {
    const draft = buildPortalContractDraft(candidate)
    const official = await PDFDocument.load(draft.officialBytes!, { ignoreEncryption: true })
    const acceptedAt = '2026-11-14T18:00:00.000Z'
    const bytes = await renderPortalContractPdf(draft, {
      acceptedAt,
      fingerprint: draft.fingerprint,
      reference: acceptanceReference(draft.fingerprint, acceptedAt, draft.facts.contractNumber),
      statement: draft.statement,
      statementVersion: draft.statementVersion,
    })
    const rendered = await PDFDocument.load(bytes)
    expect(rendered.getPageCount()).toBeGreaterThanOrEqual(official.getPageCount() + 3)
  })
})
