// front/src/components/dashboard/DocumentsView.jsx
// Tab Dokumenta: sva dokumenta, redom kako ih proces traži (ugovor → dosije → Job Offer → DS-160).
// Zadaci su isti kao u koracima (isti builder-i), pa se ovde okačuje, menja i šalje sve što je vezano za papire.
import { Panel, TaskList, Notice } from "./ui";
import { downloadContractPdf, downloadResponsibilityStatementPdf } from "../../data/candidateStore";

const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function DownloadRow({ name, sub, children }) {
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-ink">{name}</p>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">{children}</div>
    </li>
  );
}

export default function DocumentsView({ ctx }) {
  const { candidate, stages = [], isDocumentsRejected } = ctx;

  // Samo koraci koji imaju dokumenta; budući koraci se vide, ali su zaključani.
  const sections = stages
    .map((s) => ({ ...s, docs: s.tasks.filter((t) => t.area === "docs") }))
    .filter((s) => s.docs.length > 0);

  return (
    <div className="space-y-8">
      {sections.map((s) => {
        const locked = s.state === "locked";
        return (
          <section key={s.id} aria-labelledby={`docs-${s.id}`}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h3 id={`docs-${s.id}`} className="text-[15px] font-semibold text-ink">
                <span className="font-normal text-ink-3">{s.label} · </span>
                {s.title}
              </h3>
              {locked && <span className="text-[13px] text-ink-3">Kasnije</span>}
            </div>
            {s.id === "step1" && isDocumentsRejected && (
              <div className="mb-3">
                <Notice tone="danger" title="Koordinator je vratio dosije na dopunu">
                  „{candidate.documentsRejectionReason || "Priloži ispravan ili dopunjen dokument prema uputstvu."}“
                </Notice>
              </div>
            )}
            <TaskList tasks={s.docs} quiet={s.quiet || locked || s.done} />
          </section>
        );
      })}

      <Panel title="Za preuzimanje">
        <ul className="divide-y divide-line">
          <DownloadRow name="Ugovor o posredovanju" sub="Popunjen tvojim podacima">
            <button type="button" onClick={() => downloadContractPdf(candidate.id, candidate.email)} className={linkCls}>
              Preuzmi PDF
            </button>
          </DownloadRow>
          <DownloadRow name="Izjava o odgovornosti" sub="Popunjena tvojim podacima">
            <button type="button" onClick={() => downloadResponsibilityStatementPdf(candidate.id, candidate.email)} className={linkCls}>
              Preuzmi PDF
            </button>
          </DownloadRow>
          <DownloadRow name="DS-160 upitnik u Word-u" sub="Ako ti je lakše da ga popuniš van portala">
            <a href="/documents/UPITNIK_za_izradu_DS160_J1.docx" download="UPITNIK_za_izradu_DS160_J1.docx" className={linkCls}>
              Preuzmi .docx
            </a>
          </DownloadRow>
          <DownloadRow name="Kako da snimiš video predstavljanje" sub="Uputstvo sa primerima">
            <a href="/documents/AA_Instrukcija_za_video_CV.pdf" download="AA_Instrukcija_za_video_CV.pdf" className={linkCls}>
              Preuzmi PDF
            </a>
          </DownloadRow>
        </ul>
      </Panel>
    </div>
  );
}
