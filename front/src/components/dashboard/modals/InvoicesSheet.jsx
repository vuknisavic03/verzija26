// front/src/components/dashboard/modals/InvoicesSheet.jsx
// Fakture kandidata. Izdaje ih agencija pri potvrdi uplate; ovde se samo preuzima PDF.
import Sheet, { SheetFooter, Hint } from "../Sheet";
import { Button } from "../../ui";
import { formatRsdAmount, formatUsd, INSTALLMENT_LABEL, portalInvoicePdfUrl } from "../../../data/candidateStore";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function InvoicesSheet({ invoices = [], onClose }) {
  return (
    <Sheet
      onClose={onClose}
      title="Fakture"
      subtitle="Faktura stiže kad agencija potvrdi tvoju uplatu."
      footer={
        <SheetFooter>
          <Button variant="primary" onClick={onClose}>
            Zatvori
          </Button>
        </SheetFooter>
      }
    >
      {invoices.length === 0 ? (
        <Hint>Još nema faktura. Kad uplatiš ratu i prijaviš uplatu, agencija je potvrdi i ovde se pojavi faktura.</Hint>
      ) : (
        <ul className="divide-y divide-line">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-ink">{INSTALLMENT_LABEL[inv.installment] || "Uplata"}</p>
                <p className="mt-0.5 text-[13px] tabular-nums text-ink-3">
                  {inv.invoiceNumber} · {formatDate(inv.issueDate)}
                </p>
                <a
                  href={portalInvoicePdfUrl(inv.id)}
                  className="mt-2 inline-block text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  Preuzmi PDF
                </a>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] font-semibold tabular-nums text-ink">{formatUsd(inv.amountUsd)}</p>
                <p className="mt-0.5 text-xs tabular-nums text-ink-3">{formatRsdAmount(inv.settlementRsd)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
