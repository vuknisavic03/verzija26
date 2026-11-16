import sharp from 'sharp'

import { describeAnthropicError } from '../ai/anthropicErrors.ts'

import {
  extractToolInput,
  normalizeTranslationData,
  TRANSLATION_SYSTEM_PROMPT,
  TRANSLATION_TOOL,
  TRANSLATION_TOOL_NAME,
  translationUserPrompt,
  type TranslationData,
  type TranslationDoc,
} from './portalTranslationRules.ts'

/**
 * Poziv AI modela (Anthropic Messages API) koji čita original i vraća strukturisan prevod.
 *
 * Podešavanje na serveru:
 *  - ANTHROPIC_API_KEY  (obavezno; bez njega prevod vraća 503 i kandidat može da okači overen prevod)
 *  - TRANSLATION_MODEL  (neobavezno; podrazumevano claude-sonnet-5-5)
 */

export class TranslationUnavailableError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 503 = 503,
    /** Razlog za agenciju (npr. nema kredita), bez sadržaja dokumenta. */
    readonly detail = '',
  ) {
    super(message)
  }
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-5-5'
const TIMEOUT_MS = 120_000
const MAX_IMAGE_SIDE = 2_000

export function translationModel() {
  return process.env.TRANSLATION_MODEL?.trim() || DEFAULT_MODEL
}

export function translationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

async function sourceBlock(bytes: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf' || bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    return {
      source: { data: bytes.toString('base64'), media_type: 'application/pdf', type: 'base64' },
      type: 'document',
    }
  }
  // Fotografije sa telefona: ispravi rotaciju, smanji i pretvori u JPEG (limit API-ja je 5 MB po slici).
  let jpeg: Buffer
  try {
    jpeg = await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({ fit: 'inside', height: MAX_IMAGE_SIDE, width: MAX_IMAGE_SIDE, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    throw new TranslationUnavailableError('Ovaj format fajla ne može da se prevede. Okači PDF, JPG ili PNG.', 400)
  }
  return { source: { data: jpeg.toString('base64'), media_type: 'image/jpeg', type: 'base64' }, type: 'image' }
}

export async function translateWithAi(input: {
  bytes: Buffer
  doc: TranslationDoc
  fetchImpl?: typeof fetch
  mimeType: string
}): Promise<{ data: TranslationData; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new TranslationUnavailableError(
      'AI prevod trenutno nije uključen. Okači overen prevod sudskog tumača ili se javi agenciji.',
    )
  }
  const model = translationModel()
  const block = await sourceBlock(input.bytes, input.mimeType)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await (input.fetchImpl || fetch)(API_URL, {
      body: JSON.stringify({
        max_tokens: 8_000,
        messages: [
          {
            content: [
              block,
              {
                text: `${translationUserPrompt(input.doc)}\n\nAnswer only by calling the ${TRANSLATION_TOOL_NAME} tool once. Do not reply with plain text.`,
                type: 'text',
              },
            ],
            role: 'user',
          },
        ],
        model,
        system: TRANSLATION_SYSTEM_PROMPT,
        // Neki modeli ne dozvoljavaju nametnut alat (tool_choice "tool"/"any"); „auto" radi sa svima.
        tool_choice: { type: 'auto' },
        tools: [TRANSLATION_TOOL],
      }),
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      method: 'POST',
      signal: controller.signal,
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    console.error('Translation request failed.', aborted ? 'TIMEOUT' : error instanceof Error ? error.name : 'UNKNOWN')
    throw new TranslationUnavailableError('Prevod trenutno ne može da se napravi. Pokušaj ponovo za nekoliko minuta.')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // U log ide samo tip i kratka poruka servisa (bez sadržaja dokumenta).
    const failure = await describeAnthropicError(response)
    console.error(`Translation API error ${failure.log}`)
    if (failure.kind === 'billing' || failure.kind === 'auth' || failure.kind === 'model') {
      throw new TranslationUnavailableError(
        'AI prevod trenutno nije dostupan. Probaj kasnije ili okači overen prevod sudskog tumača.',
        503,
        failure.log,
      )
    }
    if (failure.kind === 'input') {
      throw new TranslationUnavailableError(
        'Ovaj fajl ne može da se prevede (prevelik ili oštećen). Okači PDF ili jasnu fotografiju dokumenta.',
        400,
        failure.log,
      )
    }
    throw new TranslationUnavailableError(
      'Prevod trenutno ne može da se napravi. Pokušaj ponovo za nekoliko minuta.',
      503,
      failure.log,
    )
  }

  let raw: unknown
  try {
    raw = extractToolInput(await response.json())
  } catch (error) {
    console.error('Translation response unusable.', error instanceof Error ? error.message : 'UNKNOWN')
    throw new TranslationUnavailableError('Prevod nije uspeo. Pokušaj ponovo, a ako se ponovi, okači jasniji sken.')
  }
  return { data: normalizeTranslationData(raw), model }
}
