// front/src/components/dashboard/Sheet.jsx
// Jedan okvir za sve pod-prozore portala (profil, video uputstvo, DS-160, ugovor, poslovi, računi…).
//  - telefon: ceo ekran, zaglavlje gore, akcije zalepljene dole (kao ekran u aplikaciji)
//  - desktop: centriran prozor sa senkom
// Za višekoračne forme: <SheetSteps> (napredak + nazivi koraka) i dugmad Nazad / Dalje u footeru.
import { useEffect } from "react";
import { cx, labelCls, inputCls } from "../ui";

function CloseGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const SIZE = {
  sm: "sm:max-w-lg",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * Sheet
 *  title, subtitle — zaglavlje (kratko!)
 *  aside           — mali element desno u zaglavlju (npr. status)
 *  nav             — red ispod zaglavlja (koraci, kartice)
 *  footer          — akcije; na telefonu zalepljene za dno
 *  as="form"       — telo je <form onSubmit>
 */
export default function Sheet({
  open = true,
  onClose,
  title,
  subtitle,
  aside,
  nav,
  footer,
  size = "md",
  as = "div",
  onSubmit,
  bodyClassName = "",
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const Body = as;

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Zatvori" onClick={onClose} className="absolute inset-0 hidden bg-ink/45 backdrop-blur-[2px] sm:block" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cx(
          "relative flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[min(90vh,860px)] sm:rounded-2xl sm:shadow-[0_30px_80px_-20px_rgba(35,31,32,0.45)]",
          SIZE[size] || SIZE.md
        )}
      >
        {/* Zaglavlje */}
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-6 sm:pb-4 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold leading-snug text-ink [font-stretch:100%] tracking-[-0.01em] sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-3 sm:text-sm">{subtitle}</p>}
          </div>
          {aside && <div className="hidden shrink-0 pt-0.5 sm:block">{aside}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="-mr-1.5 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
          >
            <CloseGlyph />
          </button>
        </div>

        {nav && <div className="shrink-0 border-b border-line">{nav}</div>}

        <Body
          {...(as === "form" ? { onSubmit, noValidate: false } : {})}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6", bodyClassName)}>{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-line bg-white px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5 sm:rounded-b-2xl sm:px-6 sm:py-4">
              {footer}
            </div>
          )}
        </Body>
      </div>
    </div>
  );
}

/** Koraci višekoračne forme: na telefonu "2 od 5 · naziv" + traka, na desktopu klikabilni nazivi. */
export function SheetSteps({ steps, active, onChange }) {
  const i = Math.max(0, steps.findIndex((s) => s.id === active));
  return (
    <div className="px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <p className="text-[13px] text-ink-3">
          <span className="font-semibold text-ink">{i + 1}</span> od {steps.length} · <span className="text-ink">{steps[i]?.label}</span>
        </p>
      </div>
      <div className="mt-2 flex gap-1 sm:hidden">
        {steps.map((s, k) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.label}
            onClick={() => onChange(s.id)}
            className={cx("h-1 flex-1 rounded-full", k <= i ? "bg-ink" : "bg-surface-2")}
          />
        ))}
      </div>
      <div className="hidden gap-1 sm:flex">
        {steps.map((s, k) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cx(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                on ? "bg-ink text-white" : "text-ink-3 hover:bg-surface hover:text-ink"
              )}
            >
              <span
                className={cx(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                  on ? "bg-white/15" : k < i ? "bg-ink text-white" : "bg-surface-2"
                )}
              >
                {k + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Kartice unutar sheet-a (segmentirana kontrola). */
export function SheetTabs({ tabs, active, onChange }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2.5 sm:px-6">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              on ? "bg-ink text-white" : "text-ink-3 hover:bg-surface hover:text-ink"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Polja forme ---------- */
export const fieldInputCls = inputCls;

/** Polje: oznaka, kontrola, sitna napomena. */
export function FormField({ label, hint, className = "", children }) {
  return (
    <label className={cx("block", className)}>
      <span className={cx(labelCls, "mb-1.5")}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-ink-3">{hint}</span>}
    </label>
  );
}

/** Naslov grupe polja unutar sheet-a. */
export function SheetSection({ title, hint, className = "", children }) {
  return (
    <section className={cx("space-y-4", className)}>
      {(title || hint) && (
        <div>
          {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
          {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Čip za izbor (veštine, države…). */
export function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
        selected ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2 hover:border-ink/40"
      )}
    >
      {children}
    </button>
  );
}

/** Mirna napomena (bez crvenih/žutih kutija). */
export function Hint({ children, className = "" }) {
  return <p className={cx("rounded-xl bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-2", className)}>{children}</p>;
}

/** Standardni footer: levo sekundarno, desno glavno. Na telefonu glavno dugme preko cele širine. */
export function SheetFooter({ left, children }) {
  return (
    <div className="flex items-center gap-2.5">
      {left && <div className="flex shrink-0 items-center gap-2">{left}</div>}
      <div className="ml-auto flex flex-1 items-center justify-end gap-2.5 sm:flex-none [&>*:last-child]:flex-1 sm:[&>*:last-child]:flex-none">
        {children}
      </div>
    </div>
  );
}
