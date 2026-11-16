// front/src/components/dashboard/modals/SignContractModal.jsx
// Ugovor se potpisuje svojeručno: proveri podatke → preuzmi ugovor (ili ga pošalji na mejl) →
// odštampaj, potpiši i okači. Posle otpremanja se otvara uplata, a agencija proverava ugovor.
// Ugovor uvek sastavlja server iz sačuvanih podataka; pregledač ga samo preuzima.
import { useEffect, useRef, useState } from "react";
import {
  downloadPortalContract,
  emailPortalContract,
  fetchContractPreview,
  saveContractDetails,
} from "../../../data/candidateStore";
import { CheckIcon, UploadIcon } from "../icons";
import { Button, cx } from "../../ui";
import Sheet, { SheetFooter, FormField, Hint, fieldInputCls as inp } from "../Sheet";

const linkCls =
  "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink disabled:opacity-50";

function Num({ n, done }) {
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        done ? "bg-brand text-ink" : "bg-ink text-white"
      )}
      aria-hidden="true"
    >
      {done ? <CheckIcon className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children || "—"}</dd>
    </div>
  );
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("sr-Latn-RS", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function SignContractModal({ candidate, onClose, onUploadSignedContract, isUploading }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Podaci iz registracije (očitani sa pasoša i lične karte) — kandidat ih samo proverava.
  const initial = {
    address: candidate.address || "",
    jmbg: candidate.jmbg || "",
    passport: candidate.passportNumber || "",
    phone: candidate.phone || "",
  };
  const [values, setValues] = useState(initial);
  const [savedValues, setSavedValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  const [downloaded, setDownloaded] = useState(Boolean(candidate.contractDownloaded));
  const [opening, setOpening] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [mailStatus, setMailStatus] = useState("");
  const [error, setError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadPreview = async () => {
    const result = await fetchContractPreview();
    if (!result.ok) {
      setLoadError(result.error);
      return null;
    }
    setLoadError("");
    setPreview(result);
    return result;
  };

  useEffect(() => {
    loadPreview();
  }, []);

  const set = (key) => (e) => {
    const raw = e.target.value;
    const value = key === "jmbg" ? raw.replace(/\D/g, "") : key === "passport" ? raw.toUpperCase() : raw;
    setValues((v) => ({ ...v, [key]: value }));
  };
  const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
  const dirty = Object.keys(trimmed).some((k) => trimmed[k] !== savedValues[k].trim());
  const missing = preview?.missing || [];
  const detailsReady = !dirty && missing.length === 0 && Boolean(preview);
  const acceptance = preview?.acceptance || null;
  const fullName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || candidate.name;
  const rejected = candidate.contractVerificationStatus === "rejected";

  const validate = () => {
    if (!/^\d{13}$/.test(trimmed.jmbg)) return "JMBG ima tačno 13 cifara.";
    if (trimmed.passport.length < 5) return "Upiši broj pasoša.";
    if (trimmed.address.length < 5) return "Upiši adresu prebivališta (ulica i broj, mesto).";
    if (trimmed.phone.replace(/\D/g, "").length < 6) return "Upiši broj telefona.";
    return "";
  };

  const saveDetails = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return false;
    }
    setSaving(true);
    const result = await saveContractDetails({
      address: trimmed.address,
      jmbg: trimmed.jmbg,
      passportNumber: trimmed.passport,
      phone: trimmed.phone,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return false;
    }
    setSavedValues(trimmed);
    // Podaci su ušli u ugovor — ranije preuzet primerak više ne važi.
    setDownloaded(false);
    setMailStatus("");
    await loadPreview();
    setSaving(false);
    return true;
  };

  const handleSaveDetails = async () => {
    setError("");
    await saveDetails();
  };

  const handleDownload = async () => {
    setError("");
    setOpening(true);
    const result = await downloadPortalContract();
    setOpening(false);
    if (!result.ok) return setError(result.error);
    setDownloaded(true);
  };

  const handleEmail = async () => {
    setError("");
    setMailStatus("");
    setMailing(true);
    const result = await emailPortalContract();
    setMailing(false);
    if (!result.ok) return setError(result.error);
    setDownloaded(true);
    setMailStatus(result.message);
  };

  const pickFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("Fajl može imati najviše 10 MB.");
    setSelectedFile(file);
    setError("");
  };

  const handleUpload = async () => {
    setError("");
    if (!selectedFile) return setError("Izaberi fajl potpisanog ugovora (PDF ili slika).");
    if (dirty && !(await saveDetails())) return;
    const result = await onUploadSignedContract(selectedFile);
    if (result && !result.ok && result.error) setError(result.error);
  };

  /* ── Ugovor prihvaćen ranije u portalu (stari elektronski potpis) ───── */
  if (acceptance) {
    return (
      <Sheet
        onClose={onClose}
        title="Ugovor je potpisan"
        subtitle="Agencija ga pregleda, pa ti se otvara uplatnica."
        footer={
          <SheetFooter>
            <Button variant="primary" onClick={onClose}>
              Zatvori
            </Button>
          </SheetFooter>
        }
      >
        <div className="space-y-6">
          <dl className="divide-y divide-line">
            <Row label="Broj ugovora">{acceptance.contractNumber || preview.contractNumber}</Row>
            <Row label="Potpisano">{formatDateTime(acceptance.acceptedAt)}</Row>
          </dl>
          <Button variant="dark" onClick={handleDownload} disabled={opening} className="w-full sm:w-auto">
            {opening ? "Preuzimam…" : "Preuzmi potpisan ugovor"}
          </Button>
          {error && <p className="text-[13px] text-red-700">{error}</p>}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      onClose={onClose}
      title="Ugovor"
      subtitle="Preuzmi ugovor sa svojim podacima, potpiši ga rukom i okači. Posle toga ti se otvara uplata."
      footer={
        <SheetFooter>
          <Button variant="primary" onClick={handleUpload} disabled={isUploading || saving || !selectedFile}>
            {isUploading ? "Kačim…" : "Okači potpisan ugovor"}
          </Button>
        </SheetFooter>
      }
    >
      <div className="space-y-8">
        {loadError && <Hint>{loadError}</Hint>}
        {rejected && (
          <Hint>
            Agencija je vratila ugovor{candidate.contractRejectionReason ? `: ${candidate.contractRejectionReason}` : "."} Okači
            ispravno potpisan ugovor.
          </Hint>
        )}
        {!rejected && candidate.signedContractFileName && (
          <Hint>
            Već si okačio <span className="font-medium text-ink">{candidate.signedContractFileName}</span> i agencija ga
            proverava. Novi fajl zamenjuje stari.
          </Hint>
        )}

        <section className="flex gap-4">
          <Num n={1} done={detailsReady} />
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Proveri podatke za ugovor</h3>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {fullName} · {candidate.email}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
                Upisani su sa pasoša i lične karte. Ovi podaci se štampaju u ugovoru.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="JMBG">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={13}
                  value={values.jmbg}
                  onChange={set("jmbg")}
                  placeholder="13 cifara"
                  className={inp + " tabular-nums"}
                />
              </FormField>
              <FormField label="Broj pasoša">
                <input
                  type="text"
                  autoComplete="off"
                  value={values.passport}
                  onChange={set("passport")}
                  placeholder="Kao u pasošu"
                  className={inp + " tabular-nums"}
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Adresa prebivališta">
                  <input
                    type="text"
                    autoComplete="street-address"
                    value={values.address}
                    onChange={set("address")}
                    placeholder="Ulica i broj, mesto"
                    className={inp}
                  />
                </FormField>
              </div>
              <FormField label="Telefon">
                <input
                  type="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={set("phone")}
                  placeholder="06x xxx xxxx"
                  className={inp + " tabular-nums"}
                />
              </FormField>
            </div>
            {dirty && (
              <Button variant="dark" onClick={handleSaveDetails} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Čuvam…" : "Sačuvaj podatke"}
              </Button>
            )}
            {!dirty && preview && missing.length > 0 && (
              <Hint>Za ugovor još nedostaje: {missing.join(", ")}. Ako nešto ne možeš sam da uneseš, javi se agenciji.</Hint>
            )}
          </div>
        </section>

        <section className="flex gap-4">
          <Num n={2} done={downloaded && detailsReady} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Preuzmi i potpiši ugovor</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                Zvaničan ugovor, prilog sa tvojim podacima i Izjava o odgovornosti. Odštampaj na A4 i potpiši plavom ili
                crnom hemijskom na označenim mestima.
              </p>
            </div>
            {preview && (
              <dl className="divide-y divide-line rounded-xl bg-surface px-4">
                <Row label="Broj ugovora">{preview.contractNumber}</Row>
                <Row label="Program">{preview.facts?.programLabel}</Row>
                <Row label="Plaćanje">{preview.facts?.optionLabel}</Row>
                <Row label="Cena">{preview.facts?.priceLabel}</Row>
              </dl>
            )}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="dark" onClick={handleDownload} disabled={!detailsReady || opening} className="w-full sm:w-auto">
                {opening ? "Preuzimam…" : "Preuzmi ugovor (PDF)"}
              </Button>
              <Button variant="outline" onClick={handleEmail} disabled={!detailsReady || mailing} className="w-full sm:w-auto">
                {mailing ? "Šaljem…" : "Pošalji mi na mejl"}
              </Button>
            </div>
            {mailStatus && (
              <p role="status" className="text-[13px] text-ink-2">
                {mailStatus}
              </p>
            )}
          </div>
        </section>

        <section className="flex gap-4">
          <Num n={3} done={Boolean(selectedFile)} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Okači potpisan ugovor</h3>
              <p className="mt-0.5 text-[13px] text-ink-3">Sken ili fotografija svih strana, PDF ili slika. Potpis mora da se vidi.</p>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 transition-colors",
                dragOver ? "border-ink bg-surface" : selectedFile ? "border-line-strong bg-white" : "border-line-strong hover:border-ink/40 hover:bg-surface"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={(e) => pickFile(e.target.files?.[0])}
                className="hidden"
              />
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", selectedFile ? "bg-ink text-white" : "bg-surface-2 text-ink-3")}>
                {selectedFile ? <CheckIcon className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{selectedFile ? selectedFile.name : "Izaberi fajl"}</span>
                <span className="block text-[13px] text-ink-3">
                  {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB · dodirni za drugi` : "ili ga prevuci ovde · do 10 MB"}
                </span>
              </span>
            </div>
          </div>
        </section>

        <section className="flex gap-4">
          <Num n={4} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink">Uplata</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
              Čim okačiš potpisan ugovor, otvara ti se uplatnica. Agencija u međuvremenu proverava ugovor.
            </p>
          </div>
        </section>

        {error && (
          <p role="alert" className="text-[13px] text-red-700">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
