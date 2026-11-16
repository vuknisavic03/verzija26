/** DS-160 odgovori koje portal prima (isti ključevi kao forma u front/src/data/candidateStore/ds160.js). */
export const DS160_KEYS = [
  'lastNameAndMaiden',
  'firstName',
  'gender',
  'maritalStatus',
  'dateOfBirth',
  'birthPlace',
  'birthCountry',
  'citizenship',
  'jmbg',
  'ssn',
  'passportNumber',
  'passportCountry',
  'passportExpiryDate',
  'employerInfo',
  'supervisorName',
  'stayAddress',
  'employerPhone',
  'tripFunder',
  'previousUsTravel',
  'visaRefusal',
  'homeAddress',
  'mobilePhone',
  'primaryEmail',
  'socialMediaAccounts',
  'highSchoolInfo',
  'university',
  'studyProgram',
  'referencePerson1',
  'referencePerson2',
  'emergencyContact',
] as const

const MAX_LENGTH = 1000

/** Zadržava samo poznata polja, kao tekst, bez suvišnih razmaka i do 1000 znakova. */
export function sanitizeDs160Answers(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const source = input as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of DS160_KEYS) {
    const value = source[key]
    if (typeof value === 'string' || typeof value === 'number') {
      out[key] = String(value).trim().slice(0, MAX_LENGTH)
    }
  }
  return out
}
