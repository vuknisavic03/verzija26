/**
 * Email obaveštenja iz portala: koja promena u dosijeu šalje koju poruku, i kako poruka izgleda.
 * Bez baze i mreže, da bi pravila bila testirana. Slanje je u portalNotifications.ts.
 */

type Record_ = Record<string, unknown>

export type CandidateNoticeKind =
  | 'documentsApproved'
  | 'documentsRejected'
  | 'contractApproved'
  | 'contractRejected'
  | 'jobOfferReady'
  | 'translationRejected'
  | 'paymentConfirmed'

export type AgencyNoticeKind = 'dossierSubmitted' | 'paymentReported'

export interface Notice<K extends string = string> {
  kind: K
  details: Record<string, string>
}

export interface RenderedNotice {
  html: string
  subject: string
  text: string
}

const INSTALLMENT_FIELDS: Array<[string, string]> = [
  ['firstInstallmentStatus', 'I rata'],
  ['secondInstallmentStatus', 'II rata'],
  ['thirdInstallmentStatus', 'III rata'],
  ['fullPaymentStatus', 'cela cena'],
]

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

/** Šta je agencija promenila, a kandidat treba da zna. */
export function candidateNoticesFor(before: Record_ | null, after: Record_): Notice<CandidateNoticeKind>[] {
  const b = before || {}
  const notices: Notice<CandidateNoticeKind>[] = []
  if (b.documentsApproved !== true && after.documentsApproved === true) {
    notices.push({ details: {}, kind: 'documentsApproved' })
  } else if (b.documentsVerificationStatus !== 'rejected' && after.documentsVerificationStatus === 'rejected') {
    notices.push({ details: { reason: str(after.documentsRejectionReason) }, kind: 'documentsRejected' })
  }
  if (b.contractApproved !== true && after.contractApproved === true) {
    notices.push({ details: {}, kind: 'contractApproved' })
  } else if (b.contractVerificationStatus !== 'rejected' && after.contractVerificationStatus === 'rejected') {
    notices.push({ details: { reason: str(after.contractRejectionReason) }, kind: 'contractRejected' })
  }
  if (b.jobApplicationStatus !== 'ACCEPTED' && after.jobApplicationStatus === 'ACCEPTED') {
    notices.push({
      details: { employer: str(after.selectedJobEmployer), title: str(after.selectedJobTitle) },
      kind: 'jobOfferReady',
    })
  }
  return notices
}

/** Šta je kandidat uradio, a agencija treba da pogleda. */
export function agencyNoticesFor(before: Record_ | null, after: Record_): Notice<AgencyNoticeKind>[] {
  const b = before || {}
  const notices: Notice<AgencyNoticeKind>[] = []
  const submittedNow =
    after.documentsSubmittedForReview === true &&
    after.documentsVerificationStatus === 'pending' &&
    !(b.documentsSubmittedForReview === true && b.documentsVerificationStatus === 'pending')
  if (submittedNow) notices.push({ details: {}, kind: 'dossierSubmitted' })
  for (const [field, label] of INSTALLMENT_FIELDS) {
    if (b[field] !== 'pending' && b[field] !== 'paid' && after[field] === 'pending') {
      notices.push({ details: { installment: label }, kind: 'paymentReported' })
    }
  }
  return notices
}

/* ── Šabloni ─────────────────────────────────────────────────────────────── */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface Layout {
  action: { href: string; label: string }
  heading: string
  paragraphs: string[]
  quote?: string
}

function render(subject: string, layout: Layout, signature = 'American Adventure'): RenderedNotice {
  const textParts = [layout.heading, '', ...layout.paragraphs]
  if (layout.quote) textParts.push('', `„${layout.quote}“`)
  textParts.push('', `${layout.action.label}: ${layout.action.href}`, '', signature)

  const p = (value: string) => `<p style="margin:0 0 14px">${escapeHtml(value)}</p>`
  const html = `<!doctype html><html lang="sr"><body style="margin:0;background:#f5f4f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#231f20"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e7e4dd"><tr><td style="padding:28px 28px 8px"><div style="height:6px;width:48px;background:#fdd503;border-radius:3px;margin-bottom:22px"></div><h1 style="margin:0 0 16px;font-size:21px;line-height:1.3">${escapeHtml(layout.heading)}</h1>${layout.paragraphs.map(p).join('')}${
    layout.quote
      ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f5f4f1;border-radius:10px">„${escapeHtml(layout.quote)}“</p>`
      : ''
  }<p style="margin:22px 0 26px"><a href="${escapeHtml(layout.action.href)}" style="display:inline-block;background:#fdd503;color:#231f20;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(layout.action.label)}</a></p></td></tr><tr><td style="padding:16px 28px 24px;border-top:1px solid #e7e4dd;font-size:13px;color:#6b6b70">${escapeHtml(signature)}</td></tr></table></td></tr></table></body></html>`
  return { html, subject, text: textParts.join('\n') }
}

export function renderCandidateNotice(
  notice: Notice<CandidateNoticeKind>,
  context: { firstName: string; portalUrl: string },
): RenderedNotice {
  const hi = context.firstName ? `Zdravo ${context.firstName},` : 'Zdravo,'
  const open = { href: context.portalUrl, label: 'Otvori portal' }
  const d = notice.details
  switch (notice.kind) {
    case 'documentsApproved':
      return render('Dosije je odobren | American Adventure', {
        action: open,
        heading: 'Dosije je odobren',
        paragraphs: [hi, 'Pregledali smo tvoj dosije i sve je u redu. Sledeći korak je izbor posla: u portalu su poslovi koji su ti ponuđeni.'],
      })
    case 'documentsRejected':
      return render('Dosije treba dopuniti | American Adventure', {
        action: open,
        heading: 'Dosije treba dopuniti',
        paragraphs: [hi, 'Pregledali smo tvoj dosije. Pre odobrenja treba da ispraviš ovo:'],
        quote: d.reason || 'Pogledaj napomenu u portalu.',
      })
    case 'contractApproved':
      return render('Ugovor je overen | American Adventure', {
        action: open,
        heading: 'Ugovor je overen',
        paragraphs: [hi, 'Proverili smo tvoj potpisan ugovor i sve je u redu. Sledeće korake vidiš u portalu.'],
      })
    case 'contractRejected':
      return render('Ugovor treba ispraviti | American Adventure', {
        action: open,
        heading: 'Ugovor treba ispraviti',
        paragraphs: [hi, 'Proverili smo tvoj ugovor. Pre overe treba da ispraviš ovo:'],
        quote: d.reason || 'Pogledaj napomenu u portalu.',
      })
    case 'jobOfferReady': {
      const role = [d.title, d.employer].filter(Boolean).join(', ')
      return render('Poslodavac te je izabrao | American Adventure', {
        action: { href: context.portalUrl, label: 'Otvori Job Offer' },
        heading: 'Poslodavac te je izabrao',
        paragraphs: [
          hi,
          role ? `Čestitamo! Izabran si za poziciju: ${role}.` : 'Čestitamo! Poslodavac te je izabrao.',
          'Job Offer te čeka u portalu. Proveri podatke o poslu i smeštaju, pa ga potpiši.',
        ],
      })
    }
    case 'translationRejected':
      return render('Prevod treba ispraviti | American Adventure', {
        action: open,
        heading: 'Prevod treba ispraviti',
        paragraphs: [hi, `Proverili smo prevod dokumenta „${d.document || 'uverenje'}“ uz original. Treba da ispraviš ovo:`],
        quote: d.reason || 'Pogledaj napomenu u portalu.',
      })
    case 'paymentConfirmed':
      return render(`Uplata je proknjižena (${d.invoiceNumber}) | American Adventure`, {
        action: { href: context.portalUrl, label: 'Pogledaj fakturu' },
        heading: 'Uplata je proknjižena',
        paragraphs: [
          hi,
          `Primili smo tvoju uplatu (${d.installment}${d.amount ? `, ${d.amount} USD` : ''}). Hvala!`,
          `Faktura ${d.invoiceNumber} je u portalu, u delu Uplate → Fakture.`,
        ],
      })
  }
}

export function renderAgencyNotice(
  notice: Notice<AgencyNoticeKind>,
  context: { adminUrl: string; candidateEmail: string; candidateName: string },
): RenderedNotice {
  const who = `${context.candidateName || 'Kandidat'} (${context.candidateEmail})`
  const open = { href: context.adminUrl, label: 'Otvori admin portal' }
  if (notice.kind === 'dossierSubmitted') {
    return render(
      `Dosije na pregled: ${context.candidateName || context.candidateEmail}`,
      {
        action: open,
        heading: 'Dosije čeka pregled',
        paragraphs: [`${who} je poslao dosije na pregled. Proveri dokumenta i prevode, pa odobri dosije ili ga vrati na dopunu.`],
      },
      'Portal American Adventure',
    )
  }
  return render(
    `Prijavljena uplata: ${context.candidateName || context.candidateEmail}, ${notice.details.installment}`,
    {
      action: open,
      heading: 'Kandidat je prijavio uplatu',
      paragraphs: [`${who} kaže da je uplatio: ${notice.details.installment}. Kad uplata stigne na izvod, proknjiži je u dosijeu (kartica Uplate).`],
    },
    'Portal American Adventure',
  )
}

/** Javni sajt (gde je portal), ne adresa backenda. */
export function publicSiteUrl(env: Record<string, string | undefined> = process.env) {
  const explicit = env.PUBLIC_SITE_URL?.trim()
  const fromOrigins = env.PUBLIC_SITE_ORIGINS?.split(',').map((s) => s.trim()).find(Boolean)
  const fallback = env.NEXT_PUBLIC_SERVER_URL?.trim() || 'http://localhost:5173'
  return (explicit || fromOrigins || fallback).replace(/\/$/, '')
}
