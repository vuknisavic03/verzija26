// front/src/components/admin/OverviewSection.jsx
// Početna admina: šta danas čeka agenciju i gde su kandidati na putu.
import { useEffect, useMemo, useState } from "react";
import { getCandidates } from "../../data/candidateStore";
import { candidateQueue, isPreApplication, STAGE_OF, STAGES } from "./queue";
import { PageHeader, Card } from "./ui";
import { TaskIcon } from "../dashboard/ui";

const GROUP_ORDER = ["Ugovori za overu", "Uplate za knjiženje", "Dosijei za pregled", "Poslovi", "Viza", "Nove prijave"];

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

  const { groups, total, stageCounts, active, pre } = useMemo(() => {
    const g = {};
    let n = 0;
    const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
    let act = 0;
    let preCount = 0;
    list.forEach((c) => {
      const stage = STAGE_OF(c);
      if (stage === "pre") preCount += 1;
      else {
        counts[stage] = (counts[stage] || 0) + 1;
        act += 1;
      }
      candidateQueue(c).forEach((item) => {
        (g[item.group] ||= []).push({ ...item, candidate: c });
        n += 1;
      });
    });
    return { groups: g, total: n, stageCounts: counts, active: act, pre: preCount };
  }, [list]);

  const name = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || c.email;
  const today = new Date().toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <PageHeader title="Pregled" subtitle={today.charAt(0).toUpperCase() + today.slice(1)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Čeka tebe", total, true],
          ["Aktivni kandidati", active],
          ["Nove prijave", pre],
          ["Viza odobrena", stageCounts.ready],
        ].map(([label, value, accent]) => (
          <Card key={label} className="px-4 py-4 sm:px-5">
            <p className="text-[13px] text-ink-3">{label}</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
              {value}
              {accent && value > 0 && <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-ink">Čeka tebe</h2>
            <span className="text-[13px] text-ink-3">{total ? `${total} stavki` : "Sve je rešeno"}</span>
          </div>

          {total === 0 ? (
            <p className="mt-4 text-sm text-ink-3">Nema ničeg na čekanju. Novi zadaci se pojavljuju čim kandidat nešto pošalje.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => (
                <section key={g}>
                  <p className="text-[13px] font-medium text-ink-3">
                    {g} <span className="tabular-nums">· {groups[g].length}</span>
                  </p>
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {groups[g].map((item) => (
                      <li key={`${item.candidate.id}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => (isPreApplication(item.candidate) ? onGoTo("users") : onOpenCandidate(item.candidate.id))}
                          className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-surface"
                        >
                          <TaskIcon state="wait" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-ink">{name(item.candidate)}</span>
                            <span className="block truncate text-[13px] text-ink-3">{item.title}</span>
                          </span>
                          <span aria-hidden="true" className="text-ink-3">
                            →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Kandidati po koracima</h2>
          <ul className="mt-4 space-y-3">
            {STAGES.map((s) => {
              const v = stageCounts[s.id] || 0;
              const pct = active ? Math.round((v / active) * 100) : 0;
              return (
                <li key={s.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-2">{s.label}</span>
                    <span className="font-semibold tabular-nums text-ink">{v}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => onGoTo("users")}
            className="mt-5 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Svi kandidati
          </button>
        </Card>
      </div>
    </div>
  );
}
