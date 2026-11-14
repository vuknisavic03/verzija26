// front/src/components/admin/JobsSection.jsx
// Kartica "Baza poslova" na Admin portalu: pregled, dodavanje, izmena i brisanje radnih ponuda

import { useState, useMemo, useEffect } from "react";
import { PageHeader, Card, PlusIcon, SearchIcon, EditIcon, TrashIcon, Modal, Field, FIELD_CLS, PrimaryButton, SecondaryButton, GhostIconButton, EmptyState } from "./ui";
import { getJobs, saveJob, deleteJob } from "../../data/jobsStore";
import { getCandidates } from "../../data/candidateStore";

const EMPTY_JOB_FORM = {
  id: "",
  title: "",
  employer: "",
  category: "Ugostiteljstvo / Restoran",
  city: "",
  wage: "$16.00 / sat",
  hoursPerWeek: "35-40 h",
  housing: "Obezbeđen smeštaj ($120/ned)",
  period: "jun - septembar",
  englishLevel: "B2",
  summary: "",
  description: "",
};

const CATEGORIES = [
  "Bazen / Spasilačka služba",
  "Hotel / Domaćinstvo",
  "Restoran / Kuhinja",
  "Ugostiteljstvo / Posluživanje",
  "Trgovina / Prodaja",
  "Zabavni i nacionalni parkovi",
  "Ostalo",
];

export default function JobsSection() {
  const [jobs, setJobs] = useState(getJobs);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState(EMPTY_JOB_FORM);
  const [toastMessage, setToastMessage] = useState("");

  const refreshJobs = () => {
    setJobs(getJobs());
  };

  useEffect(() => {
    const handleUpdate = () => refreshJobs();
    window.addEventListener("aa_jobs_updated", handleUpdate);
    return () => window.removeEventListener("aa_jobs_updated", handleUpdate);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (categoryFilter !== "ALL" && j.category !== categoryFilter) return false;
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
  }, [jobs, categoryFilter, search]);

  const handleOpenAddModal = () => {
    setEditingJob(null);
    setForm(EMPTY_JOB_FORM);
    setModalOpen(true);
  };

  const handleOpenEditModal = (job) => {
    setEditingJob(job);
    setForm({
      id: job.id,
      title: job.title || "",
      employer: job.employer || "",
      category: job.category || "Ugostiteljstvo / Restoran",
      city: job.city || "",
      wage: job.wage || "",
      hoursPerWeek: job.hoursPerWeek || "35-40 h",
      housing: job.housing || "",
      period: job.period || "jun - septembar",
      englishLevel: job.englishLevel || "B2",
      summary: job.summary || "",
      description: job.description || "",
    });
    setModalOpen(true);
  };

  const handleDelete = (id, title) => {
    if (window.confirm(`Obrisati posao „${title}“?`)) {
      deleteJob(id);
      refreshJobs();
      showToast(`Posao „${title}“ je obrisan.`);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!form.title.trim() || !form.employer.trim() || !form.city.trim()) {
      showToast("Upiši poziciju, poslodavca i grad.");
      return;
    }

    const saved = saveJob(form);
    refreshJobs();
    setModalOpen(false);
    showToast(
      editingJob
        ? `Sačuvano: ${saved.title}.`
        : `Dodat posao: ${saved.title}.`
    );
  };

  const upd = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Koliko kandidata je izabralo koji posao
  const appliedCount = useMemo(() => {
    const m = {};
    getCandidates().forEach((c) => {
      if (!c.selectedJobTitle) return;
      const key = `${c.selectedJobEmployer}|${c.selectedJobTitle}`;
      m[key] = (m[key] || 0) + 1;
    });
    return m;
  }, [jobs]);

  const usedCategories = ["ALL", ...Array.from(new Set(jobs.map((j) => j.category).filter(Boolean)))];

  return (
    <>
      {toastMessage && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg md:bottom-8">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Poslovi"
        subtitle="Ponude poslodavaca koje kandidati vide u portalu."
        action={
          <PrimaryButton onClick={handleOpenAddModal}>
            <PlusIcon /> Dodaj posao
          </PrimaryButton>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pozicija, poslodavac ili grad"
            aria-label="Pretraga poslova"
            className="w-full rounded-full border border-line-strong bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3/70 focus:border-ink focus:outline-hidden"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {usedCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                categoryFilter === c ? "bg-ink text-white" : "text-ink-3 hover:bg-white hover:text-ink"
              }`}
            >
              {c === "ALL" ? `Svi · ${jobs.length}` : c}
            </button>
          ))}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState>Nema poslova za ovu pretragu.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[2fr_1.2fr_0.8fr_1.4fr_0.9fr_auto] gap-4 border-b border-line px-5 py-3 text-[13px] text-ink-3 lg:grid">
            <span>Pozicija</span>
            <span>Grad</span>
            <span>Satnica</span>
            <span>Smeštaj</span>
            <span>Prijavljeni</span>
            <span className="w-20" />
          </div>
          <ul className="divide-y divide-line">
            {filteredJobs.map((job) => {
              const applied = appliedCount[`${job.employer}|${job.title}`] || 0;
              return (
                <li key={job.id} className="relative grid gap-x-4 gap-y-1 px-5 py-4 lg:grid-cols-[2fr_1.2fr_0.8fr_1.4fr_0.9fr_auto] lg:items-center">
                  <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-ink">{job.title}</p>
                      <p className="truncate text-[13px] text-ink-3">
                        {job.employer} · {job.category}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink lg:hidden">{job.wage}</span>
                  </div>
                  <p className="truncate text-[13px] text-ink-2 lg:text-sm">
                    {job.city}
                    <span className="lg:hidden"> · {job.period} · {job.hoursPerWeek}</span>
                  </p>
                  <p className="hidden text-sm font-medium tabular-nums text-ink lg:block">{job.wage}</p>
                  <p className="truncate pr-20 text-[13px] text-ink-3 lg:pr-0 lg:text-sm lg:text-ink-2" title={job.housing}>
                    {job.housing}
                  </p>
                  <p className={`text-[13px] text-ink-3 lg:text-sm ${applied ? "" : "hidden lg:block"}`}>
                    {applied ? (
                      <span className="text-ink">
                        {applied} {applied === 1 ? "kandidat" : "kandidata"}
                      </span>
                    ) : (
                      <span className="lg:inline">—</span>
                    )}
                  </p>
                  <div className="absolute bottom-2.5 right-3 flex items-center justify-end gap-0.5 lg:static lg:-mr-2 lg:w-20">
                    <GhostIconButton label="Izmeni" onClick={() => handleOpenEditModal(job)}>
                      <EditIcon />
                    </GhostIconButton>
                    <GhostIconButton label="Obriši" danger onClick={() => handleDelete(job.id, job.title)}>
                      <TrashIcon />
                    </GhostIconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {modalOpen && (
        <Modal
          title={editingJob ? "Izmeni posao" : "Novi posao"}
          onClose={() => setModalOpen(false)}
          wide
          footer={
            <>
              <span />
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={() => setModalOpen(false)}>Otkaži</SecondaryButton>
                <PrimaryButton onClick={handleSubmit}>{editingJob ? "Sačuvaj" : "Dodaj posao"}</PrimaryButton>
              </div>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pozicija">
                <input value={form.title} onChange={upd("title")} placeholder="Spasilac na bazenu" className={FIELD_CLS} required />
              </Field>
              <Field label="Poslodavac">
                <input value={form.employer} onChange={upd("employer")} placeholder="Ocean Breeze Resort" className={FIELD_CLS} required />
              </Field>
              <Field label="Kategorija">
                <select value={form.category} onChange={upd("category")} className={FIELD_CLS}>
                  {Array.from(new Set([...CATEGORIES, form.category])).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Grad i država">
                <input value={form.city} onChange={upd("city")} placeholder="Ocean City, Maryland" className={FIELD_CLS} required />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Satnica">
                <input value={form.wage} onChange={upd("wage")} className={FIELD_CLS} />
              </Field>
              <Field label="Sati nedeljno">
                <input value={form.hoursPerWeek} onChange={upd("hoursPerWeek")} className={FIELD_CLS} />
              </Field>
              <Field label="Engleski">
                <select value={form.englishLevel} onChange={upd("englishLevel")} className={FIELD_CLS}>
                  {["B1", "B2", "C1", "C2"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Smeštaj">
                <input value={form.housing} onChange={upd("housing")} className={FIELD_CLS} />
              </Field>
              <Field label="Period">
                <input value={form.period} onChange={upd("period")} className={FIELD_CLS} />
              </Field>
            </div>

            <Field label="Kratak opis (vidi se na kartici)">
              <textarea rows={2} value={form.summary} onChange={upd("summary")} className={FIELD_CLS} />
            </Field>
            <Field label="Detaljan opis">
              <textarea rows={5} value={form.description} onChange={upd("description")} className={FIELD_CLS} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
