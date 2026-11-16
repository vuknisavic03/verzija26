// front/src/components/register/Step2Documents.jsx
// Korak 2: pasoš i lična karta. Oba dokumenta se očitavaju automatski (MRZ + podaci sa dokumenta),
// server proverava kontrolne cifre, a kandidat proverava i po potrebi ispravlja podatke.
import { useRef, useState } from "react";
import { labelCls, inputCls, BackIcon, CameraIcon, CheckIcon } from "./ui";
import { scanIdentityDocument } from "../../data/candidateStore";

/* ── Pomoćno ─────────────────────────────────────────────────────────────── */

/** Smanji fotografiju (najviše 2400 px, JPEG) da upload i čuvanje budu brzi. PDF i HEIC ostaju kakvi jesu. */
async function compressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function readDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, name) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "image/jpeg";
  const bytes = Uint8Array.from(atob(b64 || ""), (c) => c.charCodeAt(0));
  return new File([bytes], name || "dokument", { type: mime });
}

export function jmbgValid(jmbg) {
  if (!/^\d{13}$/.test(jmbg)) return false;
  const d = jmbg.split("").map(Number);
  const sum = 7 * (d[0] + d[6]) + 6 * (d[1] + d[7]) + 5 * (d[2] + d[8]) + 4 * (d[3] + d[9]) + 3 * (d[4] + d[10]) + 2 * (d[5] + d[11]);
  let k = 11 - (sum % 11);
  if (k > 9) k = 0;
  return k === d[12];
}

const token = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/Đ/g, "DJ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");

/** Koja polja forme puni koji dokument (pasoš ima prednost za lične podatke). */
const MAP = {
  passport: {
    birthDate: "birthDate",
    documentNumber: "passportNumber",
    expiryDate: "passportExpiry",
    firstName: "firstName",
    jmbg: "jmbg",
    lastName: "lastName",
    sex: "sex",
  },
  idcard: {
    birthDate: "birthDate",
    documentNumber: "idCardNumber",
    expiryDate: "idCardExpiry",
    firstName: "firstName",
    jmbg: "jmbg",
    lastName: "lastName",
    sex: "sex",
  },
};

/* ── Delovi ekrana ───────────────────────────────────────────────────────── */

function UploadSlot({ label, hint, image, onPick, onRemove, disabled }) {
  const inputRef = useRef(null);
  const isPdf = image?.dataUrl?.startsWith("data:application/pdf");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-surface p-4 text-center transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60 sm:p-5"
      >
        {image?.dataUrl && !isPdf ? (
          <img src={image.dataUrl} alt={label} className="max-h-36 rounded-lg object-contain" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/30 text-ink">
            <CameraIcon className="h-5 w-5" />
          </span>
        )}
        <span className="mt-2.5 text-sm font-semibold text-ink">
          {image?.dataUrl ? (isPdf ? image.fileName : "Zameni") : label}
        </span>
        {!image?.dataUrl && hint && <span className="mt-0.5 text-xs text-ink-3">{hint}</span>}
      </button>
      {image?.dataUrl && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Ukloni: ${label}`}
          className="mt-2 text-xs font-semibold text-ink-3 underline-offset-4 hover:text-red-700 hover:underline disabled:opacity-60"
        >
          Ukloni
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

function ScanStatus({ state }) {
  if (!state || state.status === "idle") return null;
  if (state.status === "scanning") {
    return (
      <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
        Očitavam podatke… obično traje desetak sekundi.
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
        {state.message}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-1.5">
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
        <CheckIcon className="h-4 w-4" />
        {state.mrzValid ? "Očitano i provereno kontrolnim ciframa" : "Očitano. Proveri podatke ispod."}
      </p>
      {state.warnings?.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-xl bg-amber-50 py-2.5 pl-7 pr-3.5 text-sm text-amber-900">
          {state.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ id, label, value, onChange, verified, error, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {verified && (
          <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-emerald-700">
            <CheckIcon className="h-3 w-3" /> provereno
          </span>
        )}
      </label>
      <input
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${error ? "border-red-400" : ""}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Korak ───────────────────────────────────────────────────────────────── */

export default function Step2Documents({ email, code, values, onChange, images, onImages, onBack, onSubmit, t }) {
  const [scan, setScan] = useState({ idcard: { status: "idle" }, passport: { status: "idle" } });
  const [results, setResults] = useState({ idcard: null, passport: null });
  const [verified, setVerified] = useState({});
  const [submitError, setSubmitError] = useState("");
  // Šta je očitavanje upisalo — takva polja sme ponovo da prepiše, a ono što je kandidat ukucao ne.
  const auto = useRef({});
  // Sa kog dokumenta je polje automatski upisano (da bi uklanjanje slike obrisalo i te podatke).
  const autoFrom = useRef({});

  const set = (key, value) => {
    onChange({ [key]: value });
    setVerified((v) => ({ ...v, [key]: false }));
  };

  const apply = (kind, fields) => {
    const patch = {};
    const nextVerified = {};
    for (const [from, to] of Object.entries(MAP[kind])) {
      const field = fields?.[from];
      if (!field?.value) continue;
      // Lične podatke daje pasoš; lična karta ih dopunjuje samo ako ih pasoš nema.
      const personal = !["documentNumber", "expiryDate"].includes(from);
      if (kind === "idcard" && personal && results.passport?.[from]?.value) continue;
      const current = values[to] || "";
      if (current === "" || current === auto.current[to]) {
        patch[to] = field.value;
        auto.current[to] = field.value;
        autoFrom.current[to] = kind;
        nextVerified[to] = Boolean(field.verified);
      }
    }
    if (Object.keys(patch).length) onChange(patch);
    setVerified((v) => ({ ...v, ...nextVerified }));
  };

  const runScan = async (kind, slots) => {
    const files = slots.filter(Boolean).map((s) => dataUrlToFile(s.dataUrl, s.fileName));
    if (!files.length) return;
    setScan((s) => ({ ...s, [kind]: { status: "scanning" } }));
    const res = await scanIdentityDocument({ kind, files, email, code });
    if (!res.ok) {
      setScan((s) => ({ ...s, [kind]: { status: "error", message: res.message } }));
      return;
    }
    setResults((r) => ({ ...r, [kind]: res.fields }));
    setScan((s) => ({ ...s, [kind]: { mrzValid: res.mrzValid, status: "done", warnings: res.warnings } }));
    apply(kind, res.fields);
  };

  const pick = async (slot, file) => {
    const prepared = await compressImage(file);
    const dataUrl = await readDataUrl(prepared);
    if (!dataUrl) return;
    const image = { dataUrl, fileName: prepared.name };
    const next = { ...images, [slot]: image };
    onImages({ [slot]: image });
    if (slot === "passport") runScan("passport", [image]);
    else runScan("idcard", [next.idFront, next.idBack]);
  };

  // Uklanjanje slike: briše se i ono što je sa tog dokumenta automatski upisano (ručni unos ostaje).
  const remove = (slot) => {
    const kind = slot === "passport" ? "passport" : "idcard";
    const next = { ...images, [slot]: null };
    onImages({ [slot]: null });
    const remaining = kind === "idcard" ? [next.idFront, next.idBack].filter(Boolean) : [];
    if (remaining.length) {
      runScan("idcard", remaining);
      return;
    }
    const patch = {};
    for (const [field, from] of Object.entries(autoFrom.current)) {
      if (from !== kind) continue;
      if ((values[field] || "") === auto.current[field]) patch[field] = "";
      delete autoFrom.current[field];
      delete auto.current[field];
    }
    if (Object.keys(patch).length) onChange(patch);
    setVerified((v) => Object.fromEntries(Object.entries(v).filter(([field]) => !(field in patch))));
    setResults((r) => ({ ...r, [kind]: null }));
    setScan((s) => ({ ...s, [kind]: { status: "idle" } }));
  };

  // Poređenje dva dokumenta
  const cross = [];
  const p = results.passport;
  const c = results.idcard;
  if (p && c) {
    // Porede se samo provereni podaci; nesigurno čitanje ne sme da pravi lažno upozorenje.
    const differ = (a, b, norm = (v) => v) => Boolean(a?.verified && b?.verified && norm(a.value) !== norm(b.value));
    if (differ(p.lastName, c.lastName, token) || differ(p.firstName, c.firstName, token)) {
      cross.push("Ime i prezime nisu isti u pasošu i na ličnoj karti.");
    }
    if (differ(p.birthDate, c.birthDate)) cross.push("Datum rođenja nije isti u pasošu i na ličnoj karti.");
    if (differ(p.jmbg, c.jmbg)) cross.push("JMBG nije isti u pasošu i na ličnoj karti.");
  }

  const jmbgError = values.jmbg && values.jmbg.length === 13 && !jmbgValid(values.jmbg) ? "JMBG nema ispravnu kontrolnu cifru." : "";
  const scanning = scan.passport.status === "scanning" || scan.idcard.status === "scanning";

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!images.passport) return setSubmitError("Okači stranu pasoša sa fotografijom.");
    if (!images.idFront && !images.idBack) return setSubmitError("Okači ličnu kartu (prednju i zadnju stranu).");
    if (!values.firstName?.trim() || !values.lastName?.trim()) return setSubmitError("Upiši ime i prezime.");
    if (!jmbgValid(values.jmbg || "")) return setSubmitError("Upiši ispravan JMBG (13 cifara).");
    if (!values.passportNumber?.trim()) return setSubmitError("Upiši broj pasoša.");
    if (!values.idCardNumber?.trim()) return setSubmitError("Upiši broj lične karte.");
    if (!values.phone?.trim()) return setSubmitError("Upiši broj mobilnog telefona.");
    onSubmit(e);
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink">
        <BackIcon /> {t("reg.back")}
      </button>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Pasoš i lična karta</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Slikaj oba dokumenta ravno, ceo, bez odsjaja. Podatke očitavamo automatski i proveravamo kontrolnim ciframa, a
        ti ih proveriš pre nastavka.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
        <section aria-labelledby="doc-passport">
          <h2 id="doc-passport" className="text-base font-semibold text-ink">
            Pasoš
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Strana sa fotografijom, zajedno sa dva reda sa znakovima „&lt;" na dnu.</p>
          <div className="mt-3">
            <UploadSlot
              label="Slikaj ili otpremi pasoš"
              hint="JPG, PNG ili PDF"
              image={images.passport}
              onPick={(f) => pick("passport", f)}
              onRemove={() => remove("passport")}
              disabled={scan.passport.status === "scanning"}
            />
          </div>
          <ScanStatus state={scan.passport} />
        </section>

        <section aria-labelledby="doc-idcard">
          <h2 id="doc-idcard" className="text-base font-semibold text-ink">
            Lična karta
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Obe strane. Na zadnjoj su JMBG i tri reda sa znakovima „&lt;".</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <UploadSlot
              label="Prednja strana"
              image={images.idFront}
              onPick={(f) => pick("idFront", f)}
              onRemove={() => remove("idFront")}
              disabled={scan.idcard.status === "scanning"}
            />
            <UploadSlot
              label="Zadnja strana"
              image={images.idBack}
              onPick={(f) => pick("idBack", f)}
              onRemove={() => remove("idBack")}
              disabled={scan.idcard.status === "scanning"}
            />
          </div>
          <ScanStatus state={scan.idcard} />
        </section>

        {cross.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 rounded-xl bg-red-50 py-2.5 pl-7 pr-3.5 text-sm text-red-700">
            {cross.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        <section aria-labelledby="doc-data" className="space-y-4 border-t border-line pt-6">
          <h2 id="doc-data" className="text-base font-semibold text-ink">
            Tvoji podaci
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reg-fn" label={t("reg.firstName")} value={values.firstName} onChange={(v) => set("firstName", v)} verified={verified.firstName} required autoComplete="given-name" />
            <Field id="reg-ln" label={t("reg.lastName")} value={values.lastName} onChange={(v) => set("lastName", v)} verified={verified.lastName} required autoComplete="family-name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="reg-jmbg"
              label="JMBG"
              value={values.jmbg}
              onChange={(v) => set("jmbg", v.replace(/\D/g, "").slice(0, 13))}
              verified={verified.jmbg}
              error={jmbgError}
              inputMode="numeric"
              maxLength={13}
              required
            />
            <Field id="reg-dob" label="Datum rođenja" type="date" value={values.birthDate} onChange={(v) => set("birthDate", v)} verified={verified.birthDate} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reg-pass" label="Broj pasoša" value={values.passportNumber} onChange={(v) => set("passportNumber", v.toUpperCase())} verified={verified.passportNumber} required />
            <Field id="reg-pass-exp" label="Pasoš važi do" type="date" value={values.passportExpiry} onChange={(v) => set("passportExpiry", v)} verified={verified.passportExpiry} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reg-idcard" label={t("reg.idCardNumber")} value={values.idCardNumber} onChange={(v) => set("idCardNumber", v.toUpperCase())} verified={verified.idCardNumber} required />
            <Field id="reg-id-exp" label="Lična karta važi do" type="date" value={values.idCardExpiry} onChange={(v) => set("idCardExpiry", v)} verified={verified.idCardExpiry} />
          </div>
          <Field
            id="reg-phone"
            label="Broj mobilnog telefona"
            type="tel"
            value={values.phone}
            onChange={(v) => onChange({ phone: v })}
            placeholder="npr. +381 64 123 4567"
            autoComplete="tel"
            required
          />
        </section>

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={scanning}
          className="bg-brand text-ink w-full rounded-full px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-brand-strong disabled:opacity-40"
        >
          {scanning ? "Sačekaj da se očitavanje završi…" : t("reg.continue")}
        </button>
      </form>
    </div>
  );
}
