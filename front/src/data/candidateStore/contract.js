// front/src/data/candidateStore/contract.js
// Ugovor u portalu: pregled, snimanje podataka za ugovor, preuzimanje i slanje mejlom (potpis je svojeručni).
// Svi podaci se čitaju i pišu na serveru — pregledač ne sastavlja ugovor sam.

import { saveCandidate } from "./candidates.js";
import { getCurrentUser } from "./session.js";

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/** Šta kandidat potpisuje: broj ugovora, izjava, otisak sadržaja, šta nedostaje, postojeće prihvatanje. */
export async function fetchContractPreview() {
  try {
    const res = await fetch("/api/public/contracts/preview", { credentials: "include" });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, error: data.message || "Ugovor trenutno nije dostupan." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

/** Snima podatke za ugovor i čeka potvrdu servera (ugovor se pravi tek iz sačuvanih podataka). */
export async function saveContractDetails({ jmbg, passportNumber, address, phone }) {
  const current = getCurrentUser() || {};
  try {
    const res = await fetch("/api/public/portal-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "saveCandidate", payload: { ...current, jmbg, passportNumber, address, phone } }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.candidate) return { ok: false, error: data.message || "Podaci nisu sačuvani. Probaj ponovo." };
    const saved = saveCandidate(data.candidate, { skipRemoteSync: true });
    return { ok: true, candidate: saved };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

/** Šalje ugovor sa podacima kandidata (PDF u prilogu) na njegov email. */
export async function emailPortalContract() {
  try {
    const res = await fetch("/api/public/contracts/email", { method: "POST", credentials: "include" });
    const data = await readJson(res);
    if (res.status === 429) return { ok: false, error: "Ugovor je već poslat više puta. Preuzmi ga ovde ili probaj kasnije." };
    if (!res.ok) return { ok: false, error: data.message || "Slanje nije uspelo. Preuzmi ugovor ovde." };
    return { ok: true, message: data.message || "Ugovor je poslat na tvoj email." };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

/**
 * Preuzima ugovor sa servera (nacrt sa podacima ili, posle potpisa, sačuvanu potpisanu verziju).
 * Agencija prosleđuje ID kandidata; kandidat uvek dobija svoj.
 */
export async function downloadPortalContract({ id } = {}) {
  const query = new URLSearchParams({ type: "all" });
  if (id) query.set("id", String(id));
  try {
    const res = await fetch(`/api/public/contracts/download?${query}`, { credentials: "include" });
    if (!res.ok) {
      const message = (await res.text().catch(() => "")) || "Ugovor trenutno nije dostupan.";
      return { ok: false, error: message.slice(0, 300) };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const name = decodeURIComponent((disposition.match(/filename="([^"]+)"/) || [])[1] || "Ugovor.pdf");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}
