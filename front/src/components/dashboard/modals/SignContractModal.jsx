// front/src/components/dashboard/modals/SignContractModal.jsx
import { useState, useRef } from "react";
import {
  downloadContractPdf,
  downloadResponsibilityStatementPdf,
} from "../../../data/candidateStore";
import { CheckIcon, UploadIcon } from "../icons";
import { Button, cx } from "../../ui";
import Sheet, { SheetFooter, FormField, Hint, fieldInputCls as inp } from "../Sheet";

export default function SignContractModal({
  candidate,
  onClose,
  onUploadSignedContract,
  onUpdateCandidate,
  isUploading,
}) {
  const [passport, setPassport] = useState(candidate.passportNumber || candidate.idCardNumber || "");
  const [jmbg, setJmbg] = useState(candidate.jmbg || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const hasExisting = Boolean(candidate.signedContractFileName || candidate.contractSigned);

  const isSelf =
    String(candidate.packageId || "").toLowerCase().includes("self") ||
    String(candidate.packageName || "").toLowerCase().includes("self");

  const handleDownloadBoth = () => {
    if (jmbg || passport) {
      onUpdateCandidate?.({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
    }
    downloadContractPdf(candidate.id, candidate.email, "all", {
      jmbg: jmbg.trim(),
      passportNumber: passport.trim(),
      package: isSelf ? "self" : "full",
    });
  };

  const handleDownloadStatement = () => {
    if (jmbg || passport) {
      onUpdateCandidate?.({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
    }
    downloadResponsibilityStatementPdf(candidate.id, candidate.email, {
      jmbg: jmbg.trim(),
      passportNumber: passport.trim(),
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Izaberi fajl potpisanog ugovora (PDF ili slika).");
      return;
    }
    if (jmbg.trim() || passport.trim()) {
      onUpdateCandidate?.({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
    }
    await onUploadSignedContract(selectedFile);
  };

  const handleQuickDemoSubmit = async () => {
    if (jmbg.trim() || passport.trim()) {
      onUpdateCandidate?.({ jmbg: jmbg.trim(), passportNumber: passport.trim() });
    }
    const docUrl = isSelf ? "/documents/SELF_UGOVOR_2027.pdf" : "/documents/FULL_Lifeguard_UGOVOR_2027.pdf";
    let realFile;
    try {
      const resp = await fetch(docUrl);
      const blob = await resp.blob();
      const safeName = (candidate.lastName || "Kandidat").replace(/[^a-zA-Z0-9_-]/g, "_");
      realFile = new File([blob], `Potpisan_Ugovor_${safeName}_2027.pdf`, {
        type: "application/pdf",
      });
    } catch {
      const safeName = (candidate.lastName || "Kandidat").replace(/[^a-zA-Z0-9_-]/g, "_");
      realFile = new File([new Uint8Array([37, 80, 68, 70])], `Potpisan_Ugovor_${safeName}_2027.pdf`, {
        type: "application/pdf",
      });
    }
    await onUploadSignedContract(realFile);
  };

  const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
  const Num = ({ n }) => (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{n}</span>
  );

  return (
    <Sheet
      onClose={onClose}
      title="Potpiši ugovor"
      subtitle="Bez potpisanog ugovora uplatnica se ne otvara."
      footer={
        <SheetFooter
          left={
            <button type="button" onClick={handleQuickDemoSubmit} disabled={isUploading} className={linkCls}>
              Demo primer
            </button>
          }
        >
          <Button variant="primary" onClick={handleSubmit} disabled={isUploading || !selectedFile}>
            {isUploading ? "Kačenje…" : "Okači ugovor"}
          </Button>
        </SheetFooter>
      }
    >
      <div className="space-y-8">
        {hasExisting && (
          <Hint>
            Već si okačio <span className="font-medium text-ink">{candidate.signedContractFileName || "potpisani ugovor"}</span>
            {candidate.signedContractUploadedAt && ` (${new Date(candidate.signedContractUploadedAt).toLocaleDateString("sr-RS")})`}. Novi fajl
            zamenjuje stari.
          </Hint>
        )}

        <section className="flex gap-4">
          <Num n={1} />
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Proveri podatke</h3>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {`${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || candidate.name} · {candidate.email}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="JMBG">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  value={jmbg}
                  onChange={(e) => setJmbg(e.target.value.replace(/\D/g, ""))}
                  placeholder="13 cifara"
                  className={inp + " tabular-nums"}
                />
              </FormField>
              <FormField label="Broj pasoša">
                <input type="text" value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="010948212" className={inp + " tabular-nums"} />
              </FormField>
            </div>
          </div>
        </section>

        <section className="flex gap-4">
          <Num n={2} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Preuzmi, odštampaj i potpiši</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                Na A4 papiru, plavom ili crnom hemijskom, na mestu „Potpis kandidata“.
              </p>
            </div>
            <Button variant="dark" onClick={handleDownloadBoth} className="w-full sm:w-auto">
              Preuzmi popunjen ugovor
            </Button>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a href={isSelf ? "/documents/SELF_UGOVOR_2027.pdf" : "/documents/FULL_Lifeguard_UGOVOR_2027.pdf"} download className={linkCls}>
                Ugovor (prazan)
              </a>
              <a href="/documents/Izjava_o_odgovornosti_2027.pdf" download className={linkCls}>
                Izjava o odgovornosti
              </a>
              <a href="/documents/Saglasnost_Vazne_informacije_SWT_USA_2027.pdf" download className={linkCls}>
                Saglasnost i važne informacije
              </a>
            </div>
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
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 transition-colors",
                dragOver ? "border-ink bg-surface" : selectedFile ? "border-line-strong bg-white" : "border-line-strong hover:border-ink/40 hover:bg-surface"
              )}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg,image/jpg" onChange={handleFileChange} className="hidden" />
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", selectedFile ? "bg-ink text-white" : "bg-surface-2 text-ink-3")}>
                {selectedFile ? <CheckIcon className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{selectedFile ? selectedFile.name : "Izaberi fajl"}</span>
                <span className="block text-[13px] text-ink-3">
                  {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB · dodirni za drugi` : "ili ga prevuci ovde · do 25 MB"}
                </span>
              </span>
            </div>
            {error && <p className="text-[13px] text-red-700">{error}</p>}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
