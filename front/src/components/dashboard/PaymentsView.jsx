// front/src/components/dashboard/PaymentsView.jsx
// Sve što ima veze sa novcem, na jednom mestu: plan uplata, uplatnice, računi i popusti.
import { useEffect, useState } from "react";
import { Button, cx } from "../ui";
import { ReceiptIcon } from "./icons";
import { Panel, LinkButton, DataList, TaskIcon } from "./ui";
import { formatUsd } from "../../data/candidateStore";
import PaymentSlip from "./PaymentSlip";
import { firstPaymentAmount } from "./Step0Registration";
import { isPkz, thirdInstallmentAmount } from "./Step3VisaDeparture";

const PAY_TONE = { done: "text-emerald-700", wait: "text-amber-700", neutral: "text-ink-3" };

function PaymentRow({ id, title, note, amount, tone, statusLabel, children }) {
  return (
    <li id={id} className="scroll-mt-28 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3.5">
          <TaskIcon state={tone === "done" ? "done" : tone === "wait" ? "wait" : statusLabel === "Kasnije" ? "locked" : "current"} className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink">{title}</p>
            {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {amount && <p className="text-[15px] font-semibold tabular-nums text-ink">{amount}</p>}
          <p className={cx("mt-0.5 text-[13px]", PAY_TONE[tone] || PAY_TONE.neutral)}>{statusLabel}</p>
        </div>
      </div>
      {children && <div className="mt-3 pl-[2.125rem]">{children}</div>}
    </li>
  );
}

export default function PaymentsView({ ctx }) {
  const {
    candidate,
    hasSignedContract,
    isFirstInstallmentPaid,
    isFirstInstallmentPending,
    hasConfirmedJob,
    isSecondInstallmentPaid,
    isSecondInstallmentPending,
    isThirdInstallmentPaid,
    isThirdInstallmentPending,
    isReady,
    handlePaymentSlipClick,
    handleReportFirstInstallment,
    handleReportSecondInstallment,
    handleReportThirdInstallment,
    setShowInvoicesModal,
    candidateInvoices,
    setShowChangeDiscountModal,
    slipRequest,
    clearSlipRequest,
  } = ctx;
  const [copied, setCopied] = useState(false);
  // Koja uplatnica je otvorena ("1" | "2" | "3" | "FULL").
  const [openSlip, setOpenSlip] = useState(null);
  const toggleSlip = (key) => setOpenSlip((cur) => (cur === key ? null : key));

  // Dugme „Uplati“ iz koraka otvara odgovarajuću uplatnicu ovde.
  useEffect(() => {
    if (!slipRequest) return;
    setOpenSlip(slipRequest);
    clearSlipRequest?.();
    const row = slipRequest === "2" ? "pay-rate2" : slipRequest === "3" ? "pay-rate3" : "pay-rate1";
    requestAnimationFrame(() => document.getElementById(row)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [slipRequest, clearSlipRequest]);

  const isFull = candidate.paymentMethod === "now";
  const fullyPaid = isFull || candidate.isFullPaymentPaid;
  const pkz = isPkz(candidate);
  const total = candidate.finalPrice || candidate.basePrice || 1850;
  const first = firstPaymentAmount(candidate);
  const rate2 = Number(candidate.secondInstallmentAmount) || 400;
  const rate3 = thirdInstallmentAmount(candidate);

  const st = (paid, pending, open) =>
    paid
      ? { tone: "done", statusLabel: "Plaćeno" }
      : pending
      ? { tone: "wait", statusLabel: "Proveravamo" }
      : open
      ? { tone: "neutral", statusLabel: "Za uplatu" }
      : { tone: "neutral", statusLabel: "Kasnije" };

  const modelLabel =
    candidate.paymentMethod === "later"
      ? "Plati kad se vratiš (uz jemca)"
      : candidate.paymentMethod === "pkz"
      ? "PKZ — treća rata iz zarade u SAD"
      : candidate.paymentMethod === "installments"
      ? "U tri rate"
      : "U celosti";

  return (
    <div className="space-y-4">
      <Panel
        title="Plan uplata"
        description="Cene su u USD. Plaćaš u dinarima po srednjem kursu NBS na dan uplate."
        aside={
          <Button variant="outline" size="sm" onClick={() => setShowInvoicesModal(true)} className="h-8 px-3">
            <ReceiptIcon className="h-4 w-4 text-ink-3" />
            Fakture
            {candidateInvoices.length > 0 && (
              <span className="rounded-full bg-surface-2 px-1.5 text-xs tabular-nums text-ink-2">{candidateInvoices.length}</span>
            )}
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          <PaymentRow
            id="pay-rate1"
            title={isFull ? "Program u celosti" : "I rata"}
            note="Uz potpisan ugovor"
            amount={formatUsd(first)}
            {...st(isFirstInstallmentPaid, isFirstInstallmentPending, hasSignedContract)}
          >
            {!isFirstInstallmentPaid && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <LinkButton onClick={hasSignedContract ? () => toggleSlip(isFull ? "FULL" : "1") : handlePaymentSlipClick}>
                    {openSlip === (isFull ? "FULL" : "1") ? "Sakrij uplatnicu" : "Uplatnica sa IPS QR kodom"}
                  </LinkButton>
                  {hasSignedContract && !isFirstInstallmentPending && (
                    <LinkButton onClick={handleReportFirstInstallment}>Prijavi uplatu</LinkButton>
                  )}
                </div>
                {hasSignedContract && openSlip === (isFull ? "FULL" : "1") && (
                  <div className="-ml-[2.125rem]">
                    <PaymentSlip installment={isFull ? "FULL" : "1"} />
                  </div>
                )}
              </div>
            )}
          </PaymentRow>

          {!fullyPaid && (
            <PaymentRow
              id="pay-rate2"
              title="II rata"
              note="Kad potvrdiš posao (Job Offer)"
              amount={formatUsd(rate2)}
              {...st(isSecondInstallmentPaid, isSecondInstallmentPending, hasConfirmedJob)}
            >
              {!isSecondInstallmentPaid && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <LinkButton onClick={() => toggleSlip("2")}>
                      {openSlip === "2" ? "Sakrij uplatnicu" : "Uplatnica sa IPS QR kodom"}
                    </LinkButton>
                    {hasConfirmedJob && !isSecondInstallmentPending && (
                      <LinkButton onClick={handleReportSecondInstallment}>Prijavi uplatu</LinkButton>
                    )}
                  </div>
                  {openSlip === "2" && (
                    <div className="-ml-[2.125rem]">
                      <PaymentSlip installment="2" />
                    </div>
                  )}
                </div>
              )}
            </PaymentRow>
          )}

          {!fullyPaid && (
            <PaymentRow
              id="pay-rate3"
              title={pkz ? "III rata — iz zarade u SAD" : "III rata"}
              note={pkz ? "Plaća se iz prvih plata kod poslodavca" : "Pre preuzimanja pasoša sa vizom"}
              amount={formatUsd(rate3)}
              {...(pkz
                ? { tone: "neutral", statusLabel: "PKZ" }
                : st(isThirdInstallmentPaid, isThirdInstallmentPending, isSecondInstallmentPaid))}
            >
              {!pkz && !isThirdInstallmentPaid && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <LinkButton onClick={() => toggleSlip("3")}>
                      {openSlip === "3" ? "Sakrij uplatnicu" : "Uplatnica sa IPS QR kodom"}
                    </LinkButton>
                    {isSecondInstallmentPaid && !isThirdInstallmentPending && (
                      <LinkButton onClick={handleReportThirdInstallment}>Prijavi uplatu</LinkButton>
                    )}
                  </div>
                  {openSlip === "3" && (
                    <div className="-ml-[2.125rem]">
                      <PaymentSlip installment="3" />
                    </div>
                  )}
                </div>
              )}
            </PaymentRow>
          )}

          <PaymentRow
            id="pay-visa"
            title="Vizna taksa"
            note="Plaća se Ambasadi SAD, pre razgovora"
            amount={formatUsd(185)}
            {...(isReady ? { tone: "done", statusLabel: "Plaćeno" } : { tone: "neutral", statusLabel: "U Koraku 3" })}
          >
            {!isReady && (
              <a
                href="/documents/Uplatnica_viziranje.docx"
                download="Uplatnica_viziranje.docx"
                className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                Uplatnica za viznu taksu
              </a>
            )}
          </PaymentRow>
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Ugovorena cena">
          <DataList
            cols={1}
            items={[
              ["Ukupno", <span className="tabular-nums">{formatUsd(total)}</span>],
              ["Način plaćanja", modelLabel],
              ...(candidate.discount > 0 ? [["Uračunat popust", formatUsd(candidate.discount)]] : []),
              ...(candidate.guarantor
                ? [["Jemac", `${candidate.guarantor.name} (${candidate.guarantor.promissoryNotesCount} menice)`]]
                : []),
            ]}
          />
        </Panel>

        <Panel
          title="Popusti i preporuke"
          aside={<LinkButton onClick={() => setShowChangeDiscountModal(true)}>Promeni popust</LinkButton>}
        >
          <DataList
            cols={1}
            items={[
              ["Aktivna promocija", candidate.discountNote || "Nema"],
              [
                "Obračun",
                candidate.discountTiming === "end" ? "Na poslednjoj rati" : "Odmah umanjuje cenu",
              ],
              [
                "Dovedi prijatelja — 100 $",
                <span className="flex items-center gap-3 sm:justify-end">
                  <span className="tabular-nums">{candidate.referralCode || "WT-REF"}</span>
                  <LinkButton
                    onClick={() => {
                      navigator.clipboard?.writeText(candidate.referralCode || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? "Kopirano" : "Kopiraj"}
                  </LinkButton>
                </span>,
              ],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
