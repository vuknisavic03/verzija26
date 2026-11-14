// front/src/components/dashboard/Step1Documents.jsx
// Korak 1: profil → video → CV → uverenje sa fakulteta → MUP uverenje → slanje dosijea.
// Lični podaci su u "Moji podaci", a svi fajlovi i prevodi i u sekciji "Dokumenta".
import { Button } from "../ui";
import { UploadIcon, SparklesIcon } from "./icons";
import { StepShell, TaskList, Actions, LinkButton, FileLine, Notice, StatusPill } from "./ui";
import { getTranslatedFacultyName, getTranslatedStudyYear, openPrintableTranslationWindow } from "../../data/candidateStore";

export function buildDocumentTasks(ctx) {
  const {
    candidate,
    t,
    isRegistrationDone,
    isDocumentsApproved,
    isDocumentsPending,
    isDocumentsRejected,
    isRequirementsMet,
    handleSubmitForReview,
    setShowProfileBuilderModal,
    pickCv,
    isUploadingCv,
    setCvFile,
    updateCandidateState,
    pickFacultyCert,
    pickPoliceCert,
    isUploadingCert,
    facultyFile,
    setFacultyFile,
    aiTranslationReady,
    setAiTranslationReady,
    runAiTranslation,
    isTranslating,
    policeFile,
    setPoliceFile,
    policeTranslationReady,
    setPoliceTranslationReady,
    runPoliceTranslation,
    isTranslatingPolice,
    openTranslation,
    flash,
  } = ctx;

  const locked = isDocumentsApproved || isDocumentsPending; // dosije je predat — fajlovi se ne menjaju dok traje provera
  const open = (done) => (done ? "done" : locked ? "wait" : "current");
  const faculty = candidate.facultyCertFileName || facultyFile;
  const police = candidate.policeCertificateFileName || policeFile;
  const av = candidate.availability || {};

  const translationActions = (doc, ready, translating, run, isNext) =>
    ready ? (
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[13px] font-medium text-emerald-700">Prevod na engleski je spreman</span>
        <LinkButton onClick={() => openTranslation(doc)}>Pogledaj prevod</LinkButton>
        <LinkButton onClick={() => openPrintableTranslationWindow(doc, candidate)}>Preuzmi prevod (PDF)</LinkButton>
      </span>
    ) : (
      <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={run} disabled={translating}>
        <SparklesIcon className="h-4 w-4" />
        {translating ? "Prevodim…" : "Napravi prevod"}
      </Button>
    );

  return [
    {
      id: "profile",
      title: "Popuni profil za poslodavce",
      state: open(candidate.profileCompleted && candidate.youtubeUrl),
      status: candidate.profileCompleted && candidate.youtubeUrl
        ? "Popunjen"
        : candidate.profileCompleted
        ? "Fali video"
        : "Nije popunjen",
      desc:
        candidate.profileCompleted && candidate.youtubeUrl
          ? `${candidate.workExperience?.length || 0} radnih iskustava · dostupnost ${av.startDate || "25.05.2026"} – ${av.endDate || "25.09.2026"} · engleski ${candidate.englishLevel || candidate.preferences?.englishLevel || "B2"} · video dodat`
          : candidate.profileCompleted
          ? "Profil je popunjen — ostao je još link do video predstavljanja (poslednji korak profila)."
          : "Pet kratkih koraka: o tebi, datumi, iskustvo, posao i video na engleskom. Po ovome te poslodavci biraju.",
      render: (isNext) => (
        <Actions>
          {candidate.profileCompleted && candidate.youtubeUrl ? (
            <LinkButton onClick={() => setShowProfileBuilderModal(true)}>Izmeni profil</LinkButton>
          ) : (
            <Button
              variant={isNext ? "primary" : "dark"}
              size="sm"
              onClick={() => setShowProfileBuilderModal(candidate.profileCompleted ? "video" : true)}
            >
              {candidate.profileCompleted ? "Dodaj video" : "Popuni profil"}
            </Button>
          )}
        </Actions>
      ),
    },
    {
      id: "cv",
      title: "Okači CV",
      state: open(candidate.cvFileName),
      status: candidate.cvFileName ? "Okačen" : "Nema fajla",
      desc: candidate.cvFileName ? null : "PDF ili Word.",
      render: (isNext) =>
        candidate.cvFileName ? (
          <FileLine name={candidate.cvFileName}>
            {!locked && (
              <LinkButton onClick={pickCv} disabled={isUploadingCv} className="ml-1">
                Zameni
              </LinkButton>
            )}
          </FileLine>
        ) : (
          <Actions>
            <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickCv} disabled={isUploadingCv}>
              <UploadIcon className="h-4 w-4" />
              {isUploadingCv ? "Kačenje…" : "Izaberi CV"}
            </Button>
            <LinkButton
              onClick={() => {
                setCvFile("Luka_Jovanovic_CV.pdf");
                updateCandidateState({ cvFileName: "Luka_Jovanovic_CV.pdf" });
              }}
            >
              Ubaci primer (demo)
            </LinkButton>
          </Actions>
        ),
    },
    {
      id: "faculty",
      title: "Uverenje o redovnom studiranju",
      state: open(faculty && aiTranslationReady),
      status: faculty ? (aiTranslationReady ? "Okačeno i prevedeno" : "Treba prevod") : "Nema fajla",
      desc: faculty
        ? `${getTranslatedFacultyName(candidate.faculty || candidate.university || "Fakultet")} · ${getTranslatedStudyYear(candidate.studyYear || "YEAR_2")}`
        : "Iz studentske službe. Prevod pravimo mi.",
      render: (isNext) =>
        faculty ? (
          <div className="space-y-3">
            <FileLine name={faculty}>
              {!locked && (
                <LinkButton onClick={pickFacultyCert} disabled={isUploadingCert} className="ml-1">
                  Zameni
                </LinkButton>
              )}
            </FileLine>
            {translationActions("faculty", aiTranslationReady, isTranslating, runAiTranslation, isNext)}
          </div>
        ) : (
          <Actions>
            <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickFacultyCert} disabled={isUploadingCert}>
              <UploadIcon className="h-4 w-4" />
              {isUploadingCert ? "Kačenje…" : "Izaberi uverenje"}
            </Button>
            <LinkButton
              onClick={() => {
                setFacultyFile("Uverenje_Ekonomski_BG.pdf");
                setAiTranslationReady(true);
                updateCandidateState({
                  facultyCertFileName: "Uverenje_Ekonomski_BG.pdf",
                  facultyCertAiTranslation: true,
                  facultyCertTranslated: true,
                });
                flash("Dodat je primer uverenja sa prevodom.");
              }}
            >
              Ubaci primer (demo)
            </LinkButton>
          </Actions>
        ),
    },
    {
      id: "police",
      title: "Uverenje o nekažnjavanju (MUP)",
      state: open(police && policeTranslationReady),
      status: police ? (policeTranslationReady ? "Okačeno i prevedeno" : "Treba prevod") : "Nema fajla",
      desc: police
        ? null
        : "Iz policijske uprave po prebivalištu. Prevod pravimo mi.",
      render: (isNext) =>
        police ? (
          <div className="space-y-3">
            <FileLine name={police}>
              {!locked && (
                <LinkButton onClick={pickPoliceCert} className="ml-1">
                  Zameni
                </LinkButton>
              )}
            </FileLine>
            {translationActions("police", policeTranslationReady, isTranslatingPolice, runPoliceTranslation, isNext)}
          </div>
        ) : (
          <Actions>
            <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickPoliceCert}>
              <UploadIcon className="h-4 w-4" />
              Izaberi uverenje
            </Button>
            <LinkButton
              onClick={() => {
                setPoliceFile("Uverenje_o_nekaznjavanju_MUP_RS.pdf");
                setPoliceTranslationReady(true);
                updateCandidateState({
                  policeCertificateFileName: "Uverenje_o_nekaznjavanju_MUP_RS.pdf",
                  policeCertificateUploaded: true,
                  policeCertificateTranslated: true,
                });
                flash("Dodat je primer MUP uverenja sa prevodom.");
              }}
            >
              Ubaci primer (demo)
            </LinkButton>
          </Actions>
        ),
    },
    {
      id: "submit",
      waitText: "Dosije je na pregledu kod koordinatora",
      title: isDocumentsRejected ? "Pošalji dopunjen dosije" : "Pošalji dosije na pregled",
      state: isDocumentsApproved
        ? "done"
        : isDocumentsPending
        ? "wait"
        : isDocumentsRejected
        ? "danger"
        : isRequirementsMet && isRegistrationDone
        ? "current"
        : "locked",
      status: isDocumentsApproved
        ? "Odobren"
        : isDocumentsPending
        ? "Na pregledu"
        : isDocumentsRejected
        ? "Vraćen na dopunu"
        : !isRegistrationDone
        ? "Posle registracije"
        : "Posle stavki 1–4",
      desc: isDocumentsApproved
        ? null
        : isDocumentsPending
        ? "Kad ga odobrimo, otvara se izbor posla."
        : isDocumentsRejected
        ? "Zameni dokument iz napomene, pa pošalji ponovo."
        : !isRegistrationDone
        ? "Dokumenta možeš da spremaš već sada."
        : null,
      render: (isNext) =>
        isDocumentsApproved || isDocumentsPending ? null : (
          <Button
            variant={isDocumentsRejected ? "danger" : isNext ? "primary" : "dark"}
            disabled={!isRequirementsMet || !isRegistrationDone}
            onClick={handleSubmitForReview}
          >
            {isDocumentsRejected ? "Pošalji ponovo na pregled" : "Pošalji dosije"}
          </Button>
        ),
    },
  ];
}

export default function Step1Documents({ ctx, quiet, compact }) {
  const { candidate, isRegistrationDone, isStep1Done, isDocumentsPending, isDocumentsRejected } = ctx;

  const tasks = buildDocumentTasks(ctx);
  return (
    <StepShell
      compact={compact}
      progress={{ done: tasks.filter((x) => x.state === "done").length, total: tasks.length }}
      index="1"
      state={isStep1Done ? "done" : !isRegistrationDone ? "locked" : "current"}
      kicker="Korak 1"
      title="Profil i dokumenta"
      description="Sve što sponzor i poslodavac traže, redom. Prevode na engleski pravimo mi."
      status={
        <StatusPill tone={isStep1Done ? "done" : isDocumentsRejected ? "danger" : isDocumentsPending ? "wait" : "neutral"}>
          {isStep1Done
            ? "Odobreno"
            : isDocumentsRejected
            ? "Treba dopuna"
            : isDocumentsPending
            ? "Na pregledu"
            : !isRegistrationDone
            ? "Otvara se posle registracije"
            : "U toku"}
        </StatusPill>
      }
    >
      {isDocumentsRejected && (
        <Notice tone="danger" title="Koordinator je vratio dosije na dopunu">
          „{candidate.documentsRejectionReason || "Priloži ispravan ili dopunjen dokument prema uputstvu."}“
          {candidate.documentsRejectedAt && (
            <span className="ml-1 opacity-75">— {new Date(candidate.documentsRejectedAt).toLocaleDateString("sr-RS")}</span>
          )}
        </Notice>
      )}
      <TaskList tasks={tasks} quiet={quiet} />
    </StepShell>
  );
}
