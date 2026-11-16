// front/src/data/candidateStore/jobOffer.js
// Job Offer šalje poslodavac. Kandidat ga potpiše i okači, a agencija ga proverava uz ostala dokumenta.

/**
 * Stanje potpisanog Job Offer-a:
 * "locked" (poslodavac još nije ponudio posao), "missing" (treba okačiti), "pending" (čeka agenciju),
 * "rejected" (vraćen kandidatu), "approved" (odobren).
 */
export function jobOfferState(candidate) {
  const c = candidate || {};
  const status = c.jobOfferVerificationStatus;
  if (status === "approved") return "approved";
  // Stari zapisi: Job Offer potpisan elektronski, pre nego što se okačivao fajl.
  if (!c.jobOfferFileName && (c.jobOfferSignedAt || c.jobOfferAccepted)) {
    return "approved";
  }
  if (c.jobOfferFileName) return status === "rejected" ? "rejected" : "pending";
  return c.jobApplicationStatus === "ACCEPTED" ? "missing" : "locked";
}

export function jobOfferApproved(candidate) {
  return jobOfferState(candidate) === "approved";
}
