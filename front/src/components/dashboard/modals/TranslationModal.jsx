// front/src/components/dashboard/modals/TranslationModal.jsx
// Pregled prevoda na engleski (uverenje sa fakulteta / MUP uverenje) i preuzimanje PDF-a.
import { Button } from "../../ui";
import Sheet, { SheetTabs, SheetFooter } from "../Sheet";
import {
  openPrintableTranslationWindow,
  getTranslatedFacultyName,
  getTranslatedStudyYear,
} from "../../../data/candidateStore";

const TABS = [
  { id: "faculty", label: "Uverenje sa fakulteta" },
  { id: "police", label: "MUP uverenje" },
];

function Doc({ heading, sub, rows, quote, reg }) {
  return (
    <article className="rounded-xl border border-line bg-[#fcfbf9] px-5 py-6 font-serif text-[14px] leading-relaxed text-ink sm:px-8 sm:py-8">
      <header className="text-center">
        <p className="font-sans text-[13px] font-semibold tracking-wide text-ink">{heading}</p>
        <p className="mt-1 font-sans text-xs text-ink-3">{sub}</p>
      </header>
      <dl className="mt-6 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-0.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="font-sans text-xs text-ink-3 sm:text-[13px]">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {quote && <blockquote className="mt-5 border-l-2 border-ink/20 pl-4 italic text-ink-2">{quote}</blockquote>}
      <footer className="mt-6 flex flex-col gap-1 border-t border-line pt-3 font-sans text-xs text-ink-3 sm:flex-row sm:justify-between">
        <span>Certified by Official Court Interpreter for English, Republic of Serbia</span>
        <span className="tabular-nums text-ink">{reg}</span>
      </footer>
    </article>
  );
}

export default function TranslationModal({ isOpen, onClose, activeTranslationDoc, setActiveTranslationDoc, candidate }) {
  if (!isOpen) return null;

  const name = `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || candidate?.name || "Student Kandidat";
  const jmbg = candidate?.jmbg || "1508001710023";
  const passport = candidate?.passportNumber || candidate?.idCardNumber || "010948212";
  const short = String(candidate?.id || "1042").slice(-4);

  return (
    <Sheet
      onClose={onClose}
      title="Prevod na engleski"
      subtitle="Overen prevod sudskog tumača, za sponzora i ambasadu"
      nav={<SheetTabs tabs={TABS} active={activeTranslationDoc} onChange={setActiveTranslationDoc} />}
      footer={
        <SheetFooter left={<Button variant="ghost" onClick={onClose} className="max-sm:hidden">Zatvori</Button>}>
          <Button variant="dark" onClick={() => openPrintableTranslationWindow(activeTranslationDoc, candidate)}>
            Preuzmi PDF
          </Button>
        </SheetFooter>
      }
    >
      {activeTranslationDoc === "faculty" ? (
        <Doc
          heading="CERTIFICATE OF ENROLLMENT"
          sub="Certified translation from Serbian — US J-1 Exchange Visitor Program"
          rows={[
            ["Academic Institution", getTranslatedFacultyName(candidate?.faculty || candidate?.university || "Ekonomski fakultet Univerziteta u Beogradu")],
            ["Student Full Name", name],
            ["National ID (JMBG)", jmbg],
            ["Passport Number", passport],
            ["Academic Year", getTranslatedStudyYear(candidate?.studyYear || "YEAR_2")],
            ["Current Status", "Full-time regular undergraduate student in good academic standing, 2025/2026."],
            ["Summer Recess", "June 1, 2026 – October 1, 2026"],
          ]}
          reg={`Reg. No. AA-TRANS-2026-${short}`}
        />
      ) : (
        <Doc
          heading="POLICE CLEARANCE CERTIFICATE"
          sub="Republic of Serbia — Ministry of Internal Affairs · Sworn translation"
          rows={[
            ["Applicant Full Name", name],
            ["Personal ID (JMBG)", jmbg],
            ["Passport Number", passport],
          ]}
          quote="It is hereby certified that according to the centralized penal and misdemeanor register of the Ministry of Internal Affairs of the Republic of Serbia, the named person has not been convicted of any felony or misdemeanor, and no criminal proceedings are currently pending."
          reg={`Reg. No. AA-MUP-2026-${short}`}
        />
      )}
    </Sheet>
  );
}
