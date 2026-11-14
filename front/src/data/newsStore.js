// front/src/data/newsStore.js
// Vesti koje admin kači i menja iz sekcije "Sajt". Početni sadržaj je u data/news.js;
// čim admin nešto sačuva, cela lista se čuva lokalno i šalje backendu.
import seed from "./news";
import { saveSiteContentWithBackend } from "./candidateStore/siteAndComms";

const KEY = "aa_news_v1";
export const NEWS_CATEGORIES = ["Prijave", "Vodič", "Programi", "Amerika"];

export function getNews() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return seed;
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event("aa_news_updated"));
  saveSiteContentWithBackend("news", "Vesti", JSON.stringify(list)).catch(() => {});
  return list;
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function todayLabel() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}.`;
}

/** Čuva vest (nova ili izmena). originalSlug: slug pre izmene. */
export function saveNewsItem(item, originalSlug = null) {
  const list = getNews();
  let slug = item.slug || slugify(item.title);
  const taken = (s) => list.some((n) => n.slug === s && n.slug !== originalSlug);
  let i = 2;
  const base = slug;
  while (taken(slug)) slug = `${base}-${i++}`;
  const clean = { ...item, slug };
  const idx = originalSlug ? list.findIndex((n) => n.slug === originalSlug) : -1;
  const next = idx >= 0 ? list.map((n, k) => (k === idx ? clean : n)) : [clean, ...list];
  persist(next);
  return clean;
}

export function deleteNewsItem(slug) {
  persist(getNews().filter((n) => n.slug !== slug));
}

export function resetNews() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("aa_news_updated"));
}
