import { useState } from "react";
import { Button } from "./ui";
import Sheet, { SheetSection, SheetFooter, FormField, fieldInputCls as inp } from "./dashboard/Sheet";

export default function JobOfferModal(props) {
  if (!props.isOpen) return null;
  return <JobOffer {...props} />;
}

function Rows({ items }) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="shrink-0 text-[13px] text-ink-3">{k}</dt>
          <dd className="text-sm text-ink sm:text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function JobOffer({ onClose, candidate, jobOfferDetails, onAccept, onAcceptOffer }) {

  const defaultOffer = {
    offerNumber: candidate?.selectedJobOfferNumber || "JO-2026-CA-0842",
    companyName: candidate?.selectedJobEmployer || "Tahoe Pines Lodge & Resort LLC",
    ein: candidate?.selectedJobEin || "88-4298103",
    companyAddress: candidate?.selectedJobCity ? `${candidate.selectedJobCity}, USA` : "4082 Lake Tahoe Blvd, South Lake Tahoe, CA 96150",
    supervisor: "Mark Stevens, General Manager",
    phone: "+1 (530) 542-8800",
    email: "hr@tahoepineslodge.com",
    position: candidate?.selectedJobTitle || candidate?.preferences?.position || "Sobarica / Housekeeping Staff",
    wage: candidate?.selectedJobWage || "$17.50 / hour",
    overtimeWage: "$26.25 / hour (after 40 hours)",
    hoursPerWeek: "35–40 hours per week",
    payFrequency: "Bi-weekly (svake 2 nedelje direct deposit)",
    startDate: "2026-06-05",
    endDate: "2026-09-30",
    housingAddress: "Pines Employee Village, 112 Pines Way, South Lake Tahoe",
    housingCost: "$110.00 / week (odbitak od zarade)",
    housingDeposit: "$150.00 (povratan depozit)",
    mealPlan: "1 besplatan topli obrok po smeni u restoranu hotela",
    transportation: "Besplatan autobuski prevoz za zaposlene do radnog mesta (10 min)",
    uniformRequired: "Obezbeđuje poslodavac (2 majice i pregača)",
    signedAt: candidate?.jobOfferSignedAt || null,
    signature: candidate?.jobOfferSignature || "",
  };

  const offer = { ...defaultOffer, ...(jobOfferDetails || {}) };
  const isAlreadySigned = Boolean(candidate?.hasJob || offer.signedAt);

  const [signatureText, setSignatureText] = useState(
    isAlreadySigned ? offer.signature || candidate?.name || "" : candidate?.name || ""
  );
  const [agreedTerms, setAgreedTerms] = useState(isAlreadySigned);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSign = (e) => {
    e.preventDefault();
    if (!agreedTerms || !signatureText.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      const acceptFn = onAccept || onAcceptOffer || (() => {});
      acceptFn({
        ...offer,
        signedAt: new Date().toISOString(),
        signature: signatureText.trim(),
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <Sheet
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={handleSign}
      title="Job Offer"
      subtitle={`${offer.offerNumber} · ${offer.companyName}`}
      aside={
        <span className={isAlreadySigned ? "text-[13px] text-emerald-700" : "text-[13px] text-ink-3"}>
          {isAlreadySigned ? "Potpisan" : "Čeka potpis"}
        </span>
      }
      footer={
        <SheetFooter
          left={
            <Button variant="ghost" onClick={() => window.print()} className="max-sm:hidden">
              Štampaj
            </Button>
          }
        >
          {isAlreadySigned ? (
            <Button variant="outline" onClick={onClose}>
              Zatvori
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={isSubmitting || !agreedTerms || !signatureText.trim()}>
              {isSubmitting ? "Potpisujem…" : "Potpiši i prihvati"}
            </Button>
          )}
        </SheetFooter>
      }
    >
      <div className="space-y-8">
        {/* Ukratko */}
        <div className="rounded-2xl bg-ink px-5 py-5 text-white">
          <p className="text-[13px] text-white/60">{offer.companyName}</p>
          <p className="mt-1 text-xl font-semibold leading-snug">{offer.position}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-4 text-sm">
            <div>
              <p className="text-xs text-white/55">Satnica</p>
              <p className="mt-0.5 font-semibold tabular-nums">{offer.wage}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Sati</p>
              <p className="mt-0.5 font-semibold">{offer.hoursPerWeek}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Smeštaj</p>
              <p className="mt-0.5 font-semibold tabular-nums">{offer.housingCost}</p>
            </div>
          </div>
        </div>

        <SheetSection title="Posao">
          <Rows
            items={[
              ["Pozicija", offer.position],
              ["Satnica", offer.wage],
              ["Prekovremeno", offer.overtimeWage],
              ["Nedeljno", offer.hoursPerWeek],
              ["Period", `${offer.startDate} – ${offer.endDate}`],
              ["Isplata", offer.payFrequency],
            ]}
          />
        </SheetSection>

        <SheetSection title="Smeštaj i pogodnosti">
          <Rows
            items={[
              ["Adresa", offer.housingAddress],
              ["Cena", offer.housingCost],
              ["Depozit", offer.housingDeposit],
              ["Hrana", offer.mealPlan],
              ["Prevoz", offer.transportation],
              ["Uniforma", offer.uniformRequired],
            ]}
          />
        </SheetSection>

        <SheetSection title="Poslodavac">
          <Rows
            items={[
              ["Firma", offer.companyName],
              ["Adresa", offer.companyAddress],
              ["EIN", offer.ein],
              ["Kontakt", `${offer.supervisor}, ${offer.phone}`],
              ["E-mail", offer.email],
            ]}
          />
        </SheetSection>

        <SheetSection title="Ti">
          <Rows
            items={[
              ["Ime", candidate?.name || `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || "Kandidat"],
              ["Fakultet", candidate?.faculty || "Univerzitet u Beogradu"],
              ["Pasoš", candidate?.passportNumber || "014298751"],
              ["Kontakt", [candidate?.email, candidate?.phone].filter(Boolean).join(" · ")],
            ]}
          />
        </SheetSection>

        <SheetSection title="Obaveze">
          <p className="text-sm leading-relaxed text-ink-2">
            Javljaš se poslodavcu na dan početka rada, savesno radiš i poštuješ pravila kompanije i zakone SAD. Kad prihvatiš ponudu,
            sledi uplata II rate i izrada DS-2019 kod sponzora.
          </p>
        </SheetSection>

        <SheetSection title="Potpis">
          {isAlreadySigned ? (
            <div className="rounded-xl border border-line px-4 py-4">
              <p className="font-serif text-xl italic text-ink">{offer.signature || candidate?.name}</p>
              <p className="mt-1 text-[13px] text-ink-3">
                {new Date(offer.signedAt || Date.now()).toLocaleDateString("sr-RS")} · ID SHA256-JO-{String(candidate?.id || "928174").slice(-6)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <FormField label="Ime i prezime kao potpis">
                <input
                  type="text"
                  required
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  placeholder="Ime Prezime"
                  className={inp + " font-serif text-lg italic"}
                />
              </FormField>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
                <input
                  type="checkbox"
                  required
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-neutral-900"
                />
                <span>Pročitao sam uslove — posao, satnicu, smeštaj i obaveze — i prihvatam ih.</span>
              </label>
            </div>
          )}
        </SheetSection>
      </div>
    </Sheet>
  );
}
