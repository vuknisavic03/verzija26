// front/src/components/admin/ChatbotSection.jsx
// Baza znanja: pitanja i odgovori koje koristi asistent na sajtu. Dodavanje, izmena i brisanje na jednom mestu.
import { useEffect, useMemo, useState } from "react";
import { syncFromBackend, saveFaqWithBackend } from "../../data/candidateStore";
import { SWT_FAQS } from "../../data/faq";
import { PageHeader, Card, Field, FIELD_CLS, PrimaryButton, SecondaryButton, PlusIcon, SearchIcon, GhostIconButton, EditIcon, TrashIcon, EmptyState } from "./ui";

const KEY = "aa_kb_v1";
const seed = () => SWT_FAQS.map((x, i) => ({ id: 1000 + i, q: x.q, a: x.a }));

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw && JSON.parse(raw);
    if (Array.isArray(list)) return list;
  } catch {}
  return seed();
}

function Editor({ initial, onCancel, onSave }) {
  const [q, setQ] = useState(initial?.q || "");
  const [a, setA] = useState(initial?.a || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim() && a.trim()) onSave({ q: q.trim(), a: a.trim() });
      }}
      className="space-y-4"
    >
      <Field label="Pitanje">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kako ga studenti pitaju" className={FIELD_CLS} autoFocus required />
      </Field>
      <Field label="Odgovor">
        <textarea value={a} onChange={(e) => setA(e.target.value)} rows={4} placeholder="Kratko i tačno — asistent odgovara baš ovim rečima." className={`${FIELD_CLS} leading-relaxed`} required />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <SecondaryButton onClick={onCancel}>Otkaži</SecondaryButton>
        <PrimaryButton type="submit">Sačuvaj</PrimaryButton>
      </div>
    </form>
  );
}

export default function ChatbotSection() {
  const [items, setItems] = useState(loadLocal);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    syncFromBackend().then((data) => {
      if (Array.isArray(data?.faqItems) && data.faqItems.length) setItems(data.faqItems);
    });
  }, []);

  const commit = async (next) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    await saveFaqWithBackend(next);
  };

  const q = query.trim().toLowerCase();
  const list = useMemo(() => items.filter((i) => !q || `${i.q} ${i.a}`.toLowerCase().includes(q)), [items, q]);

  return (
    <>
      <PageHeader
        title="Baza znanja"
        subtitle={`Odgovori koje asistent na sajtu daje posetiocima · ${items.length} pitanja`}
        action={
          editingId !== "new" && (
            <PrimaryButton onClick={() => setEditingId("new")}>
              <PlusIcon /> Novo pitanje
            </PrimaryButton>
          )
        }
      />

      {editingId === "new" && (
        <Card className="mb-4 p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Novo pitanje</h2>
          <Editor
            onCancel={() => setEditingId(null)}
            onSave={async (v) => {
              await commit([{ id: Date.now(), ...v }, ...items]);
              setEditingId(null);
            }}
          />
        </Card>
      )}

      <div className="relative mb-4 w-full sm:max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraži pitanja i odgovore"
          aria-label="Pretraga baze znanja"
          className="w-full rounded-full border border-line-strong bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3/70 focus:border-ink focus:outline-hidden"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState>{items.length ? "Nema rezultata." : "Baza je prazna. Dodaj prvo pitanje."}</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className="bg-surface px-5 py-5">
                  <Editor
                    initial={item}
                    onCancel={() => setEditingId(null)}
                    onSave={async (v) => {
                      await commit(items.map((i) => (i.id === item.id ? { ...i, ...v } : i)));
                      setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={item.id} className="flex items-start gap-3 px-5 py-4">
                  <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[15px] font-medium text-ink">{item.q}</span>
                    <span className={`mt-1 block text-sm leading-relaxed text-ink-3 ${openId === item.id ? "" : "line-clamp-2"}`}>{item.a}</span>
                  </button>
                  <div className="-mr-2 flex shrink-0 items-center">
                    <GhostIconButton label="Izmeni" onClick={() => setEditingId(item.id)}>
                      <EditIcon />
                    </GhostIconButton>
                    <GhostIconButton
                      label="Obriši"
                      danger
                      onClick={() => {
                        if (window.confirm(`Obrisati pitanje „${item.q}“?`)) commit(items.filter((i) => i.id !== item.id));
                      }}
                    >
                      <TrashIcon />
                    </GhostIconButton>
                  </div>
                </li>
              )
            )}
          </ul>
        </Card>
      )}
    </>
  );
}
