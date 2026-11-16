// VerifyEmail.jsx
import { useEffect, useRef, useState } from "react";
import { Button, inputCls, labelCls } from "./ui";
import { confirmEmail, resendVerificationEmail } from "../data/candidateStore/session";

/**
 * VerifyEmail — link iz mejla „Potvrdi email" (ruta /potvrda-emaila?token=…).
 * Potvrda ide automatski pri otvaranju; posle uspeha kandidat ide na prijavu sa upisanim emailom.
 */
export default function VerifyEmail({ onNavigate = () => {}, loginHref = "/prijava", signedInAs = "", onSwitchAccount }) {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "";
  const [state, setState] = useState(token ? "checking" : "error"); // checking | done | error
  const [message, setMessage] = useState(token ? "" : "Link nije potpun. Otvori ga ponovo iz mejla.");
  const [email, setEmail] = useState("");
  const [resend, setResend] = useState({ busy: false, message: "" });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    confirmEmail(token).then((res) => {
      if (res.ok) {
        setEmail(res.email);
        setState("done");
      } else {
        setMessage(res.message);
        setState("error");
      }
    });
  }, [token]);

  const loginLink = email ? `${loginHref}?email=${encodeURIComponent(email)}` : loginHref;

  const handleResend = async (e) => {
    e.preventDefault();
    if (resend.busy || !email.trim()) return;
    setResend({ busy: true, message: "" });
    const res = await resendVerificationEmail(email);
    setResend({ busy: false, message: res.message });
  };

  return (
    <section className="bg-surface px-5 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-7 sm:p-10">
        {state === "checking" && (
          <>
            <h1 className="font-display text-3xl font-bold text-ink">Potvrđujem email…</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2" role="status">
              Samo trenutak.
            </p>
          </>
        )}

        {state === "done" && (
          <>
            <h1 className="font-display text-3xl font-bold text-ink">Email je potvrđen</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2" role="status">
              Nalog je aktivan. Prijavi se lozinkom koju si izabrao pri registraciji.
            </p>
            {signedInAs && onSwitchAccount ? (
              <>
                {/* Agencija i student u istom pregledaču dele jednu prijavu: prvo odjava, pa prijava studenta. */}
                <p className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-ink-2">
                  U ovom pregledaču si trenutno prijavljen {signedInAs === "admin" ? "kao agencija" : "na drugi nalog"}. Odjavi
                  se da bi ušao na nalog koji si upravo potvrdio.
                </p>
                <Button size="lg" block className="mt-6" onClick={() => onSwitchAccount(loginLink)}>
                  Odjavi se i prijavi na ovaj nalog
                </Button>
              </>
            ) : (
              <Button size="lg" block className="mt-8" href={loginLink} onClick={(e) => onNavigate(e, loginLink)}>
                Prijavi se
              </Button>
            )}
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="font-display text-3xl font-bold text-ink">Link ne radi</h1>
            <p role="alert" className="mt-4 text-[15px] leading-relaxed text-ink-2">
              {message}
            </p>
            {resend.message ? (
              <p role="status" className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-ink-2">
                {resend.message}
              </p>
            ) : (
              <form onSubmit={handleResend} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="ve-email" className={labelCls}>
                    Email kojim si se registrovao
                  </label>
                  <input
                    id="ve-email"
                    type="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputCls} mt-2`}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" size="lg" block disabled={resend.busy}>
                  {resend.busy ? "Šaljem…" : "Pošalji novi link"}
                </Button>
              </form>
            )}
            <a
              href={loginHref}
              onClick={(e) => onNavigate(e, loginHref)}
              className="mt-6 block text-center text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Već sam potvrdio, idem na prijavu
            </a>
          </>
        )}
      </div>
    </section>
  );
}
