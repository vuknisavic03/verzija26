// front/src/components/admin/CommsSection.jsx
// Komunikacija: poruka grupi kandidata (e-mail ili SMS), gotovi šabloni i istorija poslatog.
import { useEffect, useMemo, useState } from "react";
import { syncFromBackend, saveAnnouncementWithBackend, getCandidates } from "../../data/candidateStore";
import { PageHeader, Card, Field, FIELD_CLS, PrimaryButton } from "./ui";
import { STAGE_OF } from "./queue";

const GROUPS = [
  { id: "active", label: "Svi u programu", match: (c) => STAGE_OF(c) !== "pre" },
  { id: "reg", label: "Registracija", match: (c) => STAGE_OF(c) === "reg" },
  { id: "docs", label: "Korak 1", match: (c) => STAGE_OF(c) === "docs" },
  { id: "job", label: "Korak 2", match: (c) => STAGE_OF(c) === "job" },
  { id: "visa", label: "Korak 3", match: (c) => STAGE_OF(c) === "visa" },
  { id: "ready", label: "Viza odobrena", match: (c) => STAGE_OF(c) === "ready" },
  { id: "pre", label: "Nove prijave", match: (c) => STAGE_OF(c) === "pre" },
];
// Stari zapisi u istoriji čuvaju id statusa — prevodimo ih u čitljiv naziv.
const LEGACY_TO = { all: "Svi", review: "Registracija", docs: "Korak 1", job: "Korak 2", departure: "Korak 3", ready: "Viza odobrena" };

const TEMPLATES = [
  {
    id: "docs",
    label: "Podsetnik za dokumenta",
    group: "docs",
    subject: "Podsetnik: dokumenta za Korak 1",
    message: "Zdravo {ime},\n\npodsećamo te da u portalu okačiš CV, video i oba uverenja, pa pošalješ dosije na pregled. Što pre to uradiš, pre biraš posao.\n\nAmerican Adventure",
  },
  {
    id: "pay",
    label: "Podsetnik za uplatu",
    group: "active",
    subject: "Podsetnik: uplata rate",
    message: "Zdravo {ime},\n\nu portalu, pod Uplate, imaš uplatnicu sa IPS QR kodom. Kad platiš, klikni „Prijavi uplatu“ da bismo je brže proknjižili.\n\nAmerican Adventure",
  },
  {
    id: "jobs",
    label: "Nove ponude poslova",
    group: "job",
    subject: "Nove ponude poslova u portalu",
    message: "Zdravo {ime},\n\nu portalu su nove ponude poslova. Pogledaj ih i izaberi onu koja ti odgovara — mi dogovaramo razgovor sa poslodavcem.\n\nAmerican Adventure",
  },
  {
    id: "embassy",
    label: "Priprema za ambasadu",
    group: "visa",
    subject: "Priprema za razgovor u ambasadi",
    message: "Zdravo {ime},\n\nza razgovor u ambasadi ponesi pasoš, DS-2019, SEVIS potvrdu, uverenje sa fakulteta sa prevodom i indeks. Javi se ako želiš još jedan probni razgovor.\n\nAmerican Adventure",
  },
];

export default function CommsSection() {
  const [mode, setMode] = useState("email");
  const [group, setGroup] = useState("active");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [recentList, setRecentList] = useState([
    { id: 1, channel: "E-mail", subject: "Dobrodošli u program 2026", to: "Svi u programu", date: "03.06." },
    { id: 2, channel: "SMS", subject: "Podsetnik: dokumentacija za vizu", to: "Korak 3", date: "01.06." },
    { id: 3, channel: "E-mail", subject: "Potrebna dopuna uverenja", to: "Korak 1", date: "28.05." },
  ]);

  useEffect(() => {
    syncFromBackend().then((data) => {
      if (Array.isArray(data?.announcements) && data.announcements.length) setRecentList(data.announcements);
    });
  }, []);

  const candidates = useMemo(() => getCandidates(), []);
  const counts = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, candidates.filter(g.match).length])),
    [candidates]
  );
  const groupLabel = GROUPS.find((g) => g.id === group)?.label || "";
  const sms = mode === "sms";
  const smsParts = Math.max(1, Math.ceil(message.length / 160));

  const useTemplate = (t) => {
    setGroup(t.group);
    setSubject(t.subject);
    setMessage(t.message);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim() || (!sms && !subject.trim())) return;
    const item = {
      id: Date.now(),
      channel: sms ? "SMS" : "E-mail",
      subject: sms ? message.slice(0, 40) + (message.length > 40 ? "…" : "") : subject,
      message,
      to: groupLabel,
      count: counts[group],
      date: new Date().toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit" }),
    };
    setRecentList((prev) => [item, ...prev]);
    await saveAnnouncementWithBackend(item);
    setSubject("");
    setMessage("");
    setToast(`Poslato: ${item.channel}, ${groupLabel} (${counts[group]}).`);
    setTimeout(() => setToast(""), 4000);
  };

  return (
    <>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg md:bottom-8">
          {toast}
        </div>
      )}

      <PageHeader title="Komunikacija" subtitle="Poruka grupi kandidata, e-mailom ili SMS-om." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 p-5 sm:p-6">
          <form onSubmit={submit} className="space-y-6">
            <div className="inline-flex rounded-full border border-line p-1">
              {[
                ["email", "E-mail"],
                ["sms", "SMS"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${mode === id ? "bg-ink text-white" : "text-ink-3 hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-[13px] font-medium text-ink">Kome</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroup(g.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      group === g.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2 hover:border-ink/40"
                    }`}
                  >
                    {g.label} <span className={group === g.id ? "text-white/60" : "text-ink-3"}>{counts[g.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[13px] font-medium text-ink">Šabloni</p>
              <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => useTemplate(t)}
                    className="shrink-0 rounded-xl border border-dashed border-line-strong px-3.5 py-2 text-[13px] text-ink-2 hover:border-ink/40 hover:text-ink"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {!sms && (
              <Field label="Naslov">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={FIELD_CLS} required />
              </Field>
            )}

            <div>
              <Field label="Poruka">
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={sms ? 4 : 9} className={`${FIELD_CLS} leading-relaxed`} required />
              </Field>
              <p className="mt-1.5 flex justify-between gap-3 text-xs text-ink-3">
                <span>
                  <span className="font-medium text-ink-2">{"{ime}"}</span> se menja imenom kandidata.
                </span>
                {sms && (
                  <span className={message.length > 160 ? "text-amber-700" : ""}>
                    {message.length} znakova · {smsParts} SMS
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-ink-3">
                Ide na <span className="font-medium text-ink">{counts[group]}</span> {counts[group] === 1 ? "kandidata" : "kandidata"} · {groupLabel}
              </p>
              <PrimaryButton type="submit" disabled={!counts[group]}>
                Pošalji {sms ? "SMS" : "e-mail"}
              </PrimaryButton>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Poslato</h2>
          {recentList.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">Još ništa nije poslato.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recentList.map((r, idx) => (
                <li key={r.id || idx}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(r.channel === "SMS" ? "sms" : "email");
                      setSubject(r.channel === "SMS" ? "" : r.subject);
                      setMessage(r.message || "");
                    }}
                    className="w-full py-3 text-left"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-ink">{r.subject}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-3">{r.date}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-3">
                      {r.channel} · {LEGACY_TO[r.to] || r.to}
                      {r.count != null && ` · ${r.count}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">Klik na poruku je vraća u editor, da je pošalješ ponovo.</p>
        </Card>
      </div>
    </>
  );
}
