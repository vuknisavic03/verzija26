// front/src/data/candidateStore/session.js
// Sesija i lokalni keš: ko je prijavljen, lista kandidata i sinhronizacija sa backendom.
// Namerno mali modul bez zavisnosti — jedino što javni deo sajta mora da učita iz store-a.

import { CANDIDATES_KEY, INVITATIONS_KEY, CURRENT_USER_KEY, PROMOTIONS_KEY, loadData, saveData } from "./storage.js";
import { INITIAL_CANDIDATES } from "./mockSeed.js";
import { setJobsCache } from "../jobsStore.js";

export function getCandidates() {
  return loadData(CANDIDATES_KEY, INITIAL_CANDIDATES);
}

export function getCurrentUser() {
  return loadData(CURRENT_USER_KEY, null);
}

export function setCurrentUser(user) {
  saveData(CURRENT_USER_KEY, user);
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}

/**
 * Učitava stanje portala sa backenda. Zahteva prijavu (kolačić sesije):
 * agencija dobija sve kandidate, kandidat samo sopstveni zapis.
 */
export async function syncFromBackend() {
  try {
    const res = await fetch("/api/public/portal-state", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.invitations)) {
      saveData(INVITATIONS_KEY, data.invitations);
    }
    if (Array.isArray(data.candidates)) {
      saveData(CANDIDATES_KEY, data.candidates);
    }
    if (Array.isArray(data.jobs)) {
      setJobsCache(data.jobs);
    }
    if (Array.isArray(data.promotions) && data.promotions.length > 0) {
      saveData(PROMOTIONS_KEY, data.promotions);
    }
    if (data.candidate) {
      const current = getCurrentUser();
      if (!current || current.email?.toLowerCase() === data.candidate.email?.toLowerCase()) {
        setCurrentUser({ ...(current || {}), ...data.candidate });
      }
    }
    // Ekrani koji su već otvoreni (admin pregled, lista kandidata) se osvežavaju.
    window.dispatchEvent(new CustomEvent("aa_candidate_updated"));
    return data;
  } catch {
    return null;
  }
}

/* ── Prijava i sesija ─────────────────────────────────────────────────────
 * Sesija je HttpOnly kolačić koji postavlja backend (Payload). U pregledaču se
 * ne čuva ni lozinka ni token — localStorage drži samo keš prikaza.
 */

async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

// Posle 5 pogrešnih lozinki Payload zaključa nalog na 15 minuta i tada odbija i tačnu lozinku (401).
const LOCKED_MESSAGE =
  "Nalog je privremeno zaključan posle 5 pogrešnih pokušaja. Sačekaj 15 minuta ili postavi novu lozinku preko „Zaboravljena lozinka\" — to ga odmah otključava.";

function isLocked(res) {
  return (res.data?.errors || []).some((e) => /locked/i.test(String(e?.message || "")));
}

function loginError(status) {
  if (status === 403) return "Email još nije potvrđen. Otvori link iz mejla koji smo ti poslali posle registracije.";
  if (status === 429) return "Previše pokušaja. Sačekaj 15 minuta pa probaj ponovo.";
  if (status === 0) return "Nema veze sa serverom. Proveri internet i probaj ponovo.";
  return "Email ili lozinka nisu tačni.";
}

/** Prijava kandidata emailom i lozinkom; posle uspeha učitava njegov profil. */
export async function loginCandidate(email, password) {
  const res = await postJson("/api/candidate-accounts/login", {
    email: String(email || "").trim().toLowerCase(),
    password,
  });
  // 403 dolazi samo uz tačnu lozinku, kad email još nije potvrđen.
  if (!res.ok && isLocked(res)) return { ok: false, status: res.status, locked: true, error: LOCKED_MESSAGE };
  if (!res.ok) return { ok: false, status: res.status, unverified: res.status === 403, error: loginError(res.status) };
  const data = await syncFromBackend();
  const candidate = data?.candidate || null;
  if (candidate) setCurrentUser(candidate);
  return { ok: true, candidate };
}

/** Prijava agencije (Payload kolekcija `users`). */
export async function loginAdmin(email, password) {
  const res = await postJson("/api/users/login", {
    email: String(email || "").trim().toLowerCase(),
    password,
  });
  if (!res.ok && isLocked(res)) return { ok: false, status: res.status, locked: true, error: LOCKED_MESSAGE };
  if (!res.ok) return { ok: false, status: res.status, error: loginError(res.status) };
  return { ok: Boolean(res.data?.user), status: res.status, error: res.data?.user ? "" : loginError(401) };
}

/**
 * Ko je prijavljen po kolačiću sesije: "admin", "candidate" ili null.
 * Vraća null i kada server nije dostupan — pozivalac tada zadržava lokalni prikaz.
 */
export async function fetchSessionRole() {
  const me = async (collection) => {
    try {
      const res = await fetch(`/api/${collection}/me`, { credentials: "include" });
      if (!res.ok) return { reachable: true, user: null };
      const data = await res.json().catch(() => ({}));
      return { reachable: true, user: data?.user || null };
    } catch {
      return { reachable: false, user: null };
    }
  };
  const [admin, candidate] = await Promise.all([me("users"), me("candidate-accounts")]);
  if (admin.user) return { reachable: true, role: "admin", user: admin.user };
  if (candidate.user) return { reachable: true, role: "candidate", user: candidate.user };
  return { reachable: admin.reachable || candidate.reachable, role: null, user: null };
}

/** Odjava sa obe kolekcije (briše kolačić) i čišćenje lokalnog keša. */
export async function logoutSession() {
  await Promise.all([
    postJson("/api/users/logout"),
    postJson("/api/candidate-accounts/logout"),
  ]);
  clearCurrentUser();
  try {
    localStorage.removeItem(CANDIDATES_KEY);
    localStorage.removeItem(INVITATIONS_KEY);
  } catch {}
}

/** Ponovno slanje linka za potvrdu emaila. Odgovor je isti bez obzira da li nalog postoji. */
export async function resendVerificationEmail(email) {
  const res = await postJson("/api/public/candidate-accounts/resend-verification", {
    email: String(email || "").trim().toLowerCase(),
  });
  if (res.status === 429) return { ok: false, message: "Previše zahteva. Sačekaj 15 minuta pa probaj ponovo." };
  if (res.status === 0) return { ok: false, message: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  return {
    ok: res.ok,
    message: res.data?.message || "Ako nalog čeka potvrdu, poslali smo novi link.",
    devVerificationUrl: res.data?.devVerificationUrl || "",
  };
}

/** Link iz mejla „Potvrdi email". */
export async function confirmEmail(token) {
  const res = await postJson("/api/public/candidate-accounts/verify-email", { token });
  if (res.ok) return { ok: true, email: res.data?.email || "" };
  if (res.status === 0) return { ok: false, reason: "offline", message: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  return { ok: false, reason: res.data?.reason || "invalid", message: res.data?.message || "Link nije ispravan." };
}
