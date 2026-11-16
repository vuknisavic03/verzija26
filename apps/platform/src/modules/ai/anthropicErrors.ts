/**
 * Razlog greške Anthropic API-ja, bez sadržaja dokumenta: tip greške i kratka poruka servisa
 * (npr. nema kredita, neispravan ključ, model ne postoji, slika prevelika).
 */
export type AnthropicFailure = 'billing' | 'auth' | 'model' | 'rate' | 'input' | 'unavailable'

export async function describeAnthropicError(response: Response): Promise<{ kind: AnthropicFailure; log: string }> {
  let type = ''
  let message = ''
  try {
    const body = (await response.json()) as { error?: { message?: unknown; type?: unknown } }
    type = String(body?.error?.type || '')
    message = String(body?.error?.message || '')
      .replace(/\s+/g, ' ')
      .slice(0, 160)
  } catch {
    // telo nije JSON
  }
  const lower = message.toLowerCase()
  const kind: AnthropicFailure =
    lower.includes('credit balance') || lower.includes('billing') || lower.includes('purchase credits')
      ? 'billing'
      : response.status === 401 || response.status === 403 || type === 'authentication_error' || type === 'permission_error'
        ? 'auth'
        : response.status === 404 || type === 'not_found_error'
          ? 'model'
          : response.status === 429 || type === 'rate_limit_error'
            ? 'rate'
            : response.status === 400 || response.status === 413
              ? 'input'
              : 'unavailable'
  const hint: Record<AnthropicFailure, string> = {
    auth: 'ANTHROPIC_API_KEY nije ispravan ili nema dozvolu.',
    billing: 'Na Anthropic nalogu nema kredita (console.anthropic.com → Plans & Billing).',
    input: 'Servis nije prihvatio fajl.',
    model: 'Model ne postoji (TRANSLATION_MODEL / IDENTITY_SCAN_MODEL).',
    rate: 'Prekoračen limit zahteva.',
    unavailable: 'Servis trenutno nije dostupan.',
  }
  return { kind, log: `${response.status} ${type || '-'}: ${hint[kind]}${message ? ` (${message})` : ''}` }
}
