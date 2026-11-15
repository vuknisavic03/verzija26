// front/src/components/FinancesSection.jsx
// Finansije: Knjiga izdatih računa (KIR) sa servera. Fakture nastaju samo kad agencija potvrdi
// uplatu u dosijeu kandidata; ovde se pregledaju, preuzimaju i izvoze. Sve je u USD, sa
// preračunom u RSD po srednjem kursu NBS na dan prijema uplate.
import { useEffect, useMemo, useState } from "react";
import { formatRsd } from "../data/invoicesStore";
import { formatUsd, INSTALLMENT_LABEL } from "../data/candidateStore";
import { PageHeader, Card, FIELD_CLS } from "./admin/ui";

const MONTHS = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];
const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

export default function FinancesSection() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setInvoices(null);
    setError("");
    fetch(`/api/admin/invoices?year=${year}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(data.message || "Fakture trenutno nisu dostupne.");
          setInvoices([]);
          return;
        }
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      })
      .catch(() => {
        if (!active) return;
        setError("Nema veze sa serverom.");
        setInvoices([]);
      });
    return () => {
      active = false;
    };
  }, [year]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoices || []).filter((inv) => {
      if (month && new Date(inv.issueDate).getMonth() + 1 !== Number(month)) return false;
      if (!q) return true;
      return [inv.invoiceNumber, inv.buyerName, inv.portalEmail, inv.paymentReference]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [invoices, month, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, inv) => ({
          rsd: acc.rsd + (inv.settlementAmountRsdCents || 0) / 100,
          usd: acc.usd + (inv.originalCurrency === "USD" ? (inv.originalAmountCents || 0) / 100 : 0),
        }),
        { rsd: 0, usd: 0 }
      ),
    [filtered]
  );

  const exportUrl = `/api/admin/kir/export?year=${year}${month ? `&month=${month}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finansije"
        subtitle="Knjiga izdatih računa. Faktura nastaje kad potvrdiš uplatu u dosijeu kandidata."
        action={
          <a
            href={exportUrl}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-4.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface"
          >
            Izvezi KIR (Excel)
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Fakturisano", formatRsd(totals.rsd), `${filtered.length} ${filtered.length === 1 ? "faktura" : "faktura"}`],
          ["U devizama", formatUsd(totals.usd), "Po ugovorima, u USD"],
          ["Period", month ? `${MONTHS[Number(month) - 1]} ${year}.` : `${year}. godina`, "Po datumu izdavanja"],
        ].map(([label, value, note]) => (
          <Card key={label} className="px-5 py-4">
            <p className="text-[13px] text-ink-3">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
            <p className="mt-0.5 text-xs text-ink-3">{note}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Broj fakture, ime, email ili poziv na broj"
            className={FIELD_CLS}
          />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={FIELD_CLS}>
            <option value="">Svi meseci</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={FIELD_CLS}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {invoices === null ? (
          <p className="px-5 py-8 text-sm text-ink-3">Učitavam fakture…</p>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-red-700">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-3">
            Nema faktura za izabrani period. Fakture nastaju kad u dosijeu kandidata potvrdiš uplatu.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">
                    <span className="tabular-nums">{inv.invoiceNumber}</span> · {inv.buyerName}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    {formatDate(inv.issueDate)}
                    {inv.portalInstallment ? ` · ${INSTALLMENT_LABEL[inv.portalInstallment] || inv.portalInstallment}` : ""}
                    {inv.paymentReference ? ` · ${inv.paymentReference}` : ""}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="text-right">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">
                      {inv.originalCurrency === "USD"
                        ? formatUsd(inv.originalAmountCents / 100)
                        : `${(inv.originalAmountCents / 100).toFixed(2)} ${inv.originalCurrency}`}
                    </p>
                    <p className="text-xs tabular-nums text-ink-3">
                      {formatRsd(inv.settlementAmountRsdCents / 100)}
                      {inv.exchangeRateScaled ? ` · kurs ${(inv.exchangeRateScaled / 1_000_000).toFixed(4)}` : ""}
                    </p>
                  </div>
                  <a href={`/api/admin/invoices/${inv.id}/download`} className={linkCls}>
                    PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
