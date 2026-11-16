// front/src/components/dashboard/Step2JobPlacement.jsx
// Korak 2: izbor posla → intervju → potpisan Job Offer (okači ga) → II rata. Uplatnica sa QR kodom je u sekciji "Uplate".
import { Button } from "../ui";
import { getOfferedJobsForCandidate } from "../../data/jobsStore";
import { jobOfferState } from "../../data/candidateStore";
import { StepShell, StageTasks, Actions, LinkButton, StatusPill, RemoveFileButton } from "./ui";

export const JOB_OFFER_STATUS = {
  locked: "Posle intervjua",
  missing: "Čeka da ga okačiš",
  pending: "Agencija proverava",
  rejected: "Vraćen na ispravku",
  approved: "Odobren",
};

export function jobAppStatus(candidate) {
  return (
    candidate.jobApplicationStatus ||
    (candidate.jobOfferSignedAt || candidate.jobOfferFileName
      ? "ACCEPTED"
      : candidate.selectedJobEmployer
      ? "APPLIED"
      : "NONE")
  );
}

function JobSummary({ candidate }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <p className="text-[15px] font-semibold text-ink">
        {candidate.selectedJobTitle} — {candidate.selectedJobEmployer}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">
        {candidate.selectedJobCity || "SAD"} · {candidate.selectedJobWage || "satnica po ugovoru"} · smeštaj:{" "}
        {candidate.selectedJobHousing || "obezbeđen"}
      </p>
    </div>
  );
}

export function buildJobTasks(ctx) {
  const {
    candidate,
    isDocumentsApproved,
    hasConfirmedJob,
    isSecondInstallmentPaid,
    isSecondInstallmentPending,
    handleReportSecondInstallment,
    setShowJobFairModal,
    pickJobOffer,
    canRemoveDocument,
    removeDocument,
    openPaymentSlip,
    goTo,
  } = ctx;
  const isFull = candidate.paymentMethod === "now" || candidate.isFullPaymentPaid;
  const offeredJobs = getOfferedJobsForCandidate(candidate);
  const appStatus = jobAppStatus(candidate);
  const hasSelectedJob = Boolean(candidate.selectedJobTitle || candidate.selectedJobEmployer);
  const jobFailed = appStatus === "NO_SLOTS" || appStatus === "REJECTED";
  const offer = jobOfferState(candidate);
  const rate2 = Number(candidate.secondInstallmentAmount) || 400;

  const tasks = [
    {
      id: "job",
      title: "Izaberi posao",
      state: hasSelectedJob && !jobFailed ? "done" : !isDocumentsApproved ? "locked" : "current",
      status: hasSelectedJob && !jobFailed ? "Izabran" : !isDocumentsApproved ? "Posle odobrenog dosijea" : `${offeredJobs.length} ponuda`,
      desc:
        hasSelectedJob && !jobFailed
          ? null
          : !isDocumentsApproved
          ? null
          : jobFailed
          ? "Izaberi drugu poziciju iz ponude."
          : "Izaberi jednu od ponuda koje smo izdvojili za tebe.",
      render: (isNext) =>
        hasSelectedJob && !jobFailed ? (
          <div className="space-y-3">
            <JobSummary candidate={candidate} />
            {!hasConfirmedJob && <LinkButton onClick={() => setShowJobFairModal(true)}>Promeni izbor</LinkButton>}
          </div>
        ) : (
          <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={() => setShowJobFairModal(true)}>
            Pogledaj ponude ({offeredJobs.length})
          </Button>
        ),
    },
    {
      id: "interview",
      waitText: "Dogovaramo termin intervjua sa poslodavcem",
      title: "Intervju sa poslodavcem",
      state: hasConfirmedJob
        ? "done"
        : jobFailed
        ? "danger"
        : appStatus === "SCHEDULED"
        ? "current"
        : appStatus === "APPLIED"
        ? "wait"
        : "locked",
      status: hasConfirmedJob
        ? "Poslodavac ti nudi posao"
        : appStatus === "NO_SLOTS"
        ? "Nema termina"
        : appStatus === "REJECTED"
        ? "Nije prošlo"
        : appStatus === "SCHEDULED"
        ? candidate.interviewScheduledAt || "Zakazan"
        : appStatus === "APPLIED"
        ? "Dogovaramo termin"
        : "Posle izbora posla",
      desc: hasConfirmedJob
        ? null
        : appStatus === "NO_SLOTS"
        ? `${candidate.selectedJobEmployer || "Poslodavac"} trenutno nema slobodnih termina za ovu poziciju.`
        : appStatus === "REJECTED"
        ? `${candidate.selectedJobEmployer || "Poslodavac"} se odlučio za drugog kandidata. Izaberi sledeću ponudu.`
        : appStatus === "SCHEDULED"
        ? candidate.interviewType === "IN_PERSON"
          ? "Uživo, u agenciji."
          : "Online — uključi se par minuta ranije."
        : appStatus === "APPLIED"
        ? "Termin ti javljamo ovde i na e-mail."
        : null,
      render: (isNext) => {
        if (hasConfirmedJob) return null;
        if (appStatus === "SCHEDULED")
          return (
            <div className="space-y-3">
              {candidate.interviewNote && (
                <p className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-2">
                  <span className="font-medium text-ink">Napomena koordinatora:</span> {candidate.interviewNote}
                </p>
              )}
              {candidate.interviewLink && (
                <Button href={candidate.interviewLink} target="_blank" rel="noreferrer" variant={isNext ? "primary" : "dark"} size="sm">
                  Uđi na razgovor
                </Button>
              )}
            </div>
          );
        if (jobFailed)
          return (
            <div className="space-y-3">
              {candidate.interviewNote && (
                <p className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-2">
                  <span className="font-medium text-ink">{appStatus === "REJECTED" ? "Obrazloženje:" : "Napomena:"}</span>{" "}
                  {candidate.interviewNote}
                </p>
              )}
              <Button variant="dark" size="sm" onClick={() => setShowJobFairModal(true)}>
                Izaberi drugi posao
              </Button>
            </div>
          );
        return null;
      },
    },
    {
      id: "offer",
      area: "docs",
      waitText: "Agencija proverava tvoj Job Offer",
      title: "Okači potpisan Job Offer",
      state: offer === "approved" ? "done" : offer === "pending" ? "wait" : offer === "rejected" ? "danger" : offer === "missing" ? "current" : "locked",
      status: JOB_OFFER_STATUS[offer],
      desc:
        offer === "missing"
          ? "Job Offer ti šalje poslodavac. Odštampaj ga, potpiši i okači ovde — agencija ga proverava zajedno sa ostalim dokumentima."
          : offer === "rejected"
          ? `Agencija je vratila Job Offer: ${String(candidate.jobOfferRejectionReason || "pogledaj napomenu").replace(/[.\s]+$/, "")}. Okači ispravljen.`
          : offer === "pending"
          ? candidate.jobOfferFileName
          : null,
      render: (isNext) => {
        if (offer === "locked") return null;
        if (offer === "approved")
          return candidate.jobOfferUrl ? (
            <a href={candidate.jobOfferUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">
              Otvori Job Offer
            </a>
          ) : null;
        if (offer === "pending")
          return (
            <Actions>
              {candidate.jobOfferUrl && (
                <a href={candidate.jobOfferUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">
                  Otvori
                </a>
              )}
              <LinkButton onClick={pickJobOffer}>Zameni</LinkButton>
              {canRemoveDocument?.("jobOffer") && <RemoveFileButton onConfirm={() => removeDocument("jobOffer")} />}
            </Actions>
          );
        return (
          <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={pickJobOffer}>
            {offer === "rejected" ? "Okači ispravljen Job Offer" : "Okači potpisan Job Offer"}
          </Button>
        );
      },
    },
  ];

  if (!isFull) {
    tasks.push({
      id: "payment2",
      area: "pay",
      waitText: "Proveravamo uplatu II rate",
      title: `Uplati II ratu — ${rate2} USD`,
      state: isSecondInstallmentPaid ? "done" : isSecondInstallmentPending ? "wait" : hasConfirmedJob ? "current" : "locked",
      status: isSecondInstallmentPaid
        ? "Proknjiženo"
        : isSecondInstallmentPending
        ? "Proveravamo uplatu"
        : hasConfirmedJob
        ? "Čeka uplatu"
        : "Kad poslodavac ponudi posao",
      desc: isSecondInstallmentPaid
        ? null
        : isSecondInstallmentPending
        ? "Kad je potvrdimo, otvara se Korak 3."
        : hasConfirmedJob
        ? "U dinarima po kursu NBS. Kad platiš, javi nam ovde."
        : null,
      render: (isNext) =>
        isSecondInstallmentPaid ? null : (
          <Actions>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPaymentSlip?.("2")}
            >
              Uplatnica
            </Button>
            {!isSecondInstallmentPending && (
              <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={handleReportSecondInstallment}>
                Platio sam — prijavi uplatu
              </Button>
            )}
            <LinkButton onClick={() => goTo("uplate", "pay-rate2")}>Podaci za uplatu i IPS QR</LinkButton>
          </Actions>
        ),
    });
  }

  return tasks;
}

export default function Step2JobPlacement({ ctx, quiet, compact }) {
  const { candidate, isDocumentsApproved, isStep2Done, isSecondInstallmentPending } = ctx;
  const isFull = candidate.paymentMethod === "now" || candidate.isFullPaymentPaid;

  const tasks = buildJobTasks(ctx);
  return (
    <StepShell
      compact={compact}
      progress={{ done: tasks.filter((x) => x.state === "done").length, total: tasks.length }}
      index="2"
      state={isStep2Done ? "done" : !isDocumentsApproved ? "locked" : "current"}
      kicker="Korak 2"
      title={isFull ? "Posao i Job Offer" : "Posao, Job Offer i II rata"}
      description="Biraš posao, razgovaraš sa poslodavcem, a potpisan Job Offer okačiš ovde."
      status={
        <StatusPill tone={isStep2Done ? "done" : isSecondInstallmentPending ? "wait" : "neutral"}>
          {isStep2Done ? "Završeno" : isSecondInstallmentPending ? "Čeka našu potvrdu" : !isDocumentsApproved ? "Otvara se posle Koraka 1" : "U toku"}
        </StatusPill>
      }
    >
      <StageTasks tasks={tasks} quiet={quiet} goTo={ctx.goTo} />
    </StepShell>
  );
}
