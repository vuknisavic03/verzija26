// front/src/components/dashboard/DocumentsView.jsx
// Tab Dokumenta: sva dokumenta, redom kako ih proces traži (ugovor → dosije → Job Offer → DS-160).
// Zadaci su isti kao u koracima (isti builder-i), pa se ovde okačuje, menja i šalje sve što je vezano za papire.
import { useState } from "react";
import { Panel, TaskList, Notice, LinkButton } from "./ui";
import { CheckIcon } from "../ui";
import { downloadContractPdf, downloadResponsibilityStatementPdf } from "../../data/candidateStore";

const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function DownloadRow({ name, children }) {
  return (
    <li className="flex items-center justify-between gap-6 py-3">
      <p className="min-w-0 text-[15px] text-ink">{name}</p>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

export default function DocumentsView({ ctx }) {
  const { candidate, stages = [], isDocumentsRejected } = ctx;
  // Završeni koraci su skupljeni, da se vidi samo ono što je ostalo.
  const [shown, setShown] = useState({});

  const sections = stages
    .map((s) => ({ ...s, docs: s.tasks.filter((t) => t.area === "docs") }))
    .filter((s) => s.docs.length > 0);

  return (
    <div className="space-y-10">
      {sections.map((s) => {
        const locked = s.state === "locked";
        const allDone = s.docs.every((t) => t.state === "done");
        const open = !allDone || shown[s.id];
        return (
          <section key={s.id} aria-labelledby={`docs-${s.id}`}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h3 id={`docs-${s.id}`} className="min-w-0 sm:flex sm:items-baseline sm:gap-4">
                <span className="block w-24 shrink-0 font-sign text-[15px] font-semibold text-ink-3">{s.label}</span>
                <span className={`block truncate text-[17px] font-semibold ${locked ? "text-ink-3" : "text-ink"}`}>{s.title}</span>
              </h3>
              {allDone ? (
                <span className="flex shrink-0 items-center gap-3 text-[13px] text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5 text-ink" strokeWidth={3} />
                    Završeno
                  </span>
                  <LinkButton onClick={() => setShown((o) => ({ ...o, [s.id]: !o[s.id] }))}>{open ? "Sakrij" : "Prikaži"}</LinkButton>
                </span>
              ) : (
                locked && <span className="shrink-0 text-[13px] text-ink-3">Kasnije</span>
              )}
            </div>
            {s.id === "step1" && isDocumentsRejected && (
              <div className="mb-3">
                <Notice tone="danger" title="Koordinator je vratio dosije na dopunu">
                  „{candidate.documentsRejectionReason || "Priloži ispravan ili dopunjen dokument prema uputstvu."}“
                </Notice>
              </div>
            )}
            {open ? <TaskList tasks={s.docs} quiet={s.quiet || locked || s.done} /> : <div className="border-t border-line" />}
          </section>
        );
      })}

      <Panel title="Za preuzimanje">
        <ul className="divide-y divide-line border-y border-line">
          <DownloadRow name="Ugovor o posredovanju">
            <button type="button" onClick={() => downloadContractPdf(candidate.id, candidate.email)} className={linkCls}>
              Preuzmi PDF
            </button>
          </DownloadRow>
          <DownloadRow name="Izjava o odgovornosti">
            <button type="button" onClick={() => downloadResponsibilityStatementPdf(candidate.id, candidate.email)} className={linkCls}>
              Preuzmi PDF
            </button>
          </DownloadRow>
          <DownloadRow name="DS-160 upitnik u Word-u">
            <a href="/documents/UPITNIK_za_izradu_DS160_J1.docx" download="UPITNIK_za_izradu_DS160_J1.docx" className={linkCls}>
              Preuzmi .docx
            </a>
          </DownloadRow>
          <DownloadRow name="Uputstvo za video predstavljanje">
            <a href="/documents/AA_Instrukcija_za_video_CV.pdf" download="AA_Instrukcija_za_video_CV.pdf" className={linkCls}>
              Preuzmi PDF
            </a>
          </DownloadRow>
        </ul>
      </Panel>
    </div>
  );
}
