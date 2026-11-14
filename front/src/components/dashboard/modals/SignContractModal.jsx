// front/src/components/dashboard/modals/SignContractModal.jsx
// Potpis ugovora. Glavni put: elektronsko prihvatanje u portalu (proveri podatke → pročitaj
// ugovor → potvrdi). Rezerva: odštampaj, potpiši rukom i okači sken.
// Ugovor uvek sastavlja server iz sačuvanih podataka; pregledač samo prikazuje i potvrđuje.
import { useEffect, useRef, useState } from "react";
import {
  acceptContract,
  downloadPortalContract,
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

export default function SignContractModal({ candidate, onClose, onUploadSignedContract, onSigned, isUploading }) {
  const [mode, setMode] = useState("portal"); // portal | paper
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");

  const savedPassport = candidate.passportNumber || candidate.idCardNumber || "";
  const savedJmbg = candidate.jmbg || "";
  const [passport, setPassport] = useState(savedPassport);
  const [jmbg, setJmbg] = useState(savedJmbg);
  const [savedValues, setSavedValues] = useState({ jmbg: savedJmbg, passport: savedPassport });
  const [saving, setSaving] = useState(false);

  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
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

  const dirty = jmbg.trim() !== savedValues.jmbg || passport.trim() !== savedValues.passport;
  const jmbgValid = /^\d{13}$/.test(jmbg.trim());
  const passportValid = passport.trim().length >= 5;
  const missing = preview?.missing || [];
  const detailsReady = !dirty && missing.length === 0 && Boolean(preview);
  const acceptance = preview?.acceptance || null;

  const handleSaveDetails = async () => {
    setError("");
    if (!jmbgValid) return setError("JMBG ima tačno 13 cifara.");
    if (!passportValid) return setError("Upiši broj pasoša.");
    setSaving(true);
    const result = await saveContractDetails({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
    if (!result.ok) {
      setSaving(false);
      return setError(result.error);
    }
    setSavedValues({ jmbg: jmbg.trim(), passport: passport.trim() });
    // Podaci su ušli u ugovor — ranije otvoren nacrt više ne važi.
    setOpened(false);
    setAgreed(false);
    await loadPreview();
    setSaving(false);
  };

  const handleOpenContract = async () => {
    setError("");
    setOpening(true);
    const result = await downloadPortalContract();
    setOpening(false);
    if (!result.ok) return setError(result.error);
    setOpened(true);
  };

  const handleSign = async () => {
    if (!preview?.fingerprint) return;
    setError("");
    setSigning(true);
    const result = await acceptContract(preview.fingerprint);
    if (!result.ok) {
      setSigning(false);
      if (result.status === 409) {
        // Nešto se promenilo između prikaza i potpisa: osveži i traži ponovno čitanje.
        setOpened(false);
        setAgreed(false);
        await loadPreview();
      }
      return setError(result.error);
    }
    await loadPreview();
    setSigning(false);
    if (result.candidate) onSigned?.(result.candidate);
  };

  const pickFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError("");
  };

  const handleUploadScan = async () => {
    if (!selectedFile) return setError("Izaberi fajl potpisanog ugovora (PDF ili slika).");
    if (dirty) {
      if (!jmbgValid || !passportValid) return setError("Proveri JMBG i broj pasoša.");
      const saved = await saveContractDetails({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
      if (!saved.ok) return setError(saved.error);
      setSavedValues({ jmbg: jmbg.trim(), passport: passport.trim() });
    }
    await onUploadSignedContract(selectedFile);
  };

  /* ── Već potpisano ─────────────────────────────────────────────────── */
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
            <Row label="Referenca">
              <span className="break-all tabular-nums">{acceptance.reference}</span>
            </Row>
          </dl>
          <Button variant="dark" onClick={handleOpenContract} disabled={opening} className="w-full sm:w-auto">
            {opening ? "Preuzimam…" : "Preuzmi potpisan ugovor"}
          </Button>
          {error && <p className="text-[13px] text-red-700">{error}</p>}
        </div>
      </Sheet>
    );
  }

  /* ── Potpis ───────────────────────────────────────────────────────── */
  const detailsSection = (
    <section className="flex gap-4">
      <Num n={1} done={detailsReady} />
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Proveri podatke za ugovor</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {`${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || candidate.name} · {candidate.email}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="JMBG">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={13}
              value={jmbg}
              onChange={(e) => setJmbg(e.target.value.replace(/\D/g, ""))}
              placeholder="13 cifara"
              className={inp + " tabular-nums"}
            />
          </FormField>
          <FormField label="Broj pasoša">
            <input
              type="text"
              autoComplete="off"
              value={passport}
              onChange={(e) => setPassport(e.target.value.toUpperCase())}
              placeholder="Kao u pasošu"
              className={inp + " tabular-nums"}
            />
          </FormField>
        </div>
        {dirty && (
          <Button variant="dark" onClick={handleSaveDetails} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Čuvam…" : "Sačuvaj podatke"}
          </Button>
        )}
        {!dirty && missing.length > 0 && (
          <Hint>Za ugovor još nedostaje: {missing.join(", ")}. Ako nešto ne možeš sam da uneseš, javi se agenciji.</Hint>
        )}
      </div>
    </section>
  );

  if (mode === "paper") {
    return (
      <Sheet
        onClose={onClose}
        title="Potpis na papiru"
        subtitle="Odštampaj ugovor, potpiši ga rukom i okači sken."
        footer={
          <SheetFooter
            left={
              <button type="button" onClick={() => setMode("portal")} className={linkCls}>
                Potpiši u portalu
              </button>
            }
          >
            <Button variant="primary" onClick={handleUploadScan} disabled={isUploading || !selectedFile}>
              {isUploading ? "Kačim…" : "Okači ugovor"}
            </Button>
          </SheetFooter>
        }
      >
        <div className="space-y-8">
          {candidate.signedContractFileName && (
            <Hint>
              Već si okačio <span className="font-medium text-ink">{candidate.signedContractFileName}</span>. Novi fajl zamenjuje stari.
            </Hint>
          )}
          {detailsSection}

          <section className="flex gap-4">
            <Num n={2} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Preuzmi, odštampaj i potpiši</h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                  Na A4 papiru, plavom ili crnom hemijskom, na ugovoru i na Izjavi o odgovornosti.
                </p>
              </div>
              <Button variant="dark" onClick={handleOpenContract} disabled={opening || !detailsReady} className="w-full sm:w-auto">
                {opening ? "Preuzimam…" : "Preuzmi ugovor sa mojim podacima"}
              </Button>
            </div>
          </section>

          <section className="flex gap-4">
            <Num n={3} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Uslikaj i okači</h3>
                <p className="mt-0.5 text-[13px] text-ink-3">PDF ili slika, potpis mora da se vidi.</p>
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
          {error && <p className="text-[13px] text-red-700">{error}</p>}
        </div>
      </Sheet>
    );
  }

  const canSign = detailsReady && opened && agreed && !signing;

  return (
    <Sheet
      onClose={onClose}
      title="Potpiši ugovor"
      subtitle="Potpisuješ ovde, bez štampanja. Bez potpisanog ugovora uplatnica se ne otvara."
      footer={
        <SheetFooter
          left={
            <button type="button" onClick={() => setMode("paper")} className={linkCls}>
              Radije na papiru
            </button>
          }
        >
          <Button variant="primary" onClick={handleSign} disabled={!canSign}>
            {signing ? "Potpisujem…" : "Potpiši ugovor"}
          </Button>
        </SheetFooter>
      }
    >
      <div className="space-y-8">
        {loadError && <Hint>{loadError}</Hint>}
        {detailsSection}

        <section className="flex gap-4">
          <Num n={2} done={opened && detailsReady} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Pročitaj ugovor</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                Zvaničan ugovor agencije, prilog sa tvojim podacima i Izjava o odgovornosti.
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
            <Button variant="dark" onClick={handleOpenContract} disabled={!detailsReady || opening} className="w-full sm:w-auto">
              {opening ? "Otvaram…" : opened ? "Otvori ponovo" : "Otvori ugovor (PDF)"}
            </Button>
          </div>
        </section>

        <section className="flex gap-4">
          <Num n={3} />
          <div className="min-w-0 flex-1 space-y-3">
            <h3 className="text-[15px] font-semibold text-ink">Potvrdi</h3>
            <label
              className={cx(
                "flex gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                detailsReady && opened ? "cursor-pointer border-line-strong hover:border-ink/40" : "cursor-not-allowed border-line opacity-60"
              )}
            >
              <input
                type="checkbox"
                checked={agreed}
                disabled={!detailsReady || !opened}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
              />
              <span className="text-[13px] leading-relaxed text-ink-2">
                {preview?.statement || "Potvrđujem da sam pročitao/la ugovor i da ga prihvatam."}
              </span>
            </label>
            {!opened && detailsReady && <p className="text-[13px] text-ink-3">Prvo otvori i pročitaj ugovor.</p>}
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
