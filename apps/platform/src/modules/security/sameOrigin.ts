/**
 * Dodatni javni domeni sajta (npr. Netlify domen koji preko proxy-ja prosleđuje `/api/*` ovom
 * serveru). Zapeta razdvaja više vrednosti: `https://americanadventure.rs,https://www.americanadventure.rs`.
 */
export function trustedSiteOrigins(): string[] {
  return (process.env.PUBLIC_SITE_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin]
      } catch {
        return []
      }
    })
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const configuredURL = process.env.NEXT_PUBLIC_SERVER_URL?.trim()
  try {
    if (origin === new URL(configuredURL || request.url).origin) return true
  } catch {
    return false
  }
  return trustedSiteOrigins().includes(origin)
}
