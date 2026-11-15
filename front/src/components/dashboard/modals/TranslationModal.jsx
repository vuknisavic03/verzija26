// front/src/components/dashboard/modals/TranslationModal.jsx
// Prevod uverenja o studiranju i MUP uverenja na engleski.
// Prevod pravi server iz otpremljenog originala (AI); kandidat ga proverava uz original i
// potvrđuje, a agencija ga odobrava. Umesto AI prevoda može da se okači overen prevod sudskog tumača.
import { useRef, useState } from "react";
import { Button, cx } from "../../ui";
import Sheet, { SheetTabs, SheetFooter } from "../Sheet";
import { Notice, LinkButton } from "../ui";
import {
  getTranslation,
  translationState,
  translationPdfUrl,
  requestTranslation,
  confirmTranslation,
  uploadCertifiedTranslation,
  TRANSLATION_STATUS_LABEL,
  ORIGINAL_URL_FIELD,
  ORIGINAL_FILE_FIELD,
} from "../../../data/candidateStore";

const DOC_LABEL = { faculty: "Uverenje o studiranju", police: "MUP uverenje" };

/** Prevod kako ga je vratio server — isti prikaz za kandidata i agenciju. */
export function TranslationDocument({ data, className = "" }) {
  if (!data) return null;
  const meta = [
    ["Reference number", data.referenceNumber],
    ["Date of issue", data.issueDate],
    ["Person", data.personName],
  ].filter(([, v]) => v);
  return (
    <article
      lang="en"
      className={cx(
        "rounded-xl border border-line bg-[#fcfbf9] px-5 py-6 font-serif text-[14px] leading-relaxed text-ink sm:px-8 sm:py-8",
        className
      )}
    >
      <header>
        <p className="font-sans text-[11px] text-ink-3">English translation</p>
        <h3 className="mt-1 font-sans text-[17px] font-semibold leading-snug text-ink">{data.titleEn || "Document"}</h3>
        {data.issuerEn && <p className="mt-1 text-ink-2">{data.issuerEn}</p>}
      </header>
      {meta.length > 0 && <Rows rows={meta} className="mt-5" />}
      {data.sections?.map((section, i) => (
        <section key={i} className="mt-5 border-t border-line pt-4">
          {section.headingEn && <h4 className="mb-2 font-sans text-[13px] font-semibold text-ink">{section.headingEn}</h4>}
          {section.fields?.length > 0 && <Rows rows={section.fields.map((f) => [f.labelEn, f.valueEn])} />}
          {section.paragraphsEn?.map((p, j) => (
            <p key={j} className="mt-2.5 whitespace-pre-line">
              {p}
            </p>
          ))}
        </section>
      ))}
      {data.stampsAndSignatures?.length > 0 && (
        <footer className="mt-5 space-y-1 border-t border-line pt-3 text-[13px] italic text-ink-2">
          {data.stampsAndSignatures.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </footer>
      )}
    </article>
  );
}

function Rows({ rows, className = "" }) {
  return (
    <dl className={cx("space-y-2", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="grid gap-0.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="font-sans text-xs text-ink-3 sm:text-[13px]">{k}</dt>
          <dd className="break-words">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TranslationWarnings({ warnings, title = "Proveri posebno" }) {
  if (!warnings?.length) return null;
  return (
    <Notice tone="wait" title={title}>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </Notice>
  );
}

export default function TranslationModal({
  isOpen,
  onClose,
  activeTranslationDoc,
  setActiveTranslationDoc,
  candidate,
  onCandidate,
  pickOriginal,
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);

  if (!isOpen) return null;
  const doc = activeTranslationDoc === "police" ? "police" : "faculty";
  const state = translationState(candidate, doc);
  const t = getTranslation(candidate, doc);
  const originalUrl = candidate?.[ORIGINAL_URL_FIELD[doc]];
  const originalName = candidate?.[ORIGINAL_FILE_FIELD[doc]];
  const uploaded = t?.source === "uploaded";

  const switchDoc = (next) => {
    if (busy) return;
    setActiveTranslationDoc(next);
    setChecked(false);
    setNote("");
    setError("");
  };

  const run = async (kind, action) => {
    setBusy(kind);
    setError("");
    const res = await action();
    setBusy("");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setChecked(false);
    setNote("");
    if (res.candidate) onCandidate?.(res.candidate);
  };

  const translate = () => run("translate", () => requestTranslation(doc));
  const confirm = () => run("confirm", () => confirmTranslation(doc, note));
  const onCertified = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run("upload", () => uploadCertifiedTranslation(doc, file));
  };

  const tabs = ["faculty", "police"].map((id) => ({
    id,
    label: `${DOC_LABEL[id]} · ${TRANSLATION_STATUS_LABEL[translationState(candidate, id)]}`,
  }));

  const pdfLabel = state === "approved" ? "Preuzmi prevod (PDF)" : uploaded ? "Otvori prevod" : "Preuzmi nacrt (PDF)";
  const canRetranslate = state === "review" || state === "rejected" || (state === "confirmed" && !uploaded);

  let footer;
  if (state === "missing") {
    footer = (
      <Button variant="dark" onClick={() => { onClose(); pickOriginal?.(doc); }}>
        Okači original
      </Button>
    );
  } else if (state === "needed") {
    footer = (
      <>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
          Imam overen prevod
        </Button>
        <Button variant="primary" onClick={translate} disabled={Boolean(busy)}>
          {busy === "translate" ? "Prevodim…" : "Prevedi na engleski"}
        </Button>
      </>
    );
  } else if (state === "review") {
    footer = (
      <>
        <Button variant="ghost" onClick={translate} disabled={Boolean(busy)}>
          {busy === "translate" ? "Prevodim…" : "Prevedi ponovo"}
        </Button>
        <Button variant="primary" onClick={confirm} disabled={!checked || Boolean(busy)}>
          {busy === "confirm" ? "Čuvam…" : "Potvrdi prevod"}
        </Button>
      </>
    );
  } else if (state === "rejected") {
    footer = (
      <>
        <Button variant="ghost" onClick={() => { onClose(); pickOriginal?.(doc); }} disabled={Boolean(busy)}>
          Okači novi original
        </Button>
        {!uploaded ? (
          <Button variant="primary" onClick={translate} disabled={Boolean(busy)}>
            {busy === "translate" ? "Prevodim…" : "Prevedi ponovo"}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            Okači novi prevod
          </Button>
        )}
      </>
    );
  } else {
    footer = (
      <Button variant="dark" href={translationPdfUrl(doc)} target="_blank" rel="noreferrer">
        {pdfLabel}
      </Button>
    );
  }

  return (
    <Sheet
      onClose={busy ? undefined : onClose}
      size="lg"
      title="Prevod na engleski"
      subtitle={DOC_LABEL[doc]}
      nav={<SheetTabs tabs={tabs} active={doc} onChange={switchDoc} />}
      footer={
        <SheetFooter left={<Button variant="ghost" onClick={onClose} disabled={Boolean(busy)} className="max-sm:hidden">Zatvori</Button>}>
          {footer}
        </SheetFooter>
      }
    >
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onCertified} />
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}

        {state === "missing" && (
          <p className="text-sm leading-relaxed text-ink-2">
            Prvo okači original. Prevod pravimo tačno iz fajla koji okačiš.
          </p>
        )}

        {state === "needed" && busy !== "translate" && (
          <div className="space-y-3 text-sm leading-relaxed text-ink-2">
            <p>
              Prevod pravimo iz fajla <span className="font-medium text-ink">{originalName}</span>. AI pročita original i
              prevede ga reč po reč, a ti posle proveriš da li se imena, datumi i brojevi slažu. Na kraju ga proverava i
              agencija.
            </p>
            <p>
              Ovo nije overen prevod sudskog tumača. Ako ti sponzor ili ambasada traže overen prevod, okači ga preko
              „Imam overen prevod".
            </p>
          </div>
        )}

        {busy === "translate" && (
          <Notice tone="neutral" title="Prevodim…">
            Obično traje između 20 sekundi i jednog minuta. Ne zatvaraj prozor.
          </Notice>
        )}

        {busy === "upload" && <Notice tone="neutral">Kačim prevod…</Notice>}

        {state === "rejected" && (
          <Notice tone="danger" title="Agencija je vratila prevod">
            {t?.rejectionReason || "Proveri original i napravi novi prevod."}
          </Notice>
        )}
        {state === "confirmed" && (
          <Notice tone="wait" title="Potvrđeno, čeka agenciju">
            Agencija upoređuje prevod sa originalom. Javićemo ti ako nešto treba da se ispravi.
          </Notice>
        )}
        {state === "approved" && (
          <Notice tone="done" title="Prevod je odobren">
            Ovaj prevod ide sponzoru uz original.
          </Notice>
        )}

        {t && !uploaded && busy !== "translate" && (
          <>
            {state === "review" && <TranslationWarnings warnings={t.warnings} />}
            <TranslationDocument data={t.data} />
            <p className="text-xs leading-relaxed text-ink-3">
              Prevod uz pomoć AI-ja, napravljen iz originala{originalUrl ? " " : "."}
              {originalUrl && (
                <a href={originalUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
                  {originalName || "otvori original"}
                </a>
              )}
              {originalUrl && "."} Nije overen prevod sudskog tumača.
            </p>
          </>
        )}

        {t && uploaded && (
          <p className="text-sm leading-relaxed text-ink-2">
            Okačen je overen prevod <span className="font-medium text-ink">{t.uploadedFileName}</span>.
          </p>
        )}

        {state === "review" && !uploaded && busy !== "translate" && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
              />
              <span>
                Uporedio sam prevod sa originalom: ime i prezime, datumi, brojevi i naziv ustanove se slažu.
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-ink-3">Napomena za agenciju (ako nešto nije u redu)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={2}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
              />
            </label>
          </div>
        )}

        {canRetranslate && state === "confirmed" && (
          <LinkButton onClick={translate} disabled={Boolean(busy)}>
            Nešto nije dobro? Napravi novi prevod
          </LinkButton>
        )}
      </div>
    </Sheet>
  );
}
