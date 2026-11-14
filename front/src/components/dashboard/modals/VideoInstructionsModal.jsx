// front/src/components/dashboard/modals/VideoInstructionsModal.jsx
// Kako da snimiš video predstavljanje — uputstvo agencije, podeljeno na kratke odeljke.
import { useState } from "react";
import { Button } from "../../ui";
import Sheet, { SheetTabs, SheetSection, SheetFooter } from "../Sheet";

const RULES = [
  ["Trajanje", "Najviše 2 minuta. Idealno 60–90 sekundi."],
  ["Odeća", "Kao za sastanak sa direktorom: košulja ili bluza, farmerke, cipele."],
  ["Govor", "Polako i razgovetno — poslodavac treba da razume svaku reč."],
  ["Osmeh", "Stalno. U Americi je to znak motivacije i ljubaznosti."],
];

const MUST = [
  ["Ko si", "Ime, prezime, grad, fakultet."],
  ["Iskustvo", "Ako si već bio na Work and Travel-u, obavezno to reci. Ako nisi — posao u Srbiji ili inostranstvu."],
  ["Bez iskustva?", "Volontiranje, organizacija studentskih ili školskih događaja."],
];

const EXTRA = [
  "Šta ti znači Work and Travel i zašto ideš?",
  "Šta želiš da Amerikanci nauče o našoj kulturi?",
  "Koje su tvoje prednosti? (konkretno, ne samo „komunikativnost“)",
  "Koji su tvoji ciljevi u karijeri?",
  "Zašto bi poslodavac zaposlio baš tebe?",
  "Šta će ti biti najveći izazov u Americi?",
  "Čemu se najviše raduješ u Americi?",
  "Tri stvari koje bi strancima preporučio u Srbiji?",
  "Kako bi te opisali prijatelji?",
  "Omiljeni američki film ili serija i zašto?",
  "Kako se pravi tvoje omiljeno srpsko jelo?",
  "Da li treniraš neki sport, koji ti je omiljeni tim?",
];

const EXAMPLES = [
  ["Primer 2", "https://youtu.be/PhtfiddS9P8"],
  ["Primer 3", "https://youtu.be/GN8l0aBMz5I"],
  ["Primer 4", "https://youtu.be/gxBT9ZUC93w"],
  ["Primer 5", "https://youtu.be/ZULkNRep1HA"],
];

const TABS = [
  { id: "pravila", label: "Pravila" },
  { id: "sadrzaj", label: "Šta da kažeš" },
  { id: "primeri", label: "Primeri" },
];

function Rows({ items }) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
          <dt className="shrink-0 text-sm font-medium text-ink sm:w-32">{k}</dt>
          <dd className="text-sm leading-relaxed text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function VideoInstructionsModal({ isOpen, onClose }) {
  const [tab, setTab] = useState("pravila");
  if (!isOpen) return null;

  return (
    <Sheet
      onClose={onClose}
      title="Kako da snimiš video"
      subtitle="Uputstvo agencije za video predstavljanje"
      nav={<SheetTabs tabs={TABS} active={tab} onChange={setTab} />}
      footer={
        <SheetFooter
          left={
            <a
              href="/documents/AA_Instrukcija_za_video_CV.pdf"
              download="AA_Instrukcija_za_video_CV.pdf"
              className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Uputstvo (PDF)
            </a>
          }
        >
          <Button variant="primary" onClick={onClose}>
            Razumem
          </Button>
        </SheetFooter>
      }
    >
      {tab === "pravila" && <Rows items={RULES} />}

      {tab === "sadrzaj" && (
        <div className="space-y-8">
          <SheetSection title="Obavezno">
            <Rows items={MUST} />
          </SheetSection>

          <SheetSection title="Izaberi 3–5 pitanja" hint="Ne odgovaraj na sva — samo ona o kojima imaš šta da kažeš.">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {EXTRA.map((q) => (
                <li key={q} className="px-4 py-3 text-sm text-ink-2">
                  {q}
                </li>
              ))}
            </ul>
          </SheetSection>

          <SheetSection title="Završi ovim pitanjem">
            <p className="rounded-xl bg-ink px-4 py-3.5 text-[15px] font-medium text-white">
              „Šta još kompanija koja te zapošljava treba da zna o tebi?“
            </p>
          </SheetSection>
        </div>
      )}

      {tab === "primeri" && (
        <div className="space-y-4">
          <iframe
            src="https://www.youtube.com/embed/5nfIF6QW3RM"
            title="Primer video predstavljanja"
            className="aspect-video w-full rounded-xl border border-line bg-ink"
            allowFullScreen
          />
          <ul className="divide-y divide-line rounded-xl border border-line">
            {EXAMPLES.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink hover:bg-surface"
                >
                  {label}
                  <span aria-hidden="true" className="text-ink-3">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
