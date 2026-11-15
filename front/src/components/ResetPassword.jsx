// ResetPassword.jsx
import { useState } from "react";
import { Button, inputCls, labelCls } from "./ui";

/**
 * ResetPassword — nova lozinka iz linka u mejlu (ruta /nova-lozinka?token=…).
 * Poziva POST /api/candidate-accounts/reset-password (Payload). Link važi 30 minuta.
 */
export default function ResetPassword({ onNavigate = () => {}, loginHref = "/prijava", forgotHref = "/zaboravljena-lozinka" }) {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [message, setMessage] = useState("");

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = repeat.length > 0 && password !== repeat;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending" || password.length < 12 || password !== repeat) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/candidate-accounts/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const raw = data?.errors?.[0]?.message || data?.message || "";
        throw new Error(
          res.status === 429
            ? "Previše pokušaja. Sačekaj nekoliko minuta i probaj ponovo."
            : /token|expired|invalid/i.test(raw) || res.status === 403 || res.status === 404
            ? "Link je istekao ili je već iskorišćen. Zatraži novi."
            : raw || "Lozinka nije promenjena. Probaj ponovo."
        );
      }
      // Payload posle promene prijavi korisnika; portal ipak otvaramo kroz redovnu prijavu.
      await fetch("/api/candidate-accounts/logout", { method: "POST", credentials: "include" }).catch(() => {});
      setStatus("done");
    } catch (err) {
      setMessage(err.message);
      setStatus("error");
    }
  };

  const linkCls = "text-ink-2 underline-offset-4 hover:text-ink hover:underline";

  return (
    <section className="bg-surface px-5 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-7 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Nova lozinka</h1>

        {!token ? (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Ovaj link nije potpun. Otvori ga ponovo iz mejla ili zatraži novi.
            </p>
            <Button variant="outline" size="lg" block className="mt-8" href={forgotHref} onClick={(e) => onNavigate(e, forgotHref)}>
              Zatraži novi link
            </Button>
          </>
        ) : status === "done" ? (
          <>
            <p role="status" className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Lozinka je promenjena. Prijavi se novom lozinkom.
            </p>
            <Button size="lg" block className="mt-8" href={loginHref} onClick={(e) => onNavigate(e, loginHref)}>
              Prijavi se
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Najmanje 12 znakova. Link iz mejla važi 30 minuta.</p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {status === "error" && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
                  {message}{" "}
                  {/istekao/.test(message) && (
                    <a href={forgotHref} onClick={(e) => onNavigate(e, forgotHref)} className="font-medium underline underline-offset-2">
                      Zatraži novi link
                    </a>
                  )}
                </p>
              )}
              <div>
                <label htmlFor="rp-password" className={labelCls}>
                  Nova lozinka
                </label>
                <input
                  id="rp-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} mt-2`}
                  autoComplete="new-password"
                  aria-describedby={tooShort ? "rp-short" : undefined}
                />
                {tooShort && (
                  <p id="rp-short" className="mt-1.5 text-[13px] text-ink-3">
                    Još {12 - password.length} {12 - password.length === 1 ? "znak" : "znakova"}.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="rp-repeat" className={labelCls}>
                  Ponovi lozinku
                </label>
                <input
                  id="rp-repeat"
                  type="password"
                  required
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className={`${inputCls} mt-2`}
                  autoComplete="new-password"
                  aria-describedby={mismatch ? "rp-mismatch" : undefined}
                />
                {mismatch && (
                  <p id="rp-mismatch" className="mt-1.5 text-[13px] text-red-700">
                    Lozinke se ne poklapaju.
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" block disabled={status === "sending" || password.length < 12 || password !== repeat}>
                {status === "sending" ? "Čuvam…" : "Sačuvaj lozinku"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm">
              <a href={loginHref} onClick={(e) => onNavigate(e, loginHref)} className={linkCls}>
                Nazad na prijavu
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
