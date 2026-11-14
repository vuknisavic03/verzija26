import config from '@payload-config'
import { createHash, randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'

import {
  CANDIDATE_PASSWORD_MAXIMUM_LENGTH,
  CANDIDATE_PASSWORD_MINIMUM_LENGTH,
} from '@/modules/candidate-accounts/passwordPolicy.ts'
import { ensureCandidateProcess } from '@/modules/candidate-processes/ensureCandidateProcess.ts'
import {
  savePortalCandidate,
  verifyPortalInvitation,
} from '@/modules/portal-sync/localStore.ts'
import { submitPreApplication } from '@/modules/pre-applications/submitPreApplication.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'
import type { PreApplication } from '@/payload-types.ts'

const MAXIMUM_BODY_SIZE = 25 * 1_024 * 1_024
const STUDY_YEARS = new Set(['YEAR_1', 'YEAR_2', 'YEAR_3', 'YEAR_4', 'YEAR_5', 'YEAR_6', 'MASTER', 'DOCTORAL', 'OTHER'])

function text(value: unknown, fallback: string, max = 200) {
  const clean = typeof value === 'string' ? value.trim() : ''
  return (clean || fallback).slice(0, max)
}

function isoDate(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/**
 * Kandidat bez online prijave (agencija ga je pozvala direktno) dobija prijavu u bazi, jer je
 * nalog uvek vezan za podnosioca i prijavu. Postojeća prijava za isti email se ponovo koristi.
 */
async function findOrCreatePreApplication(
  payload: Payload,
  email: string,
  code: string,
  body: Record<string, unknown>,
  firstName: string,
  lastName: string,
): Promise<PreApplication> {
  const existing = await payload.find({
    collection: 'pre-applications',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    sort: '-createdAt',
    where: { 'submission.email': { equals: email } },
  })
  if (existing.docs[0]) return existing.docs[0]

  const studyYear = String(body.studyYear || '').toUpperCase()
  const phone = text(body.phone, 'nije naveden', 40)
  const { reference } = await submitPreApplication({
    correlationId: randomUUID(),
    idempotencyKeyHash: createHash('sha256').update(`invitation:${code}`).digest('hex'),
    input: {
      applicantNote: `Registracija preko pozivnice ${code}`,
      currentStudyYear: (STUDY_YEARS.has(studyYear) ? studyYear : 'OTHER') as 'OTHER',
      dateOfBirth: isoDate(body.birthDate) || '2000-01-01',
      email,
      emailNormalized: email.toLocaleLowerCase('sr-Latn'),
      espbPoints: Math.max(0, Math.trunc(Number(body.ectsPoints) || 0)),
      facultyName: text(body.faculty, 'nije naveden'),
      firstName,
      firstNameNormalized: firstName.toLocaleLowerCase('sr-Latn'),
      lastName,
      lastNameNormalized: lastName.toLocaleLowerCase('sr-Latn'),
      newsletterConsent: false,
      phone,
      phoneNormalized: phone.replace(/\D/g, ''),
      privacyConsent: true,
      residentialAddress: text(body.address, 'nije navedena', 300),
      studyCity: text(body.studyCity, 'nije naveden', 100),
      studyInterruptionExplanation: undefined,
      studyInterruptionStatus: 'NONE',
      website: '',
    },
    now: new Date(),
    payload,
  })
  const created = await payload.find({
    collection: 'pre-applications',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { correlationId: { equals: reference } },
  })
  if (!created.docs[0]) throw new Error('PRE_APPLICATION_NOT_CREATED')
  return created.docs[0]
}

/** Pravi aktivan nalog sa lozinkom koju je kandidat izabrao (kod iz pozivnice je dokaz emaila). */
async function createActiveAccount(
  payload: Payload,
  application: PreApplication,
  email: string,
  fullName: string,
  password: string,
) {
  const now = new Date()
  const existing = await payload.find({
    collection: 'candidate-accounts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: email } },
  })
  const current = existing.docs[0]
  if (current && (current.accountStatus === 'ACTIVE' || current._verified)) {
    return { error: 'Nalog za ovaj email već postoji. Prijavi se svojom lozinkom.', status: 409 }
  }
  if (current?.accountStatus === 'SUSPENDED') {
    return { error: 'Nalog je privremeno zaključan. Javi se agenciji.', status: 403 }
  }

  const data = {
    accountStatus: 'ACTIVE' as const,
    activationNonce: null,
    password,
    verifiedAt: now.toISOString(),
    _verified: true,
  }
  const account = current
    ? await payload.update({ collection: 'candidate-accounts', data, id: current.id, overrideAccess: true })
    : await payload.create({
        collection: 'candidate-accounts',
        data: {
          ...data,
          activationVersion: 0,
          applicant: typeof application.applicant === 'number' ? application.applicant : application.applicant.id,
          email,
          fullName,
          preApplication: application.id,
          programCode: 'SWT',
        },
        disableVerificationEmail: true,
        overrideAccess: true,
      })

  await ensureCandidateProcess({ account, application, now, payload })
  return { account }
}

function json(body: unknown, status: number) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)
  const declaredSize = Number(request.headers.get('content-length') ?? 0)
  if (declaredSize > MAXIMUM_BODY_SIZE) return json({ message: 'Zahtev je prevelik.' }, 413)

  try {
    const rawBody = await request.text()
    // Telo dolazi iz postojeće forme portala; polja se pojedinačno čiste ispod.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json({ message: 'Uneti podaci nisu ispravni.' }, 400)
    }

    const code = String(body.code || '').trim().toUpperCase()
    const email = String(body.email || '').trim().toLowerCase()
    const firstName = String(body.firstName || '').trim()
    const lastName = String(body.lastName || '').trim()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!code || !email || !firstName || !lastName) {
      return json({ message: 'Nedostaju obavezni podaci za registraciju.' }, 400)
    }
    if (
      password.length < CANDIDATE_PASSWORD_MINIMUM_LENGTH ||
      password.length > CANDIDATE_PASSWORD_MAXIMUM_LENGTH
    ) {
      return json({
        fieldErrors: { password: `Lozinka mora imati najmanje ${CANDIDATE_PASSWORD_MINIMUM_LENGTH} znakova.` },
        message: `Lozinka mora imati najmanje ${CANDIDATE_PASSWORD_MINIMUM_LENGTH} znakova.`,
      }, 400)
    }

    const verification = await verifyPortalInvitation(email, code)
    if (!verification.valid || !verification.invitation) {
      return json(
        { message: verification.message || 'Verifikacioni kod nije ispravan.' },
        verification.status || 400,
      )
    }

    const payload = await getPayload({ config })
    const application = await findOrCreatePreApplication(payload, email, code, body, firstName, lastName)
    const created = await createActiveAccount(payload, application, email, `${firstName} ${lastName}`.trim(), password)
    if ('error' in created) return json({ message: created.error }, created.status ?? 400)

    const inv = verification.invitation
    const savedApp = await savePortalCandidate({
      id: body.id && !String(body.id).startsWith('preapp-') ? body.id : `cand-${Date.now()}`,
      basePrice: inv.basePrice || Number(body.basePrice) || 1850,
      code,
      cvFileName: body.cvFileName || undefined,
      discount: inv.discount ?? Number(body.discount) ?? 0,
      discountNote: inv.discountNote || body.discountNote || '',
      email: inv.email.toLowerCase(),
      faculty: body.faculty ? String(body.faculty).trim() : undefined,
      studyCity: body.studyCity ? String(body.studyCity).trim() : undefined,
      studyYear: body.studyYear || undefined,
      ectsPoints: body.ectsPoints !== undefined ? Number(body.ectsPoints) : undefined,
      birthDate: body.birthDate ? String(body.birthDate).trim() : undefined,
      address: body.address ? String(body.address).trim() : undefined,
      passportExpiryDate: body.passportExpiryDate ? String(body.passportExpiryDate).trim() : undefined,
      gender: body.gender ? String(body.gender).trim() : undefined,
      facultyCertAiTranslation: Boolean(body.facultyCertAiTranslation),
      facultyCertFileName: body.facultyCertFileName || undefined,
      finalPrice: inv.finalPrice || Number(body.finalPrice) || 1850,
      firstName,
      guarantor: body.guarantor || null,
      idCardNumber: body.idCardNumber ? String(body.idCardNumber).trim() : '',
      passportNumber: body.passportNumber
        ? String(body.passportNumber).trim()
        : body.idCardNumber
        ? String(body.idCardNumber).trim()
        : undefined,
      passportImage: body.passportImage || body.passportScanDataUrl || undefined,
      passportScanDataUrl: body.passportScanDataUrl || body.passportImage || undefined,
      passportScanFileName:
        body.passportScanFileName ||
        (body.passportImage || body.passportScanDataUrl ? 'Sken_Pasosa_OCR.png' : undefined),
      passportScanUrl: body.passportScanUrl || undefined,
      jmbg: body.jmbg ? String(body.jmbg).trim() : '',
      lastName,
      notes: 'Uspešno registrovan preko verifikacionog koda ' + code,
      packageId: inv.packageId || body.packageId || 'swt-full',
      packageName: inv.packageName || body.packageName || 'Work & Travel USA — Full Placement',
      paymentMethod: body.paymentMethod || 'now',
      phone: body.phone ? String(body.phone).trim() : undefined,
      preferences: body.preferences || {
        englishLevel: 'B2',
        location: '',
        position: '',
        testLink: '',
      },
      progress: 40,
      status: 'review',
      isRegistered: true,
      registeredAt: body.registeredAt || new Date().toISOString(),
      selectionDecision: 'QUALIFIED',
      activationCode: code,
      youtubeUrl: body.youtubeUrl || undefined,
    })

    // Pregledač se odmah zatim prijavljuje preko /api/candidate-accounts/login (standardna Payload
    // prijava sa ograničenjem pokušaja), pa dobija HttpOnly kolačić sesije.
    return json({ candidate: savedApp, message: 'Registracija je uspešno završena.' }, 200)
  } catch (error) {
    console.error('Registration failed:', error instanceof Error ? `${error.name}: ${error.message}` : 'UNKNOWN_ERROR')
    return json({ message: 'Registracija trenutno nije uspela. Molimo pokušajte ponovo.' }, 500)
  }
}
