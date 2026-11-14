// front/src/components/admin/SiteSection.jsx
// Sajt = vesti (blog). Lista svih objava, pretraga, i editor za novu ili postojeću vest sa pregledom uživo.
import { useEffect, useMemo, useRef, useState } from "react";
import { getNews, saveNewsItem, deleteNewsItem, slugify, todayLabel, NEWS_CATEGORIES } from "../../data/newsStore";
import { readFileAsDataUrl } from "../../data/candidateStore";
import NewsImage from "../NewsImage";
import { renderInline, blockOf } from "../richText";
import { PageHeader, Card, PlusIcon, SearchIcon, EditIcon, TrashIcon, Modal, Field, FIELD_CLS, PrimaryButton, SecondaryButton, GhostIconButton, EmptyState } from "./ui";

const textFromBody = (item) => (Array.isArray(item?.body?.SR) ? item.body.SR.join("\n\n") : "");
const bodyFromText = (text) =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

const EMPTY = { title: "", category: "Vodič", date: "", excerpt: "", image: "", theme: "plane", slug: "", text: "" };

/* ---------- Pregled vesti (kao na sajtu, umanjeno) ---------- */
function Preview({ f }) {
  const paragraphs = bodyFromText(f.text);
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="bg-brand px-5 pb-6 pt-5">
        <p className="text-xs font-semibold text-ink/70">
          Novosti · {f.category || "Rubrika"} · {f.date || todayLabel()}
        </p>
        <h1 className="font-display mt-3 text-2xl font-extrabold leading-[1.05] text-ink">{f.title || "Naslov vesti"}</h1>
      </div>
      <NewsImage key={f.image} src={f.image} theme={f.theme} alt="" className="aspect-[16/9] w-full" />
      <div className="space-y-3 px-5 py-5 text-[15px] leading-relaxed text-ink">
        {f.excerpt && <p className="text-ink-3">{f.excerpt}</p>}
        {paragraphs.length === 0 && <p className="text-ink-3">Tekst vesti se pojavljuje ovde dok pišeš.</p>}
        {paragraphs.map((p, i) => {
          const [kind, text] = blockOf(p);
          if (kind === "h1") return <h2 key={i} className="font-display pt-3 text-xl font-extrabold">{renderInline(text)}</h2>;
          if (kind === "h2") return <h3 key={i} className="font-display pt-2 text-lg font-extrabold">{renderInline(text)}</h3>;
          if (kind === "li")
            return (
              <p key={i} className="flex gap-3">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-brand ring-2 ring-ink" aria-hidden="true" />
                <span>{renderInline(text)}</span>
              </p>
            );
          return (
            <p key={i} className={i === 0 ? "text-[17px]" : "text-ink/85"}>
              {renderInline(text)}
            </p>
          );
        })}
      </div>
    </article>
  );
}

/* ---------- Editor ---------- */
function NewsEditor({ item, onClose, onSaved }) {
  const isNew = !item;
  const [f, setF] = useState(() =>
    item
      ? { ...EMPTY, ...item, text: textFromBody(item) }
      : { ...EMPTY, date: todayLabel() }
  );
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [tab, setTab] = useState("edit"); // telefon: edit | preview
  const [error, setError] = useState("");
  const textRef = useRef(null);
  const fileRef = useRef(null);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Istorija teksta za "Poništi" (kucanje se grupiše, svaka akcija iz trake je poseban korak).
  const history = useRef([]);
  const lastPush = useRef(0);
  const pushHistory = (value, force = false) => {
    const now = Date.now();
    if (!force && now - lastPush.current < 800) return;
    lastPush.current = now;
    const h = history.current;
    if (h[h.length - 1] !== value) h.push(value);
    if (h.length > 100) h.shift();
  };
  const [canUndo, setCanUndo] = useState(false);

  const setText = (next, sel) => {
    setF((p) => ({ ...p, text: next }));
    setCanUndo(history.current.length > 0);
    if (sel)
      requestAnimationFrame(() => {
        const el = textRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(sel[0], sel[1]);
      });
  };

  const onTextChange = (e) => {
    pushHistory(f.text);
    setText(e.target.value);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (prev === undefined) return;
    setF((p) => ({ ...p, text: prev }));
    setCanUndo(history.current.length > 0);
    lastPush.current = 0;
    requestAnimationFrame(() => textRef.current?.focus());
  };

  // **podebljano** / *iskošeno* oko izabranog teksta (ponovni klik uklanja oznaku)
  const wrap = (mark) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    pushHistory(value, true);
    const sel = value.slice(a, b);
    const n = mark.length;
    if (value.slice(a - n, a) === mark && value.slice(b, b + n) === mark) {
      return setText(value.slice(0, a - n) + sel + value.slice(b + n), [a - n, b - n]);
    }
    if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * n) {
      const inner = sel.slice(n, -n);
      return setText(value.slice(0, a) + inner + value.slice(b), [a, a + inner.length]);
    }
    const word = sel || (mark === "**" ? "podebljano" : "iskošeno");
    setText(value.slice(0, a) + mark + word + mark + value.slice(b), [a + n, a + n + word.length]);
  };

  // Naslov I ("# ") / Naslov II ("## ") za red u kome je kursor (ponovni klik ga vraća u pasus)
  const heading = (level) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, value } = el;
    pushHistory(value, true);
    const start = value.lastIndexOf("\n", a - 1) + 1;
    const endIdx = value.indexOf("\n", a);
    const end = endIdx === -1 ? value.length : endIdx;
    const line = value.slice(start, end);
    const bare = line.replace(/^(#{1,2} |• )/, "");
    const prefix = level === 1 ? "# " : "## ";
    const next = line.startsWith(prefix) ? bare : prefix + bare;
    setText(value.slice(0, start) + next + value.slice(end), [start + next.length, start + next.length]);
  };

  const onKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (k === "b") {
      e.preventDefault();
      wrap("**");
    } else if (k === "i") {
      e.preventDefault();
      wrap("*");
    }
  };

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setF((p) => ({ ...p, image: dataUrl }));
    e.target.value = "";
  };

  const save = (e) => {
    e?.preventDefault?.();
    if (!f.title.trim()) return setError("Upiši naslov.");
    if (!bodyFromText(f.text).length) return setError("Napiši tekst vesti.");
    const { text, ...rest } = f;
    const saved = saveNewsItem(
      {
        ...rest,
        title: f.title.trim(),
        excerpt: f.excerpt.trim(),
        slug: slugTouched ? slugify(f.slug) : slugify(f.title),
        date: f.date.trim() || todayLabel(),
        body: { ...(item?.body || {}), SR: bodyFromText(text) },
      },
      item?.slug || null
    );
    onSaved(saved, isNew);
  };

  const categories = Array.from(new Set([...NEWS_CATEGORIES, f.category].filter(Boolean)));

  const form = (
    <form onSubmit={save} className="space-y-5">
      <Field label="Naslov">
        <input value={f.title} onChange={set("title")} placeholder="npr. Počele prijave za sezonu 2027" className={`${FIELD_CLS} text-base font-medium`} autoFocus={isNew} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rubrika">
          <select value={f.category} onChange={set("category")} className={FIELD_CLS}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Datum">
          <input value={f.date} onChange={set("date")} placeholder={todayLabel()} className={FIELD_CLS} />
        </Field>
      </div>

      <Field label="Kratak opis (vidi se u listi vesti)">
        <textarea rows={2} value={f.excerpt} onChange={set("excerpt")} className={FIELD_CLS} />
      </Field>

      <div>
        <span className="block text-[13px] font-medium text-ink">Naslovna slika</span>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line">
            <NewsImage key={f.image} src={f.image} theme={f.theme} alt="" className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Izaberi sliku
              </button>
              {f.image && (
                <button type="button" onClick={() => setF((p) => ({ ...p, image: "" }))} className="text-[13px] font-medium text-ink-3 hover:text-ink">
                  Ukloni
                </button>
              )}
            </div>
            <input
              value={f.image?.startsWith("data:") ? "" : f.image}
              onChange={set("image")}
              placeholder={f.image?.startsWith("data:") ? "Slika je izabrana sa računara" : "ili nalepi link: /news/slika.jpg"}
              className={`${FIELD_CLS} py-2 text-[13px]`}
            />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-3">
          <span className="block pb-1.5 text-[13px] font-medium text-ink">Tekst</span>
          <div className="flex items-center rounded-lg border border-line-strong bg-white p-0.5" role="toolbar" aria-label="Formatiranje">
            {[
              ["B", "Podebljano (⌘B)", () => wrap("**"), "font-bold"],
              ["I", "Iskošeno (⌘I)", () => wrap("*"), "italic font-serif"],
              ["H1", "Naslov I", () => heading(1), "font-semibold"],
              ["H2", "Naslov II", () => heading(2), "font-semibold"],
            ].map(([label, title, fn, cls]) => (
              <button
                key={label}
                type="button"
                title={title}
                aria-label={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={fn}
                className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] text-ink hover:bg-surface ${cls}`}
              >
                {label}
              </button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
            <button
              type="button"
              title="Poništi (⌘Z)"
              aria-label="Poništi"
              onMouseDown={(e) => e.preventDefault()}
              onClick={undo}
              disabled={!canUndo}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-surface disabled:text-ink-3/50 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7.5 5L4 8.5 7.5 12" />
                <path d="M4 8.5h8a4 4 0 0 1 0 8H9" />
              </svg>
            </button>
          </div>
        </div>
        <textarea
          ref={textRef}
          rows={14}
          value={f.text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          placeholder={"Svaki pasus u svom redu.\nIzaberi reč pa klikni B ili I; za naslov stani u red i klikni H1 ili H2."}
          className={`${FIELD_CLS} mt-1.5 font-[inherit] leading-relaxed`}
        />
        <p className="mt-1.5 text-xs text-ink-3">Svaki red je poseban pasus; prvi se na sajtu prikazuje krupnije. **tekst** je podebljano, *tekst* iskošeno.</p>
      </div>

      <details className="rounded-xl border border-line px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-medium text-ink">Napredno</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Adresa vesti">
            <input
              value={slugTouched ? f.slug : slugify(f.title)}
              onChange={(e) => {
                setSlugTouched(true);
                setF((p) => ({ ...p, slug: e.target.value }));
              }}
              className={`${FIELD_CLS} text-[13px]`}
            />
          </Field>
          <Field label="Ikonica kad nema slike">
            <select value={f.theme} onChange={set("theme")} className={FIELD_CLS}>
              <option value="plane">Avion</option>
              <option value="document">Dokument</option>
              <option value="school">Škola</option>
            </select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-3">Sajt: /novosti/{slugTouched ? slugify(f.slug) : slugify(f.title) || "…"}</p>
      </details>

      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </form>
  );

  return (
    <Modal
      title={isNew ? "Nova vest" : "Izmeni vest"}
      onClose={onClose}
      panel
      bodyClassName="flex min-h-0 flex-1 flex-col"
      footer={
        <>
          <span className="hidden text-[13px] text-ink-3 sm:block">{isNew ? "Vest se objavljuje čim sačuvaš." : "Izmene su odmah vidljive na sajtu."}</span>
          <div className="ml-auto flex items-center gap-2">
            <SecondaryButton onClick={onClose}>Otkaži</SecondaryButton>
            <PrimaryButton onClick={save}>{isNew ? "Objavi" : "Sačuvaj"}</PrimaryButton>
          </div>
        </>
      }
    >
      {/* Telefon: Uredi / Pregled */}
      <div className="flex gap-1 border-b border-line px-4 py-2.5 lg:hidden">
        {[
          ["edit", "Uredi"],
          ["preview", "Pregled"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === id ? "bg-ink text-white" : "text-ink-3"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className={`min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 ${tab === "edit" ? "" : "hidden lg:block"}`}>{form}</div>
        <div className={`min-h-0 overflow-y-auto border-line bg-surface px-4 py-5 sm:px-6 sm:py-6 lg:border-l ${tab === "preview" ? "" : "hidden lg:block"}`}>
          <p className="mb-3 text-[13px] text-ink-3">Pregled</p>
          <Preview f={f} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Lista ---------- */
export default function SiteSection() {
  const [items, setItems] = useState(getNews);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Sve");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [toast, setToast] = useState("");

  useEffect(() => {
    const refresh = () => setItems(getNews());
    window.addEventListener("aa_news_updated", refresh);
    return () => window.removeEventListener("aa_news_updated", refresh);
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const cats = ["Sve", ...Array.from(new Set(items.map((n) => n.category).filter(Boolean)))];
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      items.filter(
        (n) => (cat === "Sve" || n.category === cat) && (!q || `${n.title} ${n.excerpt} ${n.category}`.toLowerCase().includes(q))
      ),
    [items, cat, q]
  );

  return (
    <>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[90] mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg md:bottom-8">
          {toast}
        </div>
      )}

      <PageHeader
        title="Sajt"
        subtitle={`Vesti na sajtu · ${items.length} objava`}
        action={
          <PrimaryButton onClick={() => setEditing("new")}>
            <PlusIcon /> Nova vest
          </PrimaryButton>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži vesti"
            aria-label="Pretraga vesti"
            className="w-full rounded-full border border-line-strong bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3/70 focus:border-ink focus:outline-hidden"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                cat === c ? "bg-ink text-white" : "text-ink-3 hover:bg-white hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>Nema vesti za ovu pretragu.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.slug} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <button type="button" onClick={() => setEditing(n)} className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-line sm:h-16 sm:w-28">
                  <NewsImage src={n.image} theme={n.theme} alt="" className="h-full w-full" />
                </button>
                <button type="button" onClick={() => setEditing(n)} className="min-w-0 flex-1 text-left">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{n.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">
                    {n.category} · {n.date}
                  </span>
                </button>
                <div className="-mr-2 flex shrink-0 items-center">
                  <a
                    href={`/novosti/${n.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Otvori na sajtu"
                    title="Otvori na sajtu"
                    className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink sm:flex"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                    </svg>
                  </a>
                  <GhostIconButton label="Izmeni" onClick={() => setEditing(n)}>
                    <EditIcon />
                  </GhostIconButton>
                  <GhostIconButton
                    label="Obriši"
                    danger
                    onClick={() => {
                      if (window.confirm(`Obrisati vest „${n.title}“? Nestaje sa sajta.`)) {
                        deleteNewsItem(n.slug);
                        flash("Vest je obrisana.");
                      }
                    }}
                  >
                    <TrashIcon />
                  </GhostIconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && (
        <NewsEditor
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            flash(isNew ? `Objavljeno: ${saved.title}` : "Izmene su sačuvane.");
          }}
        />
      )}
    </>
  );
}
