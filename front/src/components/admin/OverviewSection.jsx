// front/src/components/admin/OverviewSection.jsx
// Početna agencije: jedna radna lista „Čeka tebe". Klik otvara dosije tačno na kartici gde je posao.
// Ispod, u jednom redu: koliko je kandidata na kom koraku.
import { useEffect, useMemo, useState } from "react";
import { getCandidates } from "../../data/candidateStore";
import { candidateQueue, isPreApplication, STAGE_OF, STAGES } from "./queue";
import { TaskIcon, Chevron } from "../dashboard/ui";
import { CheckIcon } from "../ui";

const GROUP_ORDER = ["Dokumenta za proveru", "Uplate za knjiženje", "Poslovi", "Viza", "Nove prijave"];

export default function OverviewSection({ onOpenCandidate, onGoTo }) {
  const [list, setList] = useState(getCandidates);

  useEffect(() => {
    const refresh = () => setList(getCandidates());
    window.addEventListener("aa_candidate_updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("aa_candidate_updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const { groups, total, stageCounts } = useMemo(() => {
    const g = {};
    let n = 0;
    const counts = Object.fromEntries([["pre", 0], ...STAGES.map((s) => [s.id, 0])]);
    list.forEach((c) => {
      counts[STAGE_OF(c)] = (counts[STAGE_OF(c)] || 0) + 1;
      candidateQueue(c).forEach((item) => {
        (g[item.group] ||= []).push({ ...item, candidate: c });
        n += 1;
      });
    });
    return { groups: g, total: n, stageCounts: counts };
  }, [list]);

  const name = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || c.email;
  const stageLabel = (c) => STAGES.find((s) => s.id === STAGE_OF(c))?.label || "Nova prijava";
  const today = new Date().toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[15px] text-ink-3">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
      <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-ink sm:text-[36px]">
        {total ? `Čeka te ${total} ${total === 1 ? "stavka" : total < 5 ? "stavke" : "stavki"}` : "Sve je rešeno"}
      </h1>
      {!total && (
        <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-2">
          <CheckIcon className="h-4 w-4" strokeWidth={3} />
          Novi zadaci se pojavljuju čim kandidat nešto pošalje.
        </p>
      )}

      {total > 0 && (
        <div className="mt-10 space-y-10">
          {GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => (
            <section key={g}>
              <h2 className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-ink-3">
                {g}
                <span className="font-sign text-[15px] font-semibold text-ink">{groups[g].length}</span>
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {groups[g].map((item) => (
                  <li key={`${item.candidate.id}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        isPreApplication(item.candidate) ? onGoTo("users") : onOpenCandidate(item.candidate.id, item.tab)
                      }
                      className="group flex w-full items-center gap-3 py-3.5 text-left"
                    >
                      <TaskIcon state="wait" />
                      <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                        <span className="block truncate text-[15px] font-medium text-ink sm:w-52 sm:shrink-0">{name(item.candidate)}</span>
                        <span className="block truncate text-[13px] text-ink-2 sm:text-[15px]">{item.title}</span>
                      </span>
                      <span className="hidden shrink-0 text-[13px] text-ink-3 md:inline">{stageLabel(item.candidate)}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-3 group-hover:text-ink">
                        Otvori
                        <Chevron side />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-ink-3">
          Kandidati po koracima
          <button
            type="button"
            onClick={() => onGoTo("users")}
            className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Svi kandidati
          </button>
        </h2>
        <ul className="grid grid-cols-3 border-y border-line sm:grid-cols-6">
          {[{ id: "pre", label: "Nove prijave" }, ...STAGES].map((s) => (
            <li key={s.id} className="border-line py-4 pr-3 [&:not(:first-child)]:sm:border-l [&:not(:first-child)]:sm:pl-4">
              <p className="font-sign text-[26px] font-semibold leading-none text-ink">{stageCounts[s.id] || 0}</p>
              <p className="mt-1.5 text-[13px] leading-snug text-ink-3">{s.label}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
