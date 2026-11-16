// Login.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LanguageContext";
import { Button, inputCls, labelCls } from "./ui";
import { resendVerificationEmail } from "../data/candidateStore/session";

function EyeIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a3 3 0 0 0 4 4" />
          <path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.2 3.9M6.1 6.1A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.3-.6" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

/**
 * Login — prijava na nalog (kandidat ili administrator).
 *
 * Props:
 *  - onSubmit:   async ({ identifier, password }) => { success } | { error }
 *  - onNavigate: (event, href) => void
 *  - registerHref / applyHref / forgotHref
 */
export default function Login({
  onSubmit = () => {},
  onNavigate = () => {},
  registerHref = "/registracija",
  applyHref = "/prijava-online",
  forgotHref = "/zaboravljena-lozinka",
}) {
  const { t } = useTranslation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Nalog postoji, lozinka je tačna, ali email nije potvrđen.
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState({ busy: false, message: "", devLink: "" });

  // Link iz mejla „Potvrdi email" vodi ovde sa ?email=, pa je polje već popunjeno.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("email");
    if (fromLink) setIdentifier(fromLink);
  }, []);

  const resend = async () => {
    if (resendState.busy) return;
    setResendState({ busy: true, message: "" });
    const res = await resendVerificationEmail(identifier);
    setResendState({ busy: false, message: res.message, devLink: res.devVerificationUrl || "" });
  };

  const go = (href) => (e) => onNavigate(e, href);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setUnverified(false);
    setResendState({ busy: false, message: "" });
    setBusy(true);
    try {
      const res = await onSubmit({ identifier, password });
      if (res?.error) setError(res.error);
      if (res?.unverified) setUnverified(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface px-5 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-line bg-white p-7 sm:p-10">
          <h1 className="font-display text-3xl font-bold text-ink">{t("login.title")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t("login.subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && !unverified && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
                {error}
              </p>
            )}
            {unverified && (
              <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                <p className="font-medium">Potvrdi email pa se prijavi</p>
                <p className="mt-1">
                  Posle registracije smo ti poslali mejl sa linkom za potvrdu. Ne vidiš ga? Proveri Spam ili zatraži novi.
                </p>
                {resendState.message ? (
                  <p className="mt-2 text-amber-900" role="status">
                    {resendState.message}
                    {resendState.devLink && (
                      <>
                        {" "}Lokalni razvoj, mejlovi se ne šalju:{" "}
                        <a href={new URL(resendState.devLink).pathname + new URL(resendState.devLink).search} className="font-medium underline underline-offset-4">
                          potvrdi email
                        </a>
                      </>
                    )}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendState.busy}
                    className="mt-2 font-medium underline underline-offset-4 disabled:opacity-60"
                  >
                    {resendState.busy ? "Šaljem…" : "Pošalji link ponovo"}
                  </button>
                )}
              </div>
            )}

            <div>
              <label htmlFor="l-id" className={labelCls}>
                {t("login.identifier")}
              </label>
              <input
                id="l-id"
                type="email"
                inputMode="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("login.identifierPlaceholder")}
                className={`${inputCls} mt-2`}
                autoComplete="username"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="l-pass" className={labelCls}>
                  {t("login.password")}
                </label>
                <a href={forgotHref} onClick={go(forgotHref)} className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                  {t("login.forgot")}
                </a>
              </div>
              <div className="relative mt-2">
                <input
                  id="l-pass"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-12`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t("login.hidePassword") : t("login.showPassword")}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                >
                  <EyeIcon off={show} />
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" block disabled={busy}>
              {t("login.submit")}
            </Button>
          </form>
        </div>

        {/* Dva puta za one koji još nemaju nalog */}
        <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white text-[15px]">
          <div className="px-6 py-4">
            <dt className="text-ink-2">{t("login.noAccount")}</dt>
            <dd className="mt-1">
              <a href={registerHref} onClick={go(registerHref)} className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 hover:decoration-ink">
                {t("login.activateAccount")}
              </a>
            </dd>
          </div>
          <div className="px-6 py-4">
            <dt className="text-ink-2">{t("login.notInterviewed")}</dt>
            <dd className="mt-1">
              <a href={applyHref} onClick={go(applyHref)} className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 hover:decoration-ink">
                {t("login.applyFree")}
              </a>
            </dd>
          </div>
        </dl>

      </div>
    </section>
  );
}
