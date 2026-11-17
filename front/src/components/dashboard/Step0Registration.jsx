// front/src/components/dashboard/Step0Registration.jsx
// Registracija: ugovor → prva uplata. Program, popusti i uplatnice žive u sekcijama "Uplate" i "Moji podaci".
import { Button } from "../ui";
import { UploadIcon } from "./icons";
import { Actions, LinkButton, FileLine, RemoveFileButton } from "./ui";
import { downloadContractPdf, downloadResponsibilityStatementPdf } from "../../data/candidateStore";

export function firstPaymentAmount(candidate) {
  return candidate.paymentMethod === "now"
    ? Number(candidate.finalPrice) || Number(candidate.basePrice) || 1750
    : Number(candidate.firstInstallmentAmount) || 250;
}

export function buildRegistrationTasks(ctx) {
  const {
    candidate,
    hasSignedContract,
    isContractApproved,
    isContractPending,
    isFirstInstallmentPaid,
    isFirstInstallmentPending,
    isUploadingSignedContract,
    pickSignedContract,
    canRemoveDocument,
    removeDocument,
    setShowSignContractModal,
    handlePaymentSlipClick,
    handleReportFirstInstallment,
  } = ctx;
  const isFull = candidate.paymentMethod === "now";
  const amount = firstPaymentAmount(candidate);
  const contractRejected = candidate.contractVerificationStatus === "rejected";

  return [
    {
      id: "contract",
      area: "docs",
      waitText: "Ugovor je na overi kod pravnog tima",
      title: "Potpiši i okači ugovor",
      state: isContractApproved ? "done" : contractRejected ? "danger" : isContractPending ? "wait" : "current",
      status: isContractApproved
        ? "Overen"
        : contractRejected
        ? "Vraćen na ispravku"
        : isContractPending
        ? "Na overi kod pravnog tima"
        : "Čeka tvoj potpis",
      desc: isContractApproved
        ? null
        : contractRejected
        ? `Agencija je vratila ugovor${candidate.contractRejectionReason ? `: ${String(candidate.contractRejectionReason).replace(/[.\s]+$/, "")}.` : "."} Okači ispravno potpisan ugovor.`
        : isContractPending
        ? "Proveravamo potpise. Uplatnicu već možeš da preuzmeš."
        : "Ugovor i izjava su već popunjeni tvojim podacima — odštampaj, potpiši i okači sken.",
      render: (isNext) => (
        <Actions>
          {hasSignedContract && contractRejected ? (
            // Vraćen ugovor: jedna jasna radnja — okači ispravljen.
            <>
              <Button variant="dark" size="sm" disabled={isUploadingSignedContract} onClick={pickSignedContract}>
                <UploadIcon className="h-4 w-4" />
                {isUploadingSignedContract ? "Kačenje…" : "Okači ispravljen ugovor"}
              </Button>
              <FileLine name={candidate.signedContractFileName || "Potpisani ugovor"} />
            </>
          ) : hasSignedContract ? (
            <FileLine name={candidate.signedContractFileName || "Potpisani ugovor"}>
              <LinkButton onClick={pickSignedContract} disabled={isUploadingSignedContract} className="ml-1">
                Zameni
              </LinkButton>
              {canRemoveDocument?.("signedContract") && <RemoveFileButton onConfirm={() => removeDocument("signedContract")} />}
            </FileLine>
          ) : (
            <>
              <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={() => setShowSignContractModal(true)}>
                Preuzmi i potpiši ugovor
              </Button>
              <Button variant="outline" size="sm" disabled={isUploadingSignedContract} onClick={pickSignedContract}>
                <UploadIcon className="h-4 w-4" />
                {isUploadingSignedContract ? "Kačenje…" : "Već imam potpisan — okači"}
              </Button>
            </>
          )}
          <span className="flex flex-wrap gap-x-4 gap-y-1 sm:ml-auto">
            <LinkButton onClick={() => downloadContractPdf(candidate.id, candidate.email)}>Ugovor (PDF)</LinkButton>
            <LinkButton onClick={() => downloadResponsibilityStatementPdf(candidate.id, candidate.email)}>
              Izjava o odgovornosti (PDF)
            </LinkButton>
          </span>
        </Actions>
      ),
    },
    {
      id: "payment1",
      area: "pay",
      waitText: "Proveravamo tvoju uplatu",
      title: isFull ? `Uplati program — ${amount} USD` : `Uplati I ratu — ${amount} USD`,
      state: isFirstInstallmentPaid ? "done" : isFirstInstallmentPending ? "wait" : !hasSignedContract ? "locked" : "current",
      status: isFirstInstallmentPaid
        ? "Proknjiženo"
        : isFirstInstallmentPending
        ? "Proveravamo uplatu"
        : !hasSignedContract
        ? "Posle ugovora"
        : "Čeka uplatu",
      desc: isFirstInstallmentPaid
        ? null
        : isFirstInstallmentPending
        ? "Kad je potvrdimo, otvara se Korak 1."
        : !hasSignedContract
        ? null
        : "U dinarima po kursu NBS. Kad platiš, javi nam ovde.",
      render: (isNext) =>
        isFirstInstallmentPaid ? null : (
          <Actions>
            <Button variant="outline" size="sm" onClick={handlePaymentSlipClick}>
              Preuzmi uplatnicu
            </Button>
            {!isFirstInstallmentPending && (
              <Button variant={isNext ? "primary" : "dark"} size="sm" onClick={handleReportFirstInstallment}>
                Platio sam — prijavi uplatu
              </Button>
            )}
          </Actions>
        ),
    },
  ];
}
