import { useState, useMemo } from "react";
import { getOfferedJobsForCandidate } from "../data/jobsStore";
import { Button, cx } from "./ui";
import Sheet, { SheetTabs } from "./dashboard/Sheet";

export default function JobFairModal(props) {
  if (!props.isOpen) return null;
  return <JobFair {...props} />;
}

function JobFair({ onClose, candidate, currentJobId = null, onSelectJob = () => {} }) {

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const jobsList = useMemo(() => {
    return getOfferedJobsForCandidate(candidate);
  }, [candidate]);

  const [viewingJob, setViewingJob] = useState(
    currentJobId ? jobsList.find((j) => j.id === currentJobId) || jobsList[0] : null
  );

  const categories = useMemo(() => {
    const set = new Set(jobsList.map((j) => j.category).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [jobsList]);

  const filteredJobs = useMemo(() => {
    return jobsList.filter((j) => {
      if (selectedCategory !== "ALL" && j.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (j.title || "").toLowerCase().includes(q);
        const matchEmployer = (j.employer || "").toLowerCase().includes(q);
        const matchCity = (j.city || "").toLowerCase().includes(q);
        const matchSummary = (j.summary || "").toLowerCase().includes(q);
        if (!matchTitle && !matchEmployer && !matchCity && !matchSummary) return false;
      }
      return true;
    });
  }, [jobsList, selectedCategory, search]);

  const handleApply = (job) => {
    onSelectJob(job);
    onClose();
  };

  const nav = (
    <div>
      <div className="px-4 pt-3 sm:px-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pozicija, poslodavac ili grad"
          aria-label="Pretraga poslova"
          className="w-full rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-base text-ink placeholder:text-ink-3/70 focus:border-ink focus:bg-white focus:outline-hidden sm:text-sm"
        />
      </div>
      {categories.length > 2 && (
        <SheetTabs
          tabs={categories.map((c) => ({ id: c, label: c === "ALL" ? "Sve" : c }))}
          active={selectedCategory}
          onChange={setSelectedCategory}
        />
      )}
      {categories.length <= 2 && <div className="h-3" />}
    </div>
  );

  return (
    <Sheet
      onClose={onClose}
      size="xl"
      title="Ponude poslova"
      subtitle="Izaberi posao — mi dogovaramo intervju sa poslodavcem."
      aside={<span className="text-[13px] text-ink-3">{filteredJobs.length} ponuda</span>}
      nav={nav}
      bodyClassName="bg-surface"
    >
      {filteredJobs.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">Nema ponuda za ovu pretragu.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filteredJobs.map((job) => {
            const isSelected = candidate?.selectedJobId === job.id || candidate?.selectedJobTitle === job.title;
            return (
              <li
                key={job.id}
                className={cx(
                  "flex flex-col rounded-2xl border bg-white p-4 sm:p-5",
                  isSelected ? "border-ink" : "border-line"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-3">{job.category || "Posao u SAD"}</p>
                    <h3 className="mt-0.5 text-[16px] font-semibold leading-snug text-ink">{job.title}</h3>
                    <p className="text-sm text-ink-2">{job.employer}</p>
                  </div>
                  <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink">{job.wage}</span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ["Grad", job.city],
                    ["Sati nedeljno", job.hoursPerWeek || "35–40"],
                    ["Smeštaj", job.housing],
                    ["Period", job.period || "Leto 2026"],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs text-ink-3">{k}</dt>
                      <dd className="truncate text-ink" title={v}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {job.summary && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{job.summary}</p>}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-[13px] text-ink-3">Engleski {job.englishLevel || "B2"}</span>
                  {isSelected ? (
                    <span className="text-[13px] font-medium text-ink">Izabrano</span>
                  ) : (
                    <Button variant="dark" size="sm" onClick={() => handleApply(job)}>
                      Prijavi se
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
