// front/src/components/dashboard/DashboardHeader.jsx
// Vrh portala:
//  - traka: logo, sekcije (na telefonu su u donjoj navigaciji), nalog
//  - blok „sledeći korak": uvek kaže čiji je red i, kad je red na studentu, sadrži i kontrole tog zadatka.
// Boja bloka je signal: žuto = na tebi je red, crvenkasto = vraćeno na ispravku, sivo = red je na agenciji.
import Logo from "../Logo";
import { LogoutIcon } from "./icons";
import { Button, cx, CheckIcon } from "../ui";

/* ---------- Ikonice sekcija (donja navigacija) ---------- */
const ic = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
const SectionIcon = {
  put: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="6" cy="18" r="2.2" {...ic} />
      <circle cx="18" cy="6" r="2.2" {...ic} />
      <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" {...ic} />
    </svg>
  ),
  dokumenta: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...ic} />
      <path d="M14 3v5h5M9 13h6M9 17h4" {...ic} />
    </svg>
  ),
  uplate: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" {...ic} />
      <path d="M3 10h18M7 15h3" {...ic} />
    </svg>
  ),
  podaci: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="8.5" r="3.5" {...ic} />
      <path d="M5 20a7 7 0 0 1 14 0" {...ic} />
    </svg>
  ),
};

const SECTIONS = [
  { id: "put", label: "Aplikacija" },
  { id: "dokumenta", label: "Dokumenta" },
  { id: "uplate", label: "Uplate" },
  { id: "podaci", label: "Moji podaci", short: "Podaci" },
];

function Count({ n }) {
  if (!n) return null;
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold tabular-nums text-white">
      {n}
    </span>
  );
}

/* ---------- Sledeći korak ---------- */
const NOW = {
  do: { box: "bg-brand", label: "Na tebi je red" },
  fix: { box: "bg-red-50", label: "Vraćeno na ispravku" },
  wait: { box: "bg-surface", label: "Red je na nama" },
  done: { box: "bg-surface", label: "Sve je spremno" },
};

function NowBlock({ next }) {
  if (!next) return null;
  const kind = next.kind === "do" && next.task?.state === "danger" ? "fix" : next.kind;
  const look = NOW[kind] || NOW.wait;
  // Kontrole zadatka (dugmad, kačenje fajla…) — iste one koje zadatak ima u svom tabu.
  const controls = next.kind === "do" ? next.task?.render?.(false) : null;
  // Kad student nema šta da radi, blok je manji i mirniji.
  const active = kind === "do" || kind === "fix";

  return (
    <section aria-label="Sledeći korak" className={cx("rounded-3xl px-5 sm:px-9", active ? "py-6 sm:py-9" : "py-5 sm:py-7", look.box)}>
      <div className="flex items-center justify-between gap-4">
        <p className={cx("flex items-center gap-2 text-[13px] font-semibold", kind === "fix" ? "text-red-700" : "text-ink")}>
          {kind === "done" && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
          {kind === "wait" && <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />}
          {look.label}
        </p>
        {next.stageLabel && <p className="font-sign text-[15px] font-semibold text-ink/70">{next.stageLabel}</p>}
      </div>
      <h1
        className={cx(
          "mt-3 font-display font-bold leading-[1.12] text-ink",
          active ? "text-[26px] sm:mt-4 sm:text-[34px]" : "text-[21px] sm:text-[26px]"
        )}
      >
        {next.title}
      </h1>
      {next.desc && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/80">{next.desc}</p>}
      {controls ? (
        <div className="mt-6">{controls}</div>
      ) : next.kind === "do" && next.onGo ? (
        <div className="mt-6">
          <Button variant="dark" onClick={next.onGo}>
            {next.cta}
          </Button>
        </div>
      ) : (
        next.kind === "wait" &&
        next.onGo && (
          <button
            type="button"
            onClick={next.onGo}
            className="mt-4 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            {next.cta}
          </button>
        )
      )}
    </section>
  );
}

/* ---------- Donja navigacija (telefon) ---------- */
export function MobileNav({ view, setView, badges = {} }) {
  return (
    <nav
      aria-label="Sekcije portala"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-4">
        {SECTIONS.map((s) => {
          const active = view === s.id;
          const Icon = SectionIcon[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setView(s.id)}
              aria-current={active ? "page" : undefined}
              className={cx("relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", active ? "text-ink" : "text-ink-3")}
            >
              <span className="relative">
                <Icon className="h-6 w-6" aria-hidden="true" />
                {badges[s.id] ? (
                  <span className="absolute -right-2.5 -top-1">
                    <Count n={badges[s.id]} />
                  </span>
                ) : null}
              </span>
              {s.short || s.label}
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Zaglavlje ---------- */
export default function DashboardHeader({ candidate, logoHref, goHome, onLogout, t, next, view, setView, badges = {} }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4 sm:h-16 sm:px-8">
          <a href={logoHref} onClick={goHome} className="flex shrink-0 items-center" aria-label="American Adventure — početna">
            <Logo className="h-8 w-auto sm:h-9" />
          </a>

          {/* Desktop: sekcije u traci */}
          <div role="tablist" aria-label="Sekcije portala" className="hidden h-full min-w-0 flex-1 items-stretch gap-7 sm:flex">
            {SECTIONS.map((s) => {
              const active = view === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(s.id)}
                  className={cx(
                    "-mb-px flex shrink-0 items-center gap-2 border-b-2 text-[15px] font-medium transition-colors",
                    active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink"
                  )}
                >
                  {s.label}
                  <Count n={badges[s.id]} />
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-ink-2 md:block">
              {candidate.firstName} {candidate.lastName}
            </span>
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label={t("dash.logout")} className="h-10 w-10 px-0! md:w-auto md:px-3!">
              <LogoutIcon />
              <span className="hidden md:inline">{t("dash.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-8 sm:pt-10">
        <p className="mb-4 text-[15px] text-ink-2 sm:mb-5">Zdravo, {candidate.firstName}</p>
        <NowBlock next={next} />
      </div>
    </>
  );
}
