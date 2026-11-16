import { MAX_PRIVATE_DOCUMENT_BYTES, type SupportedDocumentMimeType } from '@/modules/candidate-documents/privateDocument.ts'
import { processPassportOcr } from '@/modules/passport-ocr/ocrService.ts'

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })
}

function detectMimeType(bytes: Uint8Array, fileName: string, declaredType: string): SupportedDocumentMimeType {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (fileName.toLowerCase().endsWith('.pdf') || declaredType === 'application/pdf') {
    return 'application/pdf'
  }
  if (fileName.toLowerCase().endsWith('.png') || declaredType === 'image/png') {
    return 'image/png'
  }
  return 'image/jpeg'
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return json({ message: 'Okači fotografiju pasoša.', success: false }, 400)
    }

    const form = await request.formData()
    const file = form.get('passport')

    if (!(file instanceof File)) {
      return json({ message: 'Izaberite sliku ili PDF pasoša.', success: false }, 400)
    }

    if (file.size === 0) {
      return json({ message: 'Izabrani fajl je prazan.', success: false }, 400)
    }

    if (file.size > MAX_PRIVATE_DOCUMENT_BYTES) {
      return json({ message: 'Dokument može imati najviše 5 MB.', success: false }, 413)
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const mimeType = detectMimeType(bytes, file.name, file.type)

    const ocrResult = await processPassportOcr(bytes, mimeType)

    return json({
      confidence: ocrResult.confidence,
      extracted: ocrResult.extracted,
      match: ocrResult.match,
      message: ocrResult.success
        ? 'Podaci iz pasoša su uspešno očitani.'
        : 'MRZ zona nije prepoznata na slici. Možete ručno proveriti i uneti podatke.',
      status: ocrResult.status,
      success: ocrResult.success,
    })
  } catch (error) {
    console.error('Public passport OCR error:', error)
    return json(
      {
        message: 'Greška prilikom OCR očitavanja pasoša. Možete uneti podatke ručno.',
         status: 'FAILED',
        success: false,
      },
      500,
    )
  }
}
