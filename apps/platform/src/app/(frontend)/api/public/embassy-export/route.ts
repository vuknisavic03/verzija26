import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { getPortalState } from '@/modules/portal-sync/localStore.ts'
import { generateEmbassyExcelBuffer } from '@/modules/admin-candidates/export.ts'
import type { AdminCandidateOverviewItem } from '@/modules/admin-candidates/rules.ts'

export async function GET() {
  const actor = await resolvePortalActor()
  if (actor.kind !== 'admin') return new Response('Pristup odbijen.', { status: 401 })
  try {
    const state = await getPortalState()

    const mappedCandidates: AdminCandidateOverviewItem[] = state.candidates.map((c, index) => {
      const numId = typeof c.id === 'number' ? c.id : parseInt(String(c.id).replace(/\D/g, ''), 10) || (index + 1)
      return {
        id: numId,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        fullName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Kandidat',
        email: c.email || '',
        phone: c.phone || '',
        // Tabela za ambasadu traži broj PASOŠA; podatak koji fali ostaje prazan, ništa se ne izmišlja.
        idCardOrPassportNumber: c.passportNumber || undefined,
        dateOfBirth: String(c.birthDate || c.dateOfBirth || '') || undefined,
        citizenship: 'SRB',
        facultyName: c.faculty || undefined,
        studyCity: String(c.studyCity || c.city || '') || undefined,
        programCode: c.packageId || 'swt-full',
        packageName: c.packageName || 'Work & Travel USA',
        processStatus: c.status === 'ready' ? 'COMPLETED' : 'ACTIVE',
        currentStep: c.status,
        currentStepLabel: c.status,
        progressPercent: c.progress || 30,
        hasJobOffer: ['job', 'departure', 'ready'].includes(c.status),
        employerName: String(c.selectedJobEmployer || c.jobEmployer || '') || undefined,
        jobTitle: String(c.selectedJobTitle || c.jobTitle || '') || undefined,
        workCity: String(c.selectedJobCity || c.jobCity || '') || undefined,
        workState: undefined,
        finalPrice: c.finalPrice,
        paymentMethod: c.paymentMethod,
        adminNotes: c.notes,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    const buffer = await generateEmbassyExcelBuffer(mappedCandidates)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="01.04. American Adventure.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    console.error('Embassy export failed:', error)
    return new Response('Greška pri izvozu tabele za Ambasadu SAD.', { status: 500 })
  }
}
