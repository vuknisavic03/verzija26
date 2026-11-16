import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { verifyPortalInvitation } from '@/modules/portal-sync/localStore.ts'
import {
  aiReaderConfigured,
  IdentityScanError,
  readWithAi,
  readWithOcr,
  type ScanFile,
} from '@/modules/identity-scan/identityReaders.ts'
import { combineIdentityRead, isIdentityKind } from '@/modules/identity-scan/identityRules.ts'
import { isSameOriginRequest } from '@/modules/security/sameOrigin.ts'

const MAX_FILE_BYTES = 15 * 1_024 * 1_024
const MAX_FILES = 2

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })
}

/**
 * Automatsko očitavanje pasoša (strana sa fotografijom) ili lične karte (prednja i/ili zadnja
 * strana). Pre registracije kandidat nema nalog, pa se traži važeća pozivnica (email + kod);
 * prijavljen kandidat ili agencija mogu bez nje. Slike se ovde ne čuvaju.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ message: 'Zahtev nije dozvoljen.' }, 403)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ message: 'Okači fotografiju dokumenta.' }, 400)
  }
  const kind = form.get('kind')
  if (!isIdentityKind(kind)) return json({ message: 'Nepoznat dokument.' }, 400)

  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') {
    const check = await verifyPortalInvitation(String(form.get('email') || ''), String(form.get('code') || ''))
    if (!check.valid) return json({ message: check.message || 'Prvo potvrdi email i kod iz pozivnice.' }, 401)
  }

  const files: ScanFile[] = []
  for (const entry of form.getAll('files').slice(0, MAX_FILES)) {
    if (!(entry instanceof File) || entry.size === 0) continue
    if (entry.size > MAX_FILE_BYTES) return json({ message: 'Fotografija može imati najviše 15 MB.' }, 413)
    files.push({ bytes: Buffer.from(await entry.arrayBuffer()), mimeType: entry.type })
  }
  if (!files.length) return json({ message: 'Okači fotografiju dokumenta.' }, 400)

  try {
    let source: 'ai' | 'ocr' = aiReaderConfigured() ? 'ai' : 'ocr'
    let read
    try {
      read = source === 'ai' ? await readWithAi(kind, files) : await readWithOcr(kind, files)
    } catch (error) {
      // AI nedostupan (mreža, kvota, greška servisa): lokalno čitanje MRZ-a kao rezerva.
      if (source !== 'ai') throw error
      source = 'ocr'
      read = await readWithOcr(kind, files)
    }
    const result = combineIdentityRead(kind, read)
    if (result.blocking) return json({ message: result.blocking, ...result }, 422)
    if (!Object.keys(result.fields).length) {
      const message =
        kind === 'idcard'
          ? 'Nisu pronađeni redovi sa znakovima „<<<" sa zadnje strane lične karte. Okači zadnju stranu, slikanu ravno i izbliza, ili upiši podatke ručno.'
          : 'Nisu pronađeni redovi sa znakovima „<<<" na dnu strane sa fotografijom. Slikaj pasoš ravno i izbliza, ili upiši podatke ručno.'
      return json({ message, ...result }, 422)
    }
    return json({ ...result, source })
  } catch (error) {
    if (error instanceof IdentityScanError) return json({ message: error.message }, error.status)
    console.error('Identity scan failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return json({ message: 'Očitavanje nije uspelo. Upiši podatke ručno.' }, 500)
  }
}
