// front/src/data/candidateStore/payments.js
// Uplate i fakture. Kandidat uplatu samo prijavljuje; agencija je potvrđuje, a server tada izdaje
// fakturu u zajedničkoj KIR numeraciji. Sve cene su u USD; faktura preračunava u RSD po
// srednjem kursu NBS na dan prijema uplate.

export const CURRENCY = "USD";

const usd = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const rsd = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatUsd(value) {
  return `${usd.format(Number(value) || 0)} USD`;
}

export function formatRsdAmount(value) {
  return `${rsd.format(Number(value) || 0)} RSD`;
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/** Agencija: potvrdi ratu ("1" | "2" | "3" | "FULL"). Vraća { ok, candidate, invoiceNumber } ili { ok:false, error }. */
export async function confirmPortalPaymentAdmin({ email, installment, receivedAt, exchangeRate, reference }) {
  const body = { email, installment: String(installment).toUpperCase(), receivedAt };
  const rate = Number(String(exchangeRate ?? "").replace(",", "."));
  if (rate > 0) body.exchangeRate = rate;
  if (reference && String(reference).trim()) body.reference = String(reference).trim();
  try {
    const res = await fetch("/api/admin/portal-payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status, error: data.message || "Potvrda nije uspela." };
    return { ok: true, alreadyConfirmed: Boolean(data.alreadyConfirmed), candidate: data.candidate, invoiceNumber: data.invoiceNumber };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

/** Fakture sa servera. Kandidat uvek dobija svoje; agencija sve ili za jedan email. */
export async function fetchPortalInvoices(email) {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  try {
    const res = await fetch(`/api/public/portal-invoices${query}`, { credentials: "include" });
    if (!res.ok) return [];
    const data = await readJson(res);
    return Array.isArray(data.invoices) ? data.invoices : [];
  } catch {
    return [];
  }
}

export function portalInvoicePdfUrl(id) {
  return `/api/public/portal-invoices/${encodeURIComponent(String(id))}`;
}

export const INSTALLMENT_LABEL = {
  "1": "I rata",
  "2": "II rata",
  "3": "III rata",
  FULL: "Program u celosti",
};

/** Instrukcije za uplatu rate ("1" | "2" | "3" | "FULL"), sa servera. */
export async function fetchPaymentInstructions(installment) {
  try {
    const res = await fetch(`/api/public/payment-instructions?installment=${encodeURIComponent(installment)}`, {
      credentials: "include",
    });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, error: data.message || "Uplatnica trenutno nije dostupna." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proveri internet i probaj ponovo." };
  }
}

export function paymentSlipPdfUrl(installment) {
  return `/api/public/payment-slips/download?installment=${encodeURIComponent(installment)}`;
}
