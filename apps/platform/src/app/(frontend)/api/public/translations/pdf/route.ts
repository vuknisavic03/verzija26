import { resolvePortalActor } from '@/modules/portal-sync/access.ts'
import { isTranslationDoc } from '@/modules/portal-sync/portalTranslationRules.ts'
import { PortalTranslationError, translationPdf } from '@/modules/portal-sync/portalTranslations.ts'

/** PDF prevoda: kandidat svoj, agencija bilo čiji (?email=). */
export async function GET(request: Request) {
  const actor = await resolvePortalActor()
  if (actor.kind === 'anonymous') return new Response('Prijavi se ponovo.', { status: 401 })
  const url = new URL(request.url)
  const doc = url.searchParams.get('doc')
  if (!isTranslationDoc(doc)) return new Response('Nepoznat dokument.', { status: 400 })
  const email = actor.kind === 'candidate' ? actor.email : (url.searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return new Response('Izaberi kandidata.', { status: 400 })
  try {
    const file = await translationPdf({ doc, email })
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Content-Type': file.mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof PortalTranslationError) return new Response(error.message, { status: error.status })
    console.error('Translation PDF failed.', error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    return new Response('PDF trenutno nije dostupan.', { status: 500 })
  }
}
