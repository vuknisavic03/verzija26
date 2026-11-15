// front/src/components/JobOfferModal.jsx
// Job Offer: podaci isključivo iz kataloga agencije (server). Ako nešto nedostaje, ponuda se ne
// može potpisati; isti podaci idu u DS-160.
import { useEffect, useState } from "react";
import Sheet, { SheetFooter, FormField, Hint, fieldInputCls as inp } from "./dashboard/Sheet";
import { Button } from "./ui";
import { acceptJobOffer, fetchJobOffer } from "../data/candidateStore";

export default function JobOfferModal(props) {
  if (!props.isOpen) return null;
  return <JobOffer {...props} />;
}

function Rows({ items }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-[13px] text-ink-3">{k}</dt>
          <dd className="text-right text-sm font-medium text-ink">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-1 text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function JobOffer({ onClose, candidate, onSigned }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [signature, setSignature] = useState(
    `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || candidate?.name || ""
  );
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await fetchJobOffer();
    if (result.ok) {
      setData(result);
      setError("");
    } else setError(result.error);
  };

  useEffect(() => {
    load();
  }, []);

  const offer = data?.offer;
  const acceptance = data?.acceptance;
  const canSign =
    data && !acceptance && data.applicationStatus === "ACCEPTED" && data.missing.length === 0 && agreed && signature.trim().length >= 3 && !busy;

  const handleSign = async (e) => {
    e?.preventDefault?.();
    if (!canSign) return;
    setBusy(true);
    const result = await acceptJobOffer(data.fingerprint, signature.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.status === 409) await load();
      return;
    }
    if (result.candidate) onSigned?.(result.candidate);
    await load();
  };

  return (
    <Sheet
      as="form"
      onSubmit={handleSign}
      onClose={onClose}
      size="lg"
      title={acceptance ? "Job Offer je potpisan" : "Job Offer"}
      subtitle={offer ? `${offer.offerNumber} · ${offer.companyName || candidate?.selectedJobEmployer || ""}` : undefined}
      footer={
        <SheetFooter>
          {acceptance ? (
            <Button variant="primary" onClick={onClose}>
              Zatvori
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!canSign}>
              {busy ? "Potpisujem…" : "Potpiši Job Offer"}
            </Button>
          )}
        </SheetFooter>
      }
    >
      {!data && !error && <div className="h-48 animate-pulse rounded-xl bg-surface" aria-label="Učitavam ponudu" />}
      {error && (
        <p role="alert" className="mb-4 text-[13px] text-red-700">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-6">
          {data.applicationStatus !== "ACCEPTED" && !acceptance && (
            <Hint>Job Offer potpisuješ kad te poslodavac izabere posle intervjua. Javićemo ti ovde i na email.</Hint>
          )}
          {data.applicationStatus === "ACCEPTED" && !acceptance && data.missing.length > 0 && (
            <Hint>
              Agencija još unosi podatke ponude ({data.missing.join(", ")}). Ponudu potpisuješ kad bude kompletna.
            </Hint>
          )}

          {offer && (
            <>
              <div className="rounded-2xl bg-ink px-5 py-5 text-white">
                <p className="text-[13px] text-white/60">{offer.companyName || "Poslodavac"}</p>
                <p className="mt-1 text-xl font-semibold leading-snug">{offer.position}</p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-white/60">Satnica</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{offer.wage || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Nedeljno</p>
                    <p className="mt-0.5 font-semibold">{offer.hoursPerWeek || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Smeštaj</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{offer.housingCost || "—"}</p>
                  </div>
                </div>
              </div>

              <Section title="Posao">
                <Rows
                  items={[
                    ["Pozicija", offer.position],
                    ["Satnica", offer.wage],
                    ["Prekovremeno", offer.overtimeWage],
                    ["Nedeljno", offer.hoursPerWeek],
                    ["Period", offer.startDate && offer.endDate ? `${formatDate(offer.startDate)} – ${formatDate(offer.endDate)}` : ""],
                    ["Isplata", offer.payFrequency],
                  ]}
                />
              </Section>
              <Section title="Smeštaj i uslovi">
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
              </Section>
              <Section title="Poslodavac">
                <Rows
                  items={[
                    ["Firma", offer.companyName],
                    ["EIN", offer.ein],
                    ["Adresa", offer.companyAddress],
                    ["Nadređeni", offer.supervisor],
                    ["Telefon", offer.phone],
                    ["Email", offer.email],
                  ]}
                />
              </Section>
            </>
          )}

          {acceptance ? (
            <Hint>
              Potpisao/la si {formatDate(acceptance.acceptedAt)} kao „{acceptance.signature}". Podaci poslodavca su upisani u tvoj
              DS-160.
            </Hint>
          ) : (
            data.applicationStatus === "ACCEPTED" &&
            data.missing.length === 0 && (
              <section className="space-y-4 border-t border-line pt-6">
                <FormField label="Potpis — ime i prezime">
                  <input value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="name" className={inp} />
                </FormField>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-line-strong px-4 py-3.5 hover:border-ink/40">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
                  <span className="text-[13px] leading-relaxed text-ink-2">{data.statement}</span>
                </label>
              </section>
            )
          )}
        </div>
      )}
    </Sheet>
  );
}
