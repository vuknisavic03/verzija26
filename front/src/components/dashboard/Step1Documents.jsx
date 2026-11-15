// front/src/components/dashboard/Step1Documents.jsx
// Korak 1: profil → video → CV → uverenje sa fakulteta → MUP uverenje → slanje dosijea.
// Lični podaci su u "Moji podaci", a svi fajlovi i prevodi i u sekciji "Dokumenta".
import { Button } from "../ui";
import { UploadIcon, SparklesIcon } from "./icons";
import { StepShell, TaskList, Actions, LinkButton, FileLine, Notice, StatusPill } from "./ui";
import { translationState, getTranslation } from "../../data/candidateStore";

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
    pickFacultyCert,
    pickPoliceCert,
    isUploadingCert,
    openTranslation,
  } = ctx;

  const locked = isDocumentsApproved || isDocumentsPending; // dosije je predat — fajlovi se ne menjaju dok traje provera
  const open = (done) => (done ? "done" : locked ? "wait" : "current");
  const faculty = candidate.facultyCertFileName;
  const police = candidate.policeCertificateFileName;
  const av = candidate.availability || {};

  // Stanje dokumenta sa prevodom: original → prevod → kandidat potvrdi → agencija odobri.
  const docTask = (doc) => {
    const state = translationState(candidate, doc);
    return {
      state:
        state === "confirmed" || state === "approved"
          ? "done"
          : state === "rejected"
          ? "danger"
          : locked
          ? "wait"
          : "current",
      status: {
        missing: "Nema fajla",
        needed: "Treba prevod",
        review: "Proveri prevod",
        confirmed: "Prevod potvrđen",
        approved: "Prevod odobren",
        rejected: "Ispravi prevod",
      }[state],
      desc: {
        needed: "Prevedi ga na engleski. Traje do minut.",
        review: "Prevod je gotov. Uporedi ga sa originalom i potvrdi.",
        rejected: getTranslation(candidate, doc)?.rejectionReason || "Agencija je vratila prevod.",
      }[state] || null,
      translationState: state,
    };
  };

  const translationActions = (doc, isNext) => {
    const state = translationState(candidate, doc);
    if (state === "confirmed" || state === "approved") {
      return <LinkButton onClick={() => openTranslation(doc)}>Pogledaj prevod</LinkButton>;
    }
    return (
      <Button
        variant={state === "rejected" ? "danger" : isNext ? "primary" : "dark"}
        size="sm"
        onClick={() => openTranslation(doc)}
      >
        {state !== "rejected" && <SparklesIcon className="h-4 w-4" />}
        {state === "review" ? "Proveri prevod" : state === "rejected" ? "Ispravi prevod" : "Prevedi na engleski"}
      </Button>
    );
  };

  const facultyTask = docTask("faculty");
  const policeTask = docTask("police");

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
          </Actions>
        ),
    },
    {
      id: "faculty",
      title: "Uverenje o redovnom studiranju",
      state: faculty ? facultyTask.state : open(false),
      status: facultyTask.status,
      desc: faculty ? facultyTask.desc : "Iz studentske službe. Na engleski ga prevodiš ovde, u portalu.",
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
            {translationActions("faculty", isNext)}
          </div>
        ) : (
          <Actions>
            <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickFacultyCert} disabled={isUploadingCert}>
              <UploadIcon className="h-4 w-4" />
              {isUploadingCert ? "Kačenje…" : "Izaberi uverenje"}
            </Button>
          </Actions>
        ),
    },
    {
      id: "police",
      title: "Uverenje o nekažnjavanju (MUP)",
      state: police ? policeTask.state : open(false),
      status: policeTask.status,
      desc: police ? policeTask.desc : "Iz policijske uprave po prebivalištu. Na engleski ga prevodiš ovde, u portalu.",
      render: (isNext) =>
        police ? (
          <div className="space-y-3">
            <FileLine name={police}>
              {!locked && (
                <LinkButton onClick={pickPoliceCert} disabled={isUploadingCert} className="ml-1">
                  Zameni
                </LinkButton>
              )}
            </FileLine>
            {translationActions("police", isNext)}
          </div>
        ) : (
          <Actions>
            <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickPoliceCert} disabled={isUploadingCert}>
              <UploadIcon className="h-4 w-4" />
              {isUploadingCert ? "Kačenje…" : "Izaberi uverenje"}
            </Button>
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
      description="Sve što sponzor i poslodavac traže, redom. Uverenja prevodiš na engleski ovde, u portalu."
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
