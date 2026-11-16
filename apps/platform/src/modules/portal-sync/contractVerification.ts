type Candidate = Record<string, unknown>

export class ContractVerificationError extends Error {
  constructor(message: string, readonly status: 404 | 409) {
    super(message)
  }
}

const DEFAULT_REASON = 'Potpisani ugovor nije ispravan. Okači ga ponovo.'

/**
 * Agencija overava ili vraća svojeručno potpisan ugovor. Radi nad trenutnim zapisom sa servera
 * (ne nad kopijom iz admin pregledača), pa ne gazi ono što je kandidat u međuvremenu promenio.
 */
export function applyContractVerification(
  candidate: Candidate,
  input: { approved: boolean; reason?: string },
  now = new Date(),
): Candidate {
  if (!candidate.signedContractFileName && !candidate.signedContractUrl) {
    throw new ContractVerificationError('Kandidat još nije okačio potpisan ugovor.', 409)
  }
  const at = now.toISOString()
  const day = now.toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade' })
  const status = String(candidate.status || '')
  const notes = String(candidate.notes || '')
  if (input.approved) {
    const firstPaid = candidate.firstInstallmentApproved === true || candidate.firstInstallmentStatus === 'paid'
    const log = `[${day}]: Svojeručno potpisan ugovor i Izjava o odgovornosti odobreni.`
    return {
      ...candidate,
      contractApproved: true,
      contractRejectedAt: null,
      contractRejectionReason: '',
      contractVerificationStatus: 'approved',
      contractVerifiedAt: at,
      notes: notes ? `${notes}\n${log}` : log,
      // Ugovor i I rata odobreni: kandidat prelazi na dokumenta.
      status: firstPaid && (status === 'review' || status === 'applying') ? 'docs' : status,
    }
  }
  const reason = String(input.reason || '').trim().slice(0, 500) || DEFAULT_REASON
  const log = `[${day}]: Ugovor vraćen na ponovno slanje (${reason}).`
  return {
    ...candidate,
    contractApproved: false,
    contractRejectedAt: at,
    contractRejectionReason: reason,
    contractVerificationStatus: 'rejected',
    contractVerifiedAt: at,
    notes: notes ? `${notes}\n${log}` : log,
    status: status === 'docs' || status === 'in_review' ? 'review' : status,
  }
}
