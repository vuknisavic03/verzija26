// front/src/data/candidateStore/invitations.js
// Pozivnice, verifikacioni kodovi, registracija i OCR pasoša

import {
  INVITATIONS_KEY,
  CANDIDATES_KEY,
  loadData,
  saveData,
} from "./storage.js";
import {
  INITIAL_INVITATIONS,
  INITIAL_CANDIDATES,
  PROGRAM_PACKAGES,
} from "./mockSeed.js";
import { saveCandidate } from "./candidates.js";

export function getInvitations() {
  const list = loadData(INVITATIONS_KEY, INITIAL_INVITATIONS);
  const candidates = loadData(CANDIDATES_KEY, INITIAL_CANDIDATES);
  let changed = false;
  const sanitized = list.map((inv) => {
    if (inv.status === "registered") {
      const cand = candidates.find(
        (c) => c.email && c.email.toLowerCase() === (inv.email || "").toLowerCase()
      );
      const isCandRegistered = Boolean(
        cand &&
        (cand.isRegistered || cand.registeredAt || ["review", "docs", "job", "departure", "ready"].includes(cand.status)) &&
        !String(cand.id).startsWith("preapp-")
      );
      if (!isCandRegistered) {
        changed = true;
        return { ...inv, status: "pending", registeredAt: null };
      }
    }
    return inv;
  });
  if (changed) {
    saveData(INVITATIONS_KEY, sanitized);
  }
  return sanitized;
}

export function resetInvitation(code) {
  const norm = String(code || "").trim().toUpperCase();
  const list = loadData(INVITATIONS_KEY, INITIAL_INVITATIONS);
  const idx = list.findIndex((i) => (i.code || "").toUpperCase() === norm);
  if (idx >= 0) {
    const updated = [...list];
    updated[idx] = { ...updated[idx], status: "pending", registeredAt: null };
    saveData(INVITATIONS_KEY, updated);

    // Ako kandidat ima status review a još nije prošao registraciju
    const candidates = loadData(CANDIDATES_KEY, INITIAL_CANDIDATES);
    const candIdx = candidates.findIndex(
      (c) =>
        (c.activationCode && c.activationCode.toUpperCase() === norm) ||
        (c.email && c.email.toLowerCase() === (updated[idx].email || "").toLowerCase())
    );
    if (candIdx >= 0 && candidates[candIdx].status === "review" && !candidates[candIdx].registeredAt) {
      candidates[candIdx] = { ...candidates[candIdx], status: "applying", progress: 25 };
      saveData(CANDIDATES_KEY, candidates);
    }

    // Sinhronizacija sa backendom
    fetch("/api/public/portal-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "resetInvitation",
        payload: { code: norm },
      }),
    }).catch(() => {});

    return updated[idx];
  }
  return null;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Isti format kao na serveru (AA-XXXX-XXXX); konačan kod uvek dodeljuje server. */
function generateInvitationCode() {
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
  return `AA-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * Pravi pozivnicu na serveru; server šalje kandidatu mejl sa kodom i linkom za registraciju.
 * Vraća { ok, invitation, emailSent, error }.
 */
export async function createInvitation({ email, candidateName, packageId, discount = 0, discountNote = "" }) {
  const pkg = PROGRAM_PACKAGES.find((p) => p.id === packageId) || PROGRAM_PACKAGES[0];
  const discNum = Math.max(0, Number(discount) || 0);
  const finalPrice = Math.max(0, pkg.basePrice - discNum);

  const code = generateInvitationCode();

  const newInv = {
    code,
    email: email.trim().toLowerCase(),
    candidateName: candidateName ? candidateName.trim() : "",
    packageId: pkg.id,
    packageName: pkg.name,
    basePrice: pkg.basePrice,
    discount: discNum,
    discountNote: discountNote.trim(),
    finalPrice,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  try {
    const res = await fetch("/api/public/portal-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "createInvitation", payload: newInv }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.invitation) {
      return { ok: false, error: data.message || "Pozivnica nije sačuvana. Probaj ponovo." };
    }
    if (Array.isArray(data.invitations)) saveData(INVITATIONS_KEY, data.invitations);
    return { ok: true, invitation: data.invitation, emailSent: Boolean(data.emailSent) };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

/** Ponovo pošalji mejl sa pozivnicom (isti kod). */
export async function resendInvitationEmail(code) {
  try {
    const res = await fetch("/api/public/portal-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "resendInvitation", payload: { code } }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message || (res.ok ? "Pozivnica je ponovo poslata." : "Mejl nije poslat.") };
  } catch {
    return { ok: false, message: "Nema veze sa serverom." };
  }
}

export function validateInvitationForRegistration(email, code) {
  const normEmail = (email || "").trim().toLowerCase();
  const normCode = (code || "").trim().toUpperCase();

  if (!normEmail) {
    return {
      valid: false,
      error: "Morate uneti email adresu na koju vam je poslat verifikacioni kod.",
    };
  }
  if (!normCode) {
    return {
      valid: false,
      error: "Morate uneti verifikacioni kod iz pozivnice.",
    };
  }

  const list = getInvitations();
  const invitationByCode = list.find((inv) => inv.code.toUpperCase() === normCode);

  if (!invitationByCode) {
    return {
      valid: false,
      error: "Verifikacioni kod nije pronađen. Molimo proverite unos koda.",
    };
  }

  if (invitationByCode.email.toLowerCase() !== normEmail) {
    return {
      valid: false,
      error: `Verifikacioni kod ${normCode} je vezan isključivo za email: ${invitationByCode.email}. Ne možete se registrovati sa drugom email adresom.`,
    };
  }

  if (invitationByCode.status === "registered") {
    const candidates = loadData(CANDIDATES_KEY, INITIAL_CANDIDATES);
    const registeredCand = candidates.find(
      (c) =>
        c.email &&
        c.email.toLowerCase() === normEmail &&
        c.status !== "applying" &&
        !String(c.id).startsWith("preapp-") &&
        c.registeredAt
    );
    if (!registeredCand) {
      // Auto-heal: Nema stvarnog registrovanog profila, dozvoli aktivaciju
      invitationByCode.status = "pending";
      const list = loadData(INVITATIONS_KEY, INITIAL_INVITATIONS);
      const iIdx = list.findIndex((i) => (i.code || "").toUpperCase() === normCode);
      if (iIdx >= 0) {
        list[iIdx] = { ...list[iIdx], status: "pending", registeredAt: null };
        saveData(INVITATIONS_KEY, list);
      }
    } else {
      return {
        valid: false,
        error: `Verifikacioni kod za ${invitationByCode.email} je već iskorišćen za registraciju naloga. Molimo prijavite se na stranici za prijavu sa vašom lozinkom.`,
      };
    }
  }

  return { valid: true, invitation: invitationByCode };
}

/**
 * Verifikuje pozivnicu preko pravog backend endpointa (/api/public/candidate-invitations/verify)
 * uz fallback na lokalni keš.
 */
export async function verifyInvitationWithBackend(email, code) {
  try {
    const res = await fetch("/api/public/candidate-invitations/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.valid) {
      return { valid: true, invitation: data.invitation };
    }
    // Server je odlučio (kod ne postoji, iskorišćen je ili je nalog već aktiviran): lokalni keš to ne sme da pregazi.
    if (data && res.status < 500) {
      return { valid: false, alreadyActive: Boolean(data.alreadyActive), error: data.message || "Kod nije ispravan." };
    }
    const local = validateInvitationForRegistration(email, code);
    if (local.valid) {
      return local;
    }
    if (data && data.message && res.status < 500) {
      return { valid: false, error: data.message };
    }
    if (!local.valid && local.error) {
      return local;
    }
    if (data && data.message) {
      return { valid: false, error: data.message };
    }
  } catch {
    // Fallback na lokalnu proveru ako server nije dostupan
  }
  return validateInvitationForRegistration(email, code);
}

/**
 * Automatsko očitavanje pasoša ili lične karte (1–2 slike). Pre registracije se šalju email i kod
 * iz pozivnice. Vraća { ok, fields, warnings, mrzValid } ili { ok: false, message }.
 */
export async function scanIdentityDocument({ kind, files, email, code }) {
  try {
    const form = new FormData();
    form.append("kind", kind);
    if (email) form.append("email", email);
    if (code) form.append("code", code);
    for (const file of files) form.append("files", file);
    const res = await fetch("/api/public/identity-scan", { method: "POST", body: form, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 429
            ? "Previše pokušaja. Sačekaj nekoliko minuta ili upiši podatke ručno."
            : data.message || "Očitavanje nije uspelo. Upiši podatke ručno.",
      };
    }
    return { ok: true, fields: data.fields || {}, mrzValid: Boolean(data.mrzValid), warnings: data.warnings || [] };
  } catch {
    return { ok: false, message: "Nema veze sa serverom. Proveri internet ili upiši podatke ručno." };
  }
}

/**
 * Registruje kandidata na backendu (/api/public/candidate-accounts/register): pravi nalog sa
 * lozinkom i profil. Bez lokalne rezerve — nalog postoji samo ako ga je server napravio.
 * Vraća { ok, candidate } ili { ok: false, error }.
 */
export async function registerCandidateWithBackend(candidatePayload) {
  const registeredAt = candidatePayload.registeredAt || new Date().toISOString();
  try {
    const res = await fetch("/api/public/candidate-accounts/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...candidatePayload, registeredAt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) return { ok: false, error: "Previše pokušaja. Sačekaj 15 minuta pa probaj ponovo." };
      return { ok: false, error: data?.message || "Registracija nije uspela. Probaj ponovo." };
    }
    const candidate = data.candidate
      ? saveCandidate({ ...data.candidate, isRegistered: true, registeredAt }, { skipRemoteSync: true })
      : null;
    return {
      ok: true,
      candidate,
      email: data.email || "",
      verificationRequired: Boolean(data.verificationRequired),
      // Samo lokalno, kad se mejlovi ne šalju: link iz mejla za potvrdu.
      devVerificationUrl: data.devVerificationUrl || "",
    };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

export function findInvitation(email, code) {
  const normEmail = (email || "").trim().toLowerCase();
  const normCode = (code || "").trim().toUpperCase();
  if (!normCode) return null;

  const list = getInvitations();
  if (normEmail) {
    return (
      list.find(
        (inv) =>
          inv.code.toUpperCase() === normCode &&
          inv.email.toLowerCase() === normEmail
      ) || null
    );
  }
  return list.find((inv) => inv.code.toUpperCase() === normCode) || null;
}
