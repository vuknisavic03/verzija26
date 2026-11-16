// front/src/data/candidateStore/jobs.js
// Izbor posla i Job Offer. Server uzima podatke iz kataloga agencije i proverava redosled
// (dosije odobren → izbor → intervju → izbor poslodavca → potpis ponude).

import { saveCandidate } from "./candidates.js";

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
