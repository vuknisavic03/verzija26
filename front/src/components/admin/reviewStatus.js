// front/src/components/admin/reviewStatus.js
// Jedan rečnik statusa za ceo admin. Iz statusa se uvek vidi ko je na potezu:
//   Čeka tvoju proveru  (žuto)   kandidat je nešto poslao, red je na agenciji
//   Odobreno            (zeleno) agencija je potvrdila
//   Vraćeno kandidatu   (crveno) agencija je vratila sa razlogom, čeka se ispravka
//   Čeka kandidata      (sivo)   kandidat još ništa nije poslao
// Uplate imaju svoje reči (prijavljena / proknjižena), a odluke poslodavca svoje (nudi posao / odbio).

export const REVIEW = {
  todo: { state: "current", label: "Čeka kandidata" },
  review: { state: "wait", label: "Čeka tvoju proveru" },
  approved: { state: "done", label: "Odobreno" },
  returned: { state: "danger", label: "Vraćeno kandidatu" },
  later: { state: "locked", label: "Kasnije" },
};

/** Ključ iz REVIEW za dokument koji agencija odobrava ili vraća. */
export function reviewKey({ submitted, approved, returned, locked = false }) {
  if (approved) return "approved";
  if (returned) return "returned";
  if (submitted) return "review";
  return locked ? "later" : "todo";
}

/** Prevod uverenja, iz ugla agencije (kandidat vidi svoje reči). */
export const ADMIN_TRANSLATION = {
  missing: { state: "current", label: "Čeka kandidata" },
  needed: { state: "current", label: "Kandidat još nije preveo" },
  review: { state: "current", label: "Kandidat proverava prevod" },
  confirmed: { state: "wait", label: "Prevod čeka tvoju proveru" },
  declared: { state: "wait", label: "Bez prevoda — čeka tvoju proveru" },
  approved: { state: "done", label: "Prevod odobren" },
  waived: { state: "done", label: "Odobreno bez prevoda" },
  rejected: { state: "danger", label: "Prevod vraćen kandidatu" },
};

export const PAYMENT = {
  open: { state: "current", label: "Nije prijavljena" },
  reported: { state: "wait", label: "Prijavljena — proveri izvod" },
  booked: { state: "done", label: "Proknjižena" },
};

/** Razgovor i odluka poslodavca (to nije odobrenje agencije). */
export const EMPLOYER = {
  NONE: { state: "current", label: "Kandidat nije izabrao posao" },
  APPLIED: { state: "wait", label: "Zakaži razgovor" },
  SCHEDULED: { state: "wait", label: "Razgovor zakazan — upiši ishod" },
  ACCEPTED: { state: "done", label: "Poslodavac nudi posao" },
  NO_SLOTS: { state: "danger", label: "Poslodavac nema mesta" },
  REJECTED: { state: "danger", label: "Poslodavac je odbio" },
};
