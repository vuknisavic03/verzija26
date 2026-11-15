// front/src/components/dashboard/PaymentSlip.jsx
// Uplatnica za jednu ratu: podatke sastavlja server (iznos u USD, procena u RSD po današnjem
// srednjem kursu NBS, račun iz potpisanog ugovora, model 97, NBS IPS QR kod).
import { useEffect, useState } from "react";
import { fetchPaymentInstructions, formatRsdAmount, formatUsd, paymentSlipPdfUrl } from "../../data/candidateStore";

function Field({ label, value, mono = false, wide = false }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-ink ${mono ? "tabular-nums tracking-wide" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

export default function PaymentSlip({ installment }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    fetchPaymentInstructions(installment).then((result) => {
      if (!active) return;
      if (result.ok) setData(result);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [installment]);

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* kopiranje nije dostupno */
    }
  };

  if (error) return <p className="rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-2">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-surface" aria-label="Učitavam uplatnicu" />;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="grid gap-5 md:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Primalac" value={`${data.recipientName}, ${data.recipientAddress}`} wide />
          <div className="col-span-2">
            <dt className="text-xs text-ink-3">Račun primaoca · {data.bank}</dt>
            <dd className="mt-0.5 flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums tracking-wide text-ink">{data.recipientAccount}</span>
              <button
                type="button"
                onClick={() => copy("account", data.recipientAccount)}
                className="text-[13px] font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {copied === "account" ? "Kopirano" : "Kopiraj"}
              </button>
            </dd>
          </div>
          <Field label="Šifra plaćanja" value={data.paymentCode} mono />
          <Field label="Model" value={data.model} mono />
          <div className="col-span-2">
            <dt className="text-xs text-ink-3">Poziv na broj</dt>
            <dd className="mt-0.5 flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums tracking-wide text-ink">{data.reference}</span>
              <button
                type="button"
                onClick={() => copy("ref", data.reference)}
                className="text-[13px] font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {copied === "ref" ? "Kopirano" : "Kopiraj"}
              </button>
            </dd>
          </div>
          <Field label="Svrha" value={data.purpose} wide />
          <div className="col-span-2 border-t border-line pt-3">
            <dt className="text-xs text-ink-3">Iznos</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {data.amountRsd ? formatRsdAmount(data.amountRsd) : formatUsd(data.amountUsd)}
            </dd>
            <dd className="mt-0.5 text-xs leading-relaxed text-ink-3">
              {data.amountRsd
                ? `${formatUsd(data.amountUsd)} × ${Number(data.rate).toFixed(4)} (srednji kurs NBS danas). Ako plaćaš drugog dana, iznos u dinarima je po kursu tog dana.`
                : `Uplati ${formatUsd(data.amountUsd)} preračunato u dinare po srednjem kursu NBS na dan uplate.`}
            </dd>
          </div>
        </dl>

        {data.qrSvg && (
          <div className="flex flex-row items-center gap-4 md:flex-col">
            <div
              className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="NBS IPS QR kod za uplatu"
              // SVG pravi naš server (biblioteka qrcode), bez korisničkog unosa.
              dangerouslySetInnerHTML={{ __html: data.qrSvg }}
            />
            <p className="max-w-40 text-xs leading-relaxed text-ink-3 md:text-center">
              U m-bankingu izaberi „IPS skeniraj". Podaci se popune sami.
            </p>
          </div>
        )}
      </div>
      {data.amountRsd && (
        <a
          href={paymentSlipPdfUrl(installment)}
          className="mt-4 inline-block text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Preuzmi uplatnicu (PDF)
        </a>
      )}
    </div>
  );
}
