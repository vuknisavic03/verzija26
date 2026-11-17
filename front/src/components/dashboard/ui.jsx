// dashboard/ui.jsx
// Primitivi kandidatskog portala. Hijerarhija je uvek ista:
//   strana (bg-surface) → Panel (bela kartica, tanka linija) → Field (tonirana pločica)
// Status se uvek prikazuje istom značkom (StatusPill), a poruke istim blokom (Notice).

import { useEffect, useState } from "react";
import { cx, CheckIcon } from "../ui";

/* ---------- Status ---------- */
const PILL_DOT = {
  neutral: "bg-neutral-400",
  done: "bg-emerald-500",
  wait: "bg-amber-500",
  danger: "bg-red-500",
  dark: "bg-ink",
};

/** StatusPill — mala oznaka sa tačkom boje statusa. tone: neutral | done | wait | danger | dark */
export function StatusPill({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-2",
        className
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", PILL_DOT[tone] || PILL_DOT.neutral)} />
      {children}
    </span>
  );
}

/* ---------- Panel ---------- */
/** Panel — sekcija na beloj strani: naslov i akcija u istom redu, sadržaj ispod. Bez kartice i senke. */
export function Panel({ title, description, aside, className = "", children }) {
  return (
    <section className={className}>
      {(title || aside) && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-4">
            {title && <h3 className="text-[13px] font-medium text-ink-3">{title}</h3>}
            {aside}
          </div>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-3">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Field — par oznaka/vrednost na toniranoj pločici. */
export function Field({ label, hint, className = "", children }) {
  return (
    <div className={cx("rounded-xl bg-surface px-4 py-3", className)}>
      <p className="text-xs text-ink-3">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-ink">{children}</div>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/* ---------- Zadaci ---------- */
// Jedan korak procesa = lista zadataka. Svaki zadatak ima jedno stanje i najviše jednu glavnu akciju.
//   state: done | current | wait | danger | locked | info
// Prvi zadatak koji traži akciju ("current" ili "danger") je "sledeći" — dobija žuti broj i žuto dugme.

const STATUS_TONE = {
  done: "text-ink-3",
  wait: "text-amber-700",
  danger: "text-red-700",
  current: "text-ink-3",
  locked: "text-ink-3",
  info: "text-ink-3",
};

/** Ikonica stanja zadatka (20 px) — isti jezik kao u alatima za upravljanje zadacima. */
export function TaskIcon({ state, isNext, className = "" }) {
  const cls = cx("h-5 w-5 shrink-0", className);
  if (state === "done")
    return (
      <svg viewBox="0 0 20 20" className={cls} aria-hidden="true">
        <circle cx="10" cy="10" r="10" className="fill-ink" />
        <path d="M6 10.4l2.6 2.5L14 7.6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "danger")
    return (
      <svg viewBox="0 0 20 20" className={cls} aria-hidden="true">
        <circle cx="10" cy="10" r="10" className="fill-red-600" />
        <path d="M10 5.5v5.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="14.2" r="1.15" fill="white" />
      </svg>
    );
  if (state === "wait")
    return (
      <svg viewBox="0 0 20 20" className={cls} aria-hidden="true">
        <circle cx="10" cy="10" r="8.75" fill="none" className="stroke-amber-500" strokeWidth="1.5" />
        <path d="M10 4.5a5.5 5.5 0 0 1 0 11z" className="fill-amber-500" />
      </svg>
    );
  if (state === "locked")
    return (
      <svg viewBox="0 0 20 20" className={cls} aria-hidden="true">
        <circle cx="10" cy="10" r="8.75" fill="none" className="stroke-neutral-300" strokeWidth="1.5" strokeDasharray="2.6 2.4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" className={cls} aria-hidden="true">
      <circle cx="10" cy="10" r="8.75" fill="none" className={isNext ? "stroke-ink" : "stroke-neutral-400"} strokeWidth="1.5" />
      {isNext && <circle cx="10" cy="10" r="3.25" className="fill-ink" />}
    </svg>
  );
}

export function Chevron({ open, side = false }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cx("h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200", side ? "-rotate-90" : open && "rotate-180")}
      aria-hidden="true"
    >
      <path d="M5.5 8l4.5 4.5L14.5 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Vraća id sledećeg zadatka u listi (ili null). */
export function nextTaskId(tasks) {
  return tasks.find((t) => t.state === "current" || t.state === "danger")?.id || null;
}

/** Otvara zadatak sa datim id-jem (iz zaglavlja, "Dokumenata" itd.). */
export function openTask(id) {
  window.dispatchEvent(new CustomEvent("portal:open-task", { detail: id }));
}

/** Okvir za retke slučajeve kad sadržaj mora da se odvoji (bez senke). */
export const cardCls = "rounded-2xl border border-line bg-white";

const AREA_LABEL = { docs: "Dokumenta", pay: "Uplate" };

/**
 * TaskList — tasks: [{ id, title, desc, state, status, area, render(isNext) }]
 * Redovi na beloj strani, razdvojeni linijom. Zadatak se otvara klikom (opis i njegove kontrole).
 *  quiet:      korak još nije na redu — nijedan zadatak se ne ističe kao sledeći.
 *  onNavigate: u Aplikaciji — zadatak koji se radi u drugom tabu (area) vodi tamo umesto da se otvara.
 * Žuto dugme postoji samo u bloku „sledeći korak" na vrhu, zato lista uvek crta tamna dugmad.
 */
export function TaskList({ tasks, quiet = false, onNavigate, className = "" }) {
  const nextId = quiet ? null : nextTaskId(tasks);
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    const onOpen = (e) => {
      if (tasks.some((t) => t.id === e.detail)) setOpenIds((prev) => new Set(prev).add(e.detail));
    };
    window.addEventListener("portal:open-task", onOpen);
    return () => window.removeEventListener("portal:open-task", onOpen);
  }, [tasks]);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <ol className={cx("divide-y divide-line border-y border-line", className)}>
      {tasks.map((t) => {
        const isNext = t.id === nextId;
        const muted = t.state === "locked";
        const link = Boolean(onNavigate && t.area);
        const content = !link && t.render && !muted ? t.render(false) : null;
        const expandable = !link && Boolean(t.desc || content);
        const isOpen = expandable && openIds.has(t.id);
        const tone = STATUS_TONE[t.state] || STATUS_TONE.current;
        return (
          <li key={t.id} id={`task-${t.id}`} className="scroll-mt-24">
            <button
              type="button"
              onClick={() => (link ? onNavigate(t) : expandable && toggle(t.id))}
              aria-expanded={expandable ? isOpen : undefined}
              disabled={!link && !expandable}
              className={cx("group flex w-full items-center gap-3 py-3.5 text-left", !link && !expandable && "cursor-default")}
            >
              <TaskIcon state={t.state} isNext={isNext} />
              <span className="min-w-0 flex-1">
                <span
                  className={cx(
                    "block truncate text-[15px]",
                    muted ? "text-ink-3" : t.state === "done" ? "text-ink-2" : "font-medium text-ink"
                  )}
                >
                  {t.title}
                </span>
                {t.status && <span className={cx("mt-0.5 block text-[13px] sm:hidden", tone)}>{t.status}</span>}
              </span>
              {t.status && <span className={cx("hidden shrink-0 text-[13px] sm:inline", tone)}>{t.status}</span>}
              {link ? (
                <span className="flex shrink-0 items-center gap-1 text-[13px] text-ink-3 group-hover:text-ink">
                  {AREA_LABEL[t.area]}
                  <Chevron side />
                </span>
              ) : expandable ? (
                <Chevron open={isOpen} />
              ) : (
                <span className="w-4 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="pb-5 pl-8">
                {t.desc && <p className="max-w-xl text-sm leading-relaxed text-ink-2">{t.desc}</p>}
                {content && <div className={t.desc ? "mt-3.5" : ""}>{content}</div>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Red akcija ispod zadatka. */
export function Actions({ className = "", children }) {
  // Telefon: dugmad jedno ispod drugog, cele širine (lakše za palac). Desktop: u redu.
  return (
    <div className={cx("grid gap-2.5 sm:flex sm:flex-wrap sm:items-center [&>button]:w-full sm:[&>button]:w-auto", className)}>
      {children}
    </div>
  );
}

/** Tekstualni link-dugme (sekundarna radnja: zameni, izmeni, demo…). */
export function LinkButton({ className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "justify-self-start text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Ime okačenog fajla sa kvačicom. */
/** „Obriši" u dva koraka (potvrda u istom redu), bez sistemskog prozora. */
export function RemoveFileButton({ onConfirm, label = "Obriši", className = "" }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cx("text-[13px] font-medium text-ink-3 underline decoration-line-strong underline-offset-4 hover:text-red-700 hover:decoration-red-700", className)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={cx("inline-flex items-center gap-3 text-[13px]", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onConfirm();
          setBusy(false);
          if (ok === false) setConfirming(false);
        }}
        className="font-semibold text-red-700 underline underline-offset-4 disabled:opacity-50"
      >
        {busy ? "Brišem…" : "Da, obriši"}
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="font-medium text-ink-3 hover:text-ink">
        Otkaži
      </button>
    </span>
  );
}

export function FileLine({ name, className = "", children }) {
  return (
    <span className={cx("flex min-w-0 items-center gap-2 text-sm text-ink-2", className)}>
      <CheckIcon className="h-4 w-4 shrink-0 text-emerald-700" strokeWidth={2.5} />
      <span className="truncate">{name}</span>
      {children}
    </span>
  );
}

/** Lista "oznaka — vrednost": oznaka levo, vrednost desno, redovi razdvojeni linijom. */
export function DataList({ items, cols = 2, className = "" }) {
  return (
    <dl className={cx("grid gap-x-12 border-t border-line", cols >= 2 && "sm:grid-cols-2", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <dt className="shrink-0 text-sm text-ink-3">{label}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Poruka ---------- */
const NOTICE_TONE = {
  neutral: "bg-surface text-ink-2",
  done: "bg-emerald-50 text-emerald-900",
  wait: "bg-amber-50 text-amber-900",
  danger: "bg-red-50 text-red-800",
};

/** Notice — poruka o stanju (bez okvira; ton nosi podloga). */
export function Notice({ tone = "neutral", title, aside, className = "", children }) {
  return (
    <div
      className={cx(
        "flex flex-col justify-between gap-3 rounded-xl px-4 py-3.5 text-sm sm:flex-row sm:items-center",
        NOTICE_TONE[tone] || NOTICE_TONE.neutral,
        className
      )}
    >
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx("leading-relaxed", title && "mt-0.5 opacity-85")}>{children}</div>}
      </div>
      {aside}
    </div>
  );
}

/* ---------- Zadaci po tabovima ---------- */
// Zadatak sa `area` se radi u svom tabu: "docs" u Dokumentima, "pay" u Uplatama.
// U Aplikaciji takav zadatak stoji samo kao red sa stanjem i linkom ka tabu.

const PAY_ANCHOR = { payment1: "pay-rate1", payment2: "pay-rate2", payment3: "pay-rate3", visafee: "pay-visa" };

/** Gde se zadatak radi: [view, anchorId]. */
export function taskTarget(task) {
  if (task?.area === "pay") return ["uplate", PAY_ANCHOR[task.id] || null];
  if (task?.area === "docs") return ["dokumenta", `task-${task.id}`];
  return ["put", task ? `task-${task.id}` : null];
}
