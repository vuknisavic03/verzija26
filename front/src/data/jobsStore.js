// front/src/data/jobsStore.js
// Katalog poslova. Vodi ga agencija na serveru; pregledač drži samo keš poslednjeg učitavanja
// (kandidat dobija samo poslove koji su mu ponuđeni). Demo lista se prikazuje samo u demo režimu.

import { DEMO_MODE } from "../config";
import defaultJobItems from "./jobItems";

const JOBS_CACHE_KEY = "aa_jobs_cache_v2";

function readCache() {
  try {
    const raw = localStorage.getItem(JOBS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* keš nije dostupan */
  }
  return DEMO_MODE ? defaultJobItems : [];
}

/** Upisuje listu poslova koju je vratio server (poziva ga sinhronizacija portala). */
export function setJobsCache(jobs) {
  if (!Array.isArray(jobs)) return;
  try {
    localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(jobs));
  } catch {
    /* keš nije dostupan */
  }
  window.dispatchEvent(new Event("aa_jobs_updated"));
}

export function getJobs() {
  return readCache();
}

export function getJobById(id) {
  return readCache().find((j) => String(j.id) === String(id)) || null;
}

async function postAction(action, payload) {
  const res = await fetch("/api/public/portal-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Čuvanje nije uspelo.");
  return data;
}

/** Agencija: dodaj ili izmeni posao. Vraća sačuvan posao (ID dodeljuje server). */
export async function saveJob(jobData) {
  const data = await postAction("saveJob", jobData);
  setJobsCache(data.jobs);
  return data.job;
}

/** Agencija: obriši posao. */
export async function deleteJob(id) {
  const data = await postAction("deleteJob", { id });
  setJobsCache(data.jobs);
  return data.jobs;
}

/**
 * Poslovi ponuđeni kandidatu. Kandidatov keš već sadrži samo njegove ponude; agencija (koja vidi
 * ceo katalog) ovde dobija suženi izbor ako je postavljen.
 */
export function getOfferedJobsForCandidate(candidate) {
  const allJobs = getJobs();
  if (!candidate) return allJobs;
  if (candidate.offerAllJobs === false && Array.isArray(candidate.offeredJobIds)) {
    return allJobs.filter((j) => candidate.offeredJobIds.includes(j.id));
  }
  return allJobs;
}
