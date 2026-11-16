// front/src/components/dashboard/Step3VisaDeparture.jsx
// Korak 3: DS-2019 → DS-160 → vizna taksa → Ambasada → III rata / PKZ → orijentacija i let.
import { Button } from "../ui";
import { getDs160Status } from "../../data/candidateStore";
import { StepShell, StageTasks, Actions, LinkButton, Notice, StatusPill } from "./ui";

export function isPkz(candidate) {
  return Boolean(
    candidate.packageId?.includes("pkz") || candidate.pkzReminderActive || candidate.discountNote?.includes("PKZ") || candidate.paymentMethod === "pkz"
  );
}

export function thirdInstallmentAmount(candidate) {
  return candidate.thirdInstallmentAmount !== undefined
    ? candidate.thirdInstallmentAmount
    : Math.max(0, (candidate.finalPrice || 1750) - (candidate.firstInstallmentAmount || 250) - (candidate.secondInstallmentAmount || 400));
}

const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

export function buildVisaTasks(ctx) {
  const {
    candidate,
    status,
    isDeparture,
    isReady,
    isThirdInstallmentPaid,
    isThirdInstallmentPending,
    handleReportThirdInstallment,
    setShowDs160Modal,
    openPaymentSlip,
    handleReportVisaFee,
    stepLocked,
  } = ctx;
  const ds2019Issued = candidate.ds2019Status === "ISSUED" || isReady;
  const visaFeePaid = Boolean(candidate.visaFeeReportedAt) || isReady;
  const embassyAt = candidate.embassyInterviewDate
    ? new Date(candidate.embassyInterviewDate).toLocaleString("sr-Latn-RS", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  const isFullPaid = candidate.paymentMethod === "now" || candidate.isFullPaymentPaid;
  const pkz = isPkz(candidate);
  const ds = getDs160Status(candidate.ds160);
  const rate3 = thirdInstallmentAmount(candidate);
  const lock = (s) => (stepLocked ? "locked" : s);

  return [
    {
      id: "ds2019",
      waitText: "Sponzor izdaje DS-2019",
      title: "DS-2019 i SEVIS",
      state: ds2019Issued ? "done" : lock("wait"),
      status: ds2019Issued ? "Izdat" : stepLocked ? "Posle Koraka 2" : "Sponzor ga izdaje",
      desc: ds2019Issued
        ? candidate.ds2019Number
          ? `SEVIS broj: ${candidate.ds2019Number}`
          : null
        : "Ovo radimo mi sa sponzorom. Javljamo ti kad stigne.",
    },
    {
      id: "ds160",
      area: "docs",
      title: "Popuni DS-160 upitnik",
      state: ds.isComplete ? "done" : lock("current"),
      status: ds.isComplete ? "Popunjen" : ds.isStarted ? `${ds.filledCount} od ${ds.totalCount} polja` : "Nije počet",
      desc: ds.isComplete
        ? null
        : "Podaci o poslodavcu su već upisani. Oko 20 minuta.",
      render: (isNext) => (
        <Actions>
          <Button variant={ds.isComplete ? "outline" : isNext ? "primary" : "dark"} size="sm" onClick={() => setShowDs160Modal(true)}>
            {ds.isComplete ? "Pogledaj upitnik" : ds.isStarted ? "Nastavi upitnik" : "Popuni upitnik"}
          </Button>
          <a href="/documents/UPITNIK_za_izradu_DS160_J1.docx" download="UPITNIK_za_izradu_DS160_J1.docx" className={linkCls}>
            Word verzija (.docx)
          </a>
        </Actions>
      ),
    },
    {
      id: "visafee",
      area: "pay",
      title: "Uplati viznu taksu — 185 $",
      state: visaFeePaid ? "done" : lock(isDeparture ? "current" : "locked"),
      status: visaFeePaid
        ? candidate.visaFeeReportedAt
          ? `Plaćeno ${new Date(candidate.visaFeeReportedAt).toLocaleDateString("sr-Latn-RS")}`
          : "Plaćeno"
        : stepLocked
        ? "Posle Koraka 2"
        : "Pre termina u ambasadi",
      desc: visaFeePaid ? null : "Plaća se Ambasadi SAD, pre razgovora. Potvrdu o uplati ponesi na razgovor.",
      render: (isNext) =>
        isReady ? null : (
          <Actions>
            <a href="/documents/Uplatnica_viziranje.docx" download="Uplatnica_viziranje.docx" className={linkCls}>
              Uplatnica za viznu taksu
            </a>
            {candidate.visaFeeReportedAt ? (
              <LinkButton onClick={() => handleReportVisaFee?.(false)}>Ipak nisam platio</LinkButton>
            ) : (
              isDeparture && (
                <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={() => handleReportVisaFee?.(true)}>
                  Platio sam viznu taksu
                </Button>
              )
            )}
          </Actions>
        ),
    },
    {
      id: "embassy",
      title: "Razgovor u Ambasadi SAD",
      waitText: "Zakazujemo termin u ambasadi",
      state: isReady ? "done" : embassyAt ? "current" : status === "departure" ? "wait" : lock("locked"),
      status: isReady ? "Viza odobrena" : embassyAt ? embassyAt : status === "departure" ? "Termin zakazujemo mi" : "Posle DS-160",
      desc: isReady
        ? null
        : "Kneza Miloša 50, Beograd. Pre toga radimo probni razgovor.",
      render: () =>
        isReady ? null : (
          <div className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-2">
            <p className="font-medium text-ink">Ponesi sa sobom</p>
            <p className="mt-1">Pasoš, DS-2019, SEVIS potvrdu, uverenje sa fakulteta sa prevodom i indeks.</p>
          </div>
        ),
    },
    isFullPaid
      ? {
          id: "payment3",
          area: "pay",
          title: "Program je plaćen u celosti",
          state: "done",
          status: "Bez III rate",
          desc: null,
        }
      : pkz
      ? {
          id: "payment3",
          area: "pay",
          title: `III rata — ${rate3} USD iz plate u SAD`,
          state: "info",
          status: "PKZ model",
          desc: "Plaća se iz prvih plata u SAD — sada ne uplaćuješ ništa.",
        }
      : {
          id: "payment3",
          area: "pay",
          waitText: "Proveravamo uplatu III rate",
          title: `Uplati III ratu — ${rate3} USD`,
          state: isThirdInstallmentPaid ? "done" : isThirdInstallmentPending ? "wait" : lock("current"),
          status: isThirdInstallmentPaid ? "Proknjiženo" : isThirdInstallmentPending ? "Proveravamo uplatu" : "Pre preuzimanja pasoša",
          desc: isThirdInstallmentPaid
            ? null
            : isThirdInstallmentPending
            ? null
            : "U dinarima po kursu NBS, pre preuzimanja pasoša.",
          render: (isNext) =>
            isThirdInstallmentPaid ? null : (
              <Actions>
                <Button variant="outline" size="sm" onClick={() => openPaymentSlip?.("3")}>
                  Preuzmi uplatnicu
                </Button>
                {!isThirdInstallmentPending && (
                  <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={handleReportThirdInstallment}>
                    Platio sam — prijavi uplatu
                  </Button>
                )}
              </Actions>
            ),
        },
    {
      id: "pdo",
      title: "Orijentacija pred put i avio karta",
      state: isReady ? "current" : lock("locked"),
      status: isReady ? "Spremno za polazak" : "Posle vize",
      desc: "Obavezna sesija pred let: osiguranje, SSN i uputstva za put.",
    },
  ];
}

export default function Step3VisaDeparture({ ctx, quiet, compact }) {
  const { candidate, status, isStep3Done, isSecondInstallmentPaid, isThirdInstallmentPending } = ctx;
  const isFullPaid = candidate.paymentMethod === "now" || candidate.isFullPaymentPaid;
  const stepLocked = !isSecondInstallmentPaid && !isFullPaid;

  const tasks = buildVisaTasks({ ...ctx, stepLocked });
  return (
    <StepShell
      compact={compact}
      progress={{ done: tasks.filter((x) => x.state === "done").length, total: tasks.length }}
      index="3"
      state={isStep3Done ? "done" : stepLocked ? "locked" : "current"}
      kicker="Korak 3"
      title={isFullPaid ? "Viza i polazak" : "Viza, III rata i polazak"}
      description="Upitnik za vizu, razgovor u ambasadi i priprema za let."
      status={
        <StatusPill tone={isStep3Done ? "done" : isThirdInstallmentPending || status === "departure" ? "wait" : "neutral"}>
          {isStep3Done ? "Viza odobrena" : stepLocked ? "Otvara se posle Koraka 2" : status === "departure" ? "Ambasada u pripremi" : "U toku"}
        </StatusPill>
      }
    >
      {status === "ready" && (
        <Notice tone="done" title="Čestitamo — J-1 viza je odobrena">
          Pasoš sa vizom te čeka u agenciji. Ostala je još orijentacija pred put.
        </Notice>
      )}
      <StageTasks tasks={tasks} quiet={quiet || stepLocked} goTo={ctx.goTo} />
    </StepShell>
  );
}
