// front/src/data/candidateStore/jobs.js
// Izbor posla i Job Offer. Server uzima podatke iz kataloga agencije i proverava redosled
// (dosije odobren → izbor → intervju → izbor poslodavca → potpis ponude).

import { saveCandidate } from "./candidates.js";
import { syncFromBackend } from "./session.js";

async function readJson(res) {
  return res.json().catch(() => ({}));
}

const OFFLINE = "Nema veze sa serverom. Proveri internet i probaj ponovo.";

export async function selectJobOnServer(jobId) {
  try {
    const res = await fetch("/api/public/portal-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "selectJob", payload: { jobId } }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.candidate) return { ok: false, error: data.message || "Izbor posla nije sačuvan." };
    return { ok: true, candidate: saveCandidate(data.candidate, { skipRemoteSync: true }) };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

export async function fetchJobOffer() {
  try {
    const res = await fetch("/api/public/job-offer", { credentials: "include" });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, error: data.message || "Ponuda trenutno nije dostupna." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

export async function acceptJobOffer(fingerprint, signature) {
  try {
    const res = await fetch("/api/public/job-offer/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ confirm: true, fingerprint, signature }),
    });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status, error: data.message || "Potpis nije uspeo." };
    const synced = await syncFromBackend();
    return { ok: true, candidate: synced?.candidate || data.candidate };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
