// front/src/components/admin/TranslationReview.jsx
// Agencija proverava prevod uverenja uz original: ispravlja tekst, odobrava ili vraća kandidatu.
// Odobren AI prevod dobija konačni PDF (sa datumom provere); dosije se odobrava tek kad su oba prevoda odobrena.
import { useEffect, useState } from "react";
import { Button } from "../ui";
import { FIELD_CLS } from "./ui";
import { TranslationDocument, TranslationWarnings } from "../dashboard/modals/TranslationModal";
import {
  getTranslation,
  translationState,
  translationPdfUrl,
  requestTranslation,
  reviewTranslation,
  TRANSLATION_STATUS_LABEL,
} from "../../data/candidateStore";

const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const smallLabel = "block text-xs text-ink-3";

function clone(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function Editor({ data, onChange }) {
  const set = (patch) => onChange({ ...data, ...patch });
  const setSection = (i, patch) =>
    set({ sections: data.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-4 rounded-xl border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["titleEn", "Naslov"],
          ["issuerEn", "Izdavalac"],
          ["referenceNumber", "Broj dokumenta"],
          ["issueDate", "Datum izdavanja"],
          ["personName", "Osoba"],
        ].map(([key, label]) => (
          <label key={key} className={key === "issuerEn" ? "sm:col-span-2" : ""}>
            <span className={smallLabel}>{label}</span>
            <input className={`${FIELD_CLS} mt-1`} value={data[key] || ""} onChange={(e) => set({ [key]: e.target.value })} />
          </label>
        ))}
      </div>
      {data.sections.map((section, i) => (
        <div key={i} className="space-y-2 border-t border-line pt-3">
          <label className="block">
            <span className={smallLabel}>Naslov dela {i + 1}</span>
            <input
              className={`${FIELD_CLS} mt-1`}
              value={section.headingEn}
              onChange={(e) => setSection(i, { headingEn: e.target.value })}
            />
          </label>
          {section.fields.map((field, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <input
                aria-label="Polje"
                className={FIELD_CLS}
                value={field.labelEn}
                onChange={(e) =>
                  setSection(i, { fields: section.fields.map((f, n) => (n === k ? { ...f, labelEn: e.target.value } : f)) })
                }
              />
              <input
                aria-label="Vrednost"
                className={FIELD_CLS}
                value={field.valueEn}
                onChange={(e) =>
                  setSection(i, { fields: section.fields.map((f, n) => (n === k ? { ...f, valueEn: e.target.value } : f)) })
                }
              />
            </div>
          ))}
          {section.paragraphsEn.map((p, k) => (
            <textarea
              key={k}
              aria-label="Tekst"
              rows={3}
              className={FIELD_CLS}
              value={p}
              onChange={(e) =>
                setSection(i, { paragraphsEn: section.paragraphsEn.map((x, n) => (n === k ? e.target.value : x)) })
              }
            />
          ))}
        </div>
      ))}
      <label className="block border-t border-line pt-3">
        <span className={smallLabel}>Pečati i potpisi (jedan po redu)</span>
        <textarea
          rows={3}
          className={`${FIELD_CLS} mt-1`}
          value={(data.stampsAndSignatures || []).join("\n")}
          onChange={(e) => set({ stampsAndSignatures: e.target.value.split("\n") })}
        />
      </label>
    </div>
  );
}

export default function TranslationReview({ candidate, doc, onCandidate, showToast }) {
  const email = candidate?.email;
  const state = translationState(candidate, doc);
  const t = getTranslation(candidate, doc);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setRejecting(false);
    setReason("");
  }, [t?.createdAt, t?.status]);

  if (state === "missing") return null;

  const run = async (kind, action, done) => {
    setBusy(kind);
    setError("");
    const res = await action();
    setBusy("");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.candidate) onCandidate(res.candidate);
    if (done) showToast?.(done);
  };

  const cleanDraft = () =>
    draft && { ...draft, stampsAndSignatures: (draft.stampsAndSignatures || []).map((s) => s.trim()).filter(Boolean) };

  const translate = () => run("translate", () => requestTranslation(doc, email), "Prevod je napravljen. Proveri ga uz original.");
  const save = () =>
    run("save", () => reviewTranslation({ email, doc, action: "save", data: cleanDraft() }), "Izmene prevoda su sačuvane.");
  const approve = () =>
    run(
      "approve",
      () => reviewTranslation({ email, doc, action: "approve", ...(editing ? { data: cleanDraft() } : {}) }),
      "Prevod je odobren. Konačni PDF je sačuvan."
    );
  const reject = () =>
    run(
      "reject",
      () => reviewTranslation({ email, doc, action: "reject", reason }),
      "Prevod je vraćen kandidatu sa obrazloženjem."
    );

  const waive = () =>
    run("waive", () => reviewTranslation({ email, doc, action: "waive" }), "Uverenje je odobreno bez prevoda.");
  const requireTranslation = () =>
    run(
      "require",
      () => reviewTranslation({ email, doc, action: "requireTranslation" }),
      "Oznaka je skinuta: za ovo uverenje treba prevod."
    );

  const ai = t?.source === "ai";
  const tone =
    state === "approved" || state === "waived" ? "text-emerald-700" : state === "rejected" ? "text-red-700" : state === "needed" ? "text-ink-3" : "text-amber-700";

  return (
    <div className="basis-full space-y-3 rounded-xl bg-surface/60 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">
          Prevod na engleski
          {t && <span className="font-normal text-ink-3"> · {ai ? "AI prevod" : `overen prevod (${t.uploadedFileName})`}</span>}
        </p>
        <span className={`text-[13px] ${tone}`}>
          {state === "review" ? "Kandidat još nije potvrdio" : TRANSLATION_STATUS_LABEL[state]}
        </span>
      </div>

      {error && <p className="text-[13px] text-red-700">{error}</p>}

      {/* Uverenje već na engleskom (ili dvojezično): odobrava se bez prevoda. */}
      {state === "waived" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-ink-2">Uverenje je odobreno bez prevoda.</p>
          <button type="button" className={linkCls} onClick={requireTranslation} disabled={Boolean(busy)}>
            {busy === "require" ? "Menjam…" : "Ipak traži prevod"}
          </button>
        </div>
      )}
      {state === "declared" && (
        <p className="text-[13px] text-ink-2">Kandidat kaže da je uverenje već na engleskom. Proveri original, pa odobri bez prevoda ili traži prevod.</p>
      )}
      {(state === "needed" || state === "declared" || state === "review" || state === "confirmed" || state === "rejected") && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant={state === "declared" ? "dark" : "outline"} onClick={waive} disabled={Boolean(busy)}>
            {busy === "waive" ? "Odobravam…" : "Odobri bez prevoda"}
          </Button>
          {state === "declared" && (
            <button type="button" className={linkCls} onClick={requireTranslation} disabled={Boolean(busy)}>
              {busy === "require" ? "Menjam…" : "Traži prevod"}
            </button>
          )}
        </div>
      )}

      {state === "needed" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-ink-3">Kandidat još nije napravio prevod.</p>
          <Button size="sm" variant="outline" onClick={translate} disabled={Boolean(busy)}>
            {busy === "translate" ? "Prevodim…" : "Napravi AI prevod"}
          </Button>
        </div>
      )}

      {t && state !== "waived" && (
        <>
          {t.candidateNote && (
            <p className="text-[13px] text-ink-2">
              <span className="text-ink-3">Napomena kandidata:</span> {t.candidateNote}
            </p>
          )}
          {state === "rejected" && t.rejectionReason && (
            <p className="text-[13px] text-red-700">Vraćeno: {t.rejectionReason}</p>
          )}
          {ai && <TranslationWarnings warnings={t.warnings} title="Upozorenja provere" />}
          {ai && !editing && <TranslationDocument data={t.data} className="max-h-[28rem] overflow-y-auto" />}
          {ai && editing && draft && <Editor data={draft} onChange={setDraft} />}
          {t.editedByAgency && !editing && <p className="text-xs text-ink-3">Agencija je ispravila tekst prevoda.</p>}

          {rejecting && (
            <label className="block">
              <span className={smallLabel}>Šta kandidat treba da ispravi</span>
              <textarea rows={2} className={`${FIELD_CLS} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={translationPdfUrl(doc, email)} target="_blank" rel="noreferrer" className={linkCls}>
              {ai ? (state === "approved" ? "Konačni PDF" : "Nacrt PDF") : "Otvori prevod"}
            </a>
            {ai && state !== "approved" && state !== "rejected" && !editing && (
              <button type="button" className={linkCls} onClick={() => { setDraft(clone(t.data)); setEditing(true); }}>
                Ispravi tekst
              </button>
            )}
            {editing && (
              <>
                <button type="button" className={linkCls} onClick={save} disabled={Boolean(busy)}>
                  {busy === "save" ? "Čuvam…" : "Sačuvaj izmene"}
                </button>
                <button type="button" className={linkCls} onClick={() => { setEditing(false); setDraft(null); }}>
                  Odustani
                </button>
              </>
            )}
            {state !== "approved" && state !== "rejected" && (
              <Button size="sm" variant="dark" onClick={approve} disabled={Boolean(busy)}>
                {busy === "approve" ? "Odobravam…" : "Odobri prevod"}
              </Button>
            )}
            {state !== "rejected" &&
              (rejecting ? (
                <>
                  <Button size="sm" variant="danger" onClick={reject} disabled={Boolean(busy) || reason.trim().length < 3}>
                    {busy === "reject" ? "Šaljem…" : "Vrati kandidatu"}
                  </Button>
                  <button type="button" className={linkCls} onClick={() => setRejecting(false)}>
                    Odustani
                  </button>
                </>
              ) : (
                <button type="button" className={linkCls} onClick={() => setRejecting(true)}>
                  {state === "approved" ? "Povuci odobrenje i vrati" : "Vrati kandidatu"}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
