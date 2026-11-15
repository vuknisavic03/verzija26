// front/src/data/candidateStore/translations.js
// Prevod uverenja o studiranju i MUP uverenja na engleski. Sve radi server:
// AI prevod iz otpremljenog originala → kandidat proverava i potvrđuje → agencija odobrava.

import { saveCandidate } from "./candidates.js";
import { syncFromBackend } from "./session.js";

const OFFLINE = "Nema veze sa serverom. Proveri internet i probaj ponovo.";

export const TRANSLATION_FIELD = { faculty: "facultyCertTranslation", police: "policeCertTranslation" };
export const ORIGINAL_FILE_FIELD = { faculty: "facultyCertFileName", police: "policeCertificateFileName" };
export const ORIGINAL_URL_FIELD = { faculty: "facultyCertUrl", police: "policeCertificateUrl" };

export function getTranslation(candidate, doc) {
  const value = candidate?.[TRANSLATION_FIELD[doc]];
  return value && typeof value === "object" ? value : null;
}

/**
 * Stanje prevoda za prikaz:
 *  missing      — nema originala
 *  needed       — original postoji, prevoda nema
 *  review       — prevod je spreman, kandidat treba da ga proveri i potvrdi
 *  confirmed    — kandidat potvrdio, čeka agenciju
 *  approved     — agencija odobrila
 *  rejected     — agencija vratila (vidi rejectionReason)
 */
export function translationState(candidate, doc) {
  if (!candidate?.[ORIGINAL_FILE_FIELD[doc]]) return "missing";
  const t = getTranslation(candidate, doc);
  if (!t) return "needed";
  if (t.status === "approved") return "approved";
  if (t.status === "rejected") return "rejected";
  return t.candidateConfirmedAt ? "confirmed" : "review";
}

export const TRANSLATION_STATUS_LABEL = {
  missing: "Nema fajla",
  needed: "Treba prevod",
  review: "Proveri prevod",
  confirmed: "Prevod čeka agenciju",
  approved: "Prevod odobren",
  rejected: "Prevod vraćen",
};

/** Prevod je dovoljan za slanje dosijea kad ga je kandidat potvrdio ili ga je agencija odobrila. */
export function translationDone(candidate, doc) {
  const state = translationState(candidate, doc);
  return state === "confirmed" || state === "approved";
}

export function translationPdfUrl(doc, email) {
  const params = new URLSearchParams({ doc });
  if (email) params.set("email", email);
  return `/api/public/translations/pdf?${params.toString()}`;
}

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          data.message ||
          (res.status === 429 ? "Previše pokušaja. Probaj ponovo kasnije." : "Zahtev nije uspeo. Probaj ponovo."),
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

function keep(candidate) {
  return candidate ? saveCandidate(candidate, { skipRemoteSync: true }) : null;
}

/** AI prevod. Za agenciju se šalje i email kandidata. */
export async function requestTranslation(doc, email) {
  const res = await post("/api/public/translations", email ? { doc, email } : { doc });
  if (!res.ok) return res;
  return { ok: true, candidate: keep(res.data.candidate) };
}

export async function confirmTranslation(doc, note = "") {
  const res = await post("/api/public/translations/confirm", { confirm: true, doc, ...(note.trim() ? { note: note.trim() } : {}) });
  if (!res.ok) return res;
  return { ok: true, candidate: keep(res.data.candidate) };
}

/** Agencija: action = "save" | "approve" | "reject". */
export async function reviewTranslation({ email, doc, action, data, reason }) {
  const res = await post("/api/admin/portal-translations/review", {
    action,
    doc,
    email,
    ...(data ? { data } : {}),
    ...(reason ? { reason } : {}),
  });
  if (!res.ok) return res;
  return { ok: true, candidate: keep(res.data.candidate) };
}

/** Overen prevod sudskog tumača (umesto AI prevoda). */
export async function uploadCertifiedTranslation(doc, file, email) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("type", doc === "faculty" ? "facultyCertTranslation" : "policeCertTranslation");
    if (email) form.append("email", email);
    const res = await fetch("/api/public/documents/upload", { method: "POST", body: form, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) return { ok: false, error: data.message || "Prevod nije okačen." };
    const synced = await syncFromBackend();
    return { ok: true, candidate: synced?.candidate || null, message: data.message };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
