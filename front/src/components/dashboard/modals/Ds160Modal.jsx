// front/src/components/dashboard/modals/Ds160Modal.jsx
// DS-160 upitnik. Polja, obaveznost i brojanje su u data/candidateStore/ds160.js (isto vidi i agencija).
import { useState } from "react";
import { DS160_FIELDS, DS160_STEPS, getDs160Status, ds160Date } from "../../../data/candidateStore";
import { Button } from "../../ui";
import Sheet, { SheetSteps, SheetFooter, FormField, Hint, fieldInputCls as inp } from "../Sheet";

function initialAnswers(candidate) {
  const d = candidate.ds160 || {};
  const first = candidate.firstName || (candidate.name ? candidate.name.split(" ")[0] : "");
  const last = candidate.lastName || (candidate.name ? candidate.name.split(" ").slice(1).join(" ") : "");
  const employer = candidate.selectedJobEmployer || candidate.jobEmployer;
  const city = candidate.selectedJobCity || candidate.jobCity || candidate.jobLocation;
  const housing = candidate.selectedJobHousing || candidate.jobHousing;
  return {
    lastNameAndMaiden: d.lastNameAndMaiden || last || "",
    firstName: d.firstName || first || "",
    gender: d.gender || candidate.gender || "",
    maritalStatus: d.maritalStatus || candidate.maritalStatus || "",
    dateOfBirth: d.dateOfBirth || ds160Date(candidate.birthDate || candidate.dateOfBirth),
    birthPlace: d.birthPlace || candidate.birthPlace || "",
    birthCountry: d.birthCountry || candidate.birthCountry || "Srbija",
    citizenship: d.citizenship || candidate.citizenship || "Republika Srbija",
    jmbg: d.jmbg || candidate.jmbg || "",
    ssn: d.ssn || candidate.ssn || "",
    passportNumber: d.passportNumber || candidate.passportNumber || "",
    passportCountry: d.passportCountry || candidate.passportCountry || "Republika Srbija",
    passportExpiryDate: d.passportExpiryDate || ds160Date(candidate.passportExpiryDate || candidate.passportExpiry),
    employerInfo: d.employerInfo || (employer ? `${employer} (${candidate.selectedJobTitle || candidate.jobTitle || "radna pozicija"})` : ""),
    stayAddress: d.stayAddress || (city ? `${housing ? `${housing}, ` : ""}${city}, SAD` : ""),
    // Nadređeni i telefon poslodavca dolaze iz baze poslova; ništa se ne izmišlja.
    supervisorName: d.supervisorName || "",
    employerPhone: d.employerPhone || "",
    tripFunder: d.tripFunder || "",
    // Izjave za ambasadu: kandidat odgovara sam, nema unapred upisanog „Ne".
    previousUsTravel: d.previousUsTravel || "",
    visaRefusal: d.visaRefusal || "",
    homeAddress: d.homeAddress || candidate.address || "",
    mobilePhone: d.mobilePhone || candidate.phone || "",
    primaryEmail: d.primaryEmail || candidate.email || "",
    socialMediaAccounts: d.socialMediaAccounts || "",
    highSchoolInfo: d.highSchoolInfo || "",
    university: d.university || candidate.faculty || "",
    studyProgram: d.studyProgram || candidate.studyProgram || "",
    referencePerson1: d.referencePerson1 || "",
    referencePerson2: d.referencePerson2 || "",
    emergencyContact:
      d.emergencyContact || (candidate.guarantor?.name ? `${candidate.guarantor.name}${candidate.guarantor.phone ? `, ${candidate.guarantor.phone}` : ""}` : ""),
  };
}

export default function Ds160Modal({ candidate, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [f, setF] = useState(() => initialAnswers(candidate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMissing, setShowMissing] = useState(false);

  const upd = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));
  const status = getDs160Status(f);
  const missingKeys = new Set(status.missing.map((m) => m.key));
  const missingIn = (step) => status.missing.filter((m) => m.step === step).length;

  const steps = DS160_STEPS.map((s) => {
    const n = missingIn(s.id);
    return { ...s, label: n ? `${s.label} (${n})` : s.label };
  });
  const stepIndex = DS160_STEPS.findIndex((x) => x.id === activeTab);
  const isLast = stepIndex === DS160_STEPS.length - 1;

  const save = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const res = await onSave(f);
    setBusy(false);
    if (res && !res.ok) {
      setError(res.error);
      return;
    }
    if (!status.isComplete) setShowMissing(true);
  };

  const renderField = (field) => {
    const empty = showMissing && missingKeys.has(field.key);
    const cls = empty ? `${inp} border-red-400` : inp;
    const label = (
      <>
        {field.label}
        {field.required ? (
          <span className="text-red-700" aria-hidden="true">
            {" "}*
          </span>
        ) : (
          <span className="font-normal text-ink-3"> (nije obavezno)</span>
        )}
      </>
    );
    return (
      <FormField key={field.key} label={label} hint={field.hint} className={field.wide ? "sm:col-span-2" : ""}>
        {field.options ? (
          <select value={f[field.key]} onChange={upd(field.key)} className={cls} required={false} aria-required={field.required}>
            <option value="" disabled>
              Izaberi
            </option>
            {field.options.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        ) : field.rows ? (
          <textarea rows={field.rows} value={f[field.key]} onChange={upd(field.key)} className={cls} aria-required={field.required} />
        ) : (
          <input
            value={f[field.key]}
            onChange={upd(field.key)}
            placeholder={field.placeholder}
            inputMode={field.inputMode}
            className={cls}
            aria-required={field.required}
          />
        )}
      </FormField>
    );
  };

  return (
    <Sheet
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={save}
      title="DS-160 upitnik"
      subtitle="Podaci za vizu. Proveri ih dva puta — greška može da znači odbijenu vizu."
      aside={
        <span className="text-[13px] text-ink-3">
          <span className="font-semibold tabular-nums text-ink">{status.filledCount}</span> od {status.totalCount} obaveznih
        </span>
      }
      nav={<SheetSteps steps={steps} active={activeTab} onChange={setActiveTab} />}
      footer={
        <SheetFooter
          left={
            <Button type="submit" variant="ghost" disabled={busy} className={isLast ? "hidden" : ""}>
              {busy ? "Čuvam…" : "Sačuvaj"}
            </Button>
          }
        >
          {isLast ? (
            <Button key="save" type="submit" variant="primary" disabled={busy}>
              {busy ? "Čuvam…" : status.isComplete ? "Sačuvaj upitnik" : "Sačuvaj nacrt"}
            </Button>
          ) : (
            // Poseban key: React ne sme da pretvori „Dalje" u dugme za slanje usred klika.
            <Button key="next" variant="dark" onClick={() => setActiveTab(DS160_STEPS[stepIndex + 1].id)}>
              Dalje
            </Button>
          )}
        </SheetFooter>
      }
    >
      <div className="space-y-6">
        <p className="text-[13px] text-ink-3">
          Polja sa <span className="text-red-700">*</span> su obavezna. Ako nešto ne važi za tebe (npr. nisi bio u SAD), upiši „Ne“.
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {activeTab === "us_travel" && <Hint>Podatke o poslodavcu smo upisali iz baze poslova. Uporedi ih sa svojim Job Offer-om.</Hint>}
        {activeTab === "references" && <Hint>Ambasada traži dve osobe u Srbiji koje te poznaju, a nisu ti rod.</Hint>}
        <div className="grid gap-4 sm:grid-cols-2">{DS160_FIELDS.filter((x) => x.step === activeTab).map(renderField)}</div>

        {(showMissing || isLast) && !status.isComplete && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
            <p className="font-medium">Još nedostaje ({status.missing.length}):</p>
            <ul className="mt-1.5 space-y-1">
              {DS160_STEPS.filter((s) => missingIn(s.id)).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMissing(true);
                      setActiveTab(s.id);
                    }}
                    className="text-left underline decoration-amber-400 underline-offset-4 hover:decoration-amber-900"
                  >
                    {s.label}: {status.missing.filter((m) => m.step === s.id).map((m) => m.label).join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[13px] text-ink-3">
          Radije u Word-u?{" "}
          <a
            href="/documents/UPITNIK_za_izradu_DS160_J1.docx"
            download="UPITNIK_za_izradu_DS160_J1.docx"
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Preuzmi upitnik (.docx)
          </a>
        </p>
      </div>
    </Sheet>
  );
}
