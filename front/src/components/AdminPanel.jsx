import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useTranslation } from "../i18n/LanguageContext";
import { NAV, LogoutIcon } from "./admin/ui";
import OverviewSection from "./admin/OverviewSection";
import UsersSection from "./admin/UsersSection";
import JobsSection from "./admin/JobsSection";
import FinancesSection from "./FinancesSection";
import DiscountsSection from "./admin/DiscountsSection";
import SiteSection from "./admin/SiteSection";
import CommsSection from "./admin/CommsSection";
import ChatbotSection from "./admin/ChatbotSection";
import { cx } from "./ui";

/**
 * AdminPanel — portal agencije.
 *  desktop: bočna navigacija (Rad / Sajt), sadržaj desno
 *  telefon: kompaktna traka gore, glavne sekcije u donjoj navigaciji, ostalo iza "Više"
 */
const GROUPS = [
  { id: "work", label: "Rad" },
  { id: "site", label: "Sajt i komunikacija" },
];

function MoreIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

export default function AdminPanel({ onLogout = () => {}, onNavigate = () => {}, logoHref = "/" }) {
  const { t } = useTranslation();
  const [section, setSection] = useState("overview");
  const [openCandidateId, setOpenCandidateId] = useState(null);
  const [openTab, setOpenTab] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const navLabel = (item) => (item.labelKey && t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.defaultLabel || item.id);

  const select = (id) => {
    setSection(id);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    document.body.classList.add("has-bottom-nav");
    return () => document.body.classList.remove("has-bottom-nav");
  }, []);

  const goHome = (e) => {
    e.preventDefault();
    onNavigate(e, logoHref);
  };

  const renderSection = () => {
    switch (section) {
      case "overview":
        return (
          <OverviewSection
            onGoTo={select}
            onOpenCandidate={(id, tab) => {
              setOpenCandidateId(id);
              setOpenTab(tab || null);
              select("users");
            }}
          />
        );
      case "users":
        return <UsersSection openCandidateId={openCandidateId} openTab={openTab} onOpened={() => setOpenCandidateId(null)} />;
      case "jobs":
        return <JobsSection />;
      case "finances":
        return <FinancesSection />;
      case "discounts":
        return <DiscountsSection />;
      case "site":
        return <SiteSection />;
      case "comms":
        return <CommsSection />;
      case "chatbot":
        return <ChatbotSection />;
      default:
        return null;
    }
  };

  const mobileItems = NAV.filter((n) => n.mobile);
  const moreItems = NAV.filter((n) => !n.mobile);
  const moreActive = moreItems.some((n) => n.id === section);

  return (
    <div className="flex min-h-screen bg-white text-ink">
      {/* Bočna navigacija (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <a href={logoHref} onClick={goHome} aria-label={t("a11y.home")} className="flex items-center transition-opacity hover:opacity-80">
            <Logo className="h-9 w-auto" />
          </a>
          <span className="text-xs font-medium text-ink-3">Agencija</span>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <p className="px-3 pb-1.5 text-xs font-medium text-ink-3">{g.label}</p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === g.id).map((item) => {
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => select(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-surface font-semibold text-ink" : "font-medium text-ink-3 hover:bg-surface hover:text-ink"
                      )}
                    >
                      <item.Icon />
                      <span>{navLabel(item)}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface hover:text-ink"
          >
            <LogoutIcon />
            <span>{t("dash.logout")}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Traka (telefon) */}
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <a href={logoHref} onClick={goHome} aria-label={t("a11y.home")} className="flex items-center">
              <Logo className="h-8 w-auto" />
            </a>
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("dash.logout")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface"
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10 lg:px-10">
          <div className="mx-auto max-w-7xl">{renderSection()}</div>
        </main>
      </div>

      {/* Donja navigacija (telefon) */}
      <nav
        aria-label="Sekcije"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {mobileItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", active ? "text-ink" : "text-ink-3")}
              >
                <item.Icon className="h-6 w-6" />
                {navLabel(item)}
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cx("relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", moreActive ? "text-ink" : "text-ink-3")}
          >
            <MoreIcon />
            Više
            {moreActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
          </button>
        </div>
      </nav>

      {/* "Više" (telefon) */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <button type="button" aria-label="Zatvori" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-ink/40" />
          <div className="relative w-full rounded-t-2xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong" />
            {moreItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                className={cx(
                  "flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left text-[15px]",
                  section === item.id ? "bg-surface font-semibold text-ink" : "font-medium text-ink"
                )}
              >
                <item.Icon className="h-5 w-5 text-ink-3" />
                {navLabel(item)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
