import { describe, expect, it } from 'vitest'

import { buildJobOffer, ds160EmployerFields, normalizeJobInput, offeredJobsFor, publicJob, type PortalJob } from './portalJobs.ts'

const complete: PortalJob = {
  companyAddress: '100 Main St, Ocean City, MD',
  employer: 'Ocean Breeze',
  endDate: '2027-09-15',
  hoursPerWeek: '35–40',
  housingAddress: '12 Bay Rd, Ocean City, MD',
  housingCost: '$130 / week',
  id: 'job-1',
  legalName: 'Ocean Breeze Resort LLC',
  startDate: '2027-06-01',
  supervisor: 'Jane Doe',
  supervisorPhone: '+1 410 555 0101',
  title: 'Lifeguard',
  wage: '$16.00 / hour',
}
const candidate = { email: 'sara@test.rs', selectedJobId: 'job-1' }

describe('portal jobs', () => {
  it('builds a job offer only from agency data and lists what is missing', () => {
    const partial = buildJobOffer(candidate, { ...complete, legalName: undefined, supervisorPhone: undefined })
    expect(partial.missing).toEqual(expect.arrayContaining(['pravni naziv poslodavca', 'telefon nadređenog']))
    expect(partial.offer?.companyName).toBe('')
    expect(JSON.stringify(partial.offer)).not.toMatch(/Tahoe|555-5678|88-4298103|Mark Stevens/)
    const full = buildJobOffer(candidate, complete)
    expect(full.missing).toEqual([])
    expect(full.offer?.offerNumber).toMatch(/^JO-2027-[0-9A-F]{6}$/)
  })

  it('changes the fingerprint when any offer term changes', () => {
    const base = buildJobOffer(candidate, complete).fingerprint
    expect(buildJobOffer(candidate, { ...complete, wage: '$15.00 / hour' }).fingerprint).not.toBe(base)
    expect(buildJobOffer(candidate, { ...complete, housingCost: '$140 / week' }).fingerprint).not.toBe(base)
  })

  it('never carries the previous employer into DS-160 and never invents values', () => {
    const previous = { employerPhone: '+1 999 000 0000', other: 'keep', supervisorName: 'Old Boss' }
    const next = ds160EmployerFields({ employer: 'New Co', id: 'job-2', title: 'Cook' }, previous)
    expect(next.employerPhone).toBe('')
    expect(next.supervisorName).toBe('')
    expect(next.employerInfo).toBe('New Co — Cook')
    expect((next as Record<string, unknown>).other).toBe('keep')
  })

  it('limits offered jobs and hides offer-only contact data from the catalog view', () => {
    const jobs = [complete, { ...complete, id: 'job-2' }]
    expect(offeredJobsFor({ offerAllJobs: false, offeredJobIds: ['job-2'] }, jobs).map((j) => j.id)).toEqual(['job-2'])
    expect(offeredJobsFor({}, jobs)).toHaveLength(2)
    expect(publicJob(complete)).not.toHaveProperty('supervisorPhone')
  })

  it('assigns ids on the server and drops unsafe image URLs', () => {
    const job = normalizeJobInput({ employer: 'X', id: 'evil', images: ['javascript:alert(1)', 'https://img.example/a.jpg'], title: 'Y' })
    expect(job.id).toMatch(/^job-/)
    expect(job.images).toEqual(['https://img.example/a.jpg'])
  })
})
