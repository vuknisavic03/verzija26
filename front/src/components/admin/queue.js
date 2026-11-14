// front/src/components/admin/queue.js
// Šta kod kog kandidata čeka agenciju — ista pravila kao "Čeka tebe" u dosijeu.
import { getDs160Status } from "../../data/candidateStore";

export function isPreApplication(c) {
  return c.status === "applying" || c.status === "rejected" || String(c.id).startsWith("preapp-");
}

/** Lista stavki koje čekaju admina za jednog kandidata: [{ id, title, group }] */
export function candidateQueue(c) {
  if (!c || isPreApplication(c)) {
    if (c && c.status === "applying" && (!c.contactStatus || c.contactStatus === "NOT_ATTEMPTED") && c.selectionDecision !== "REJECTED") {
      return [{ id: "call", group: "Nove prijave", title: "Pozovi kandidata" }];
    }
    return [];
  }
  const isFull = c.paymentMethod === "now";
  const firstPaid = isFull ? Boolean(c.isFullPaymentPaid || c.firstInstallmentApproved) : Boolean(c.firstInstallmentApproved);
  const jobAccepted =
    c.jobApplicationStatus === "ACCEPTED" ||
    (c.hasJob && !["SCHEDULED", "APPLIED", "NO_SLOTS", "REJECTED"].includes(c.jobApplicationStatus));
  const contractSigned = Boolean(c.signedContractFileName || c.contractSigned);
  const docsSubmitted = Boolean(c.documentsVerificationStatus === "pending" || c.documentsSubmittedForReview);
  const ds = getDs160Status(c.ds160);
  const items = [];

  if (contractSigned && !c.contractApproved && c.contractVerificationStatus !== "rejected")
    items.push({ id: "contract", group: "Ugovori za overu", title: "Pregledaj potpisani ugovor" });
  if (!firstPaid && (c.firstInstallmentStatus === "pending" || c.firstPaymentStatus === "pending" || c.fullPaymentStatus === "pending"))
    items.push({ id: "pay1", group: "Uplate za knjiženje", title: isFull ? "Uplata programa" : "Uplata I rate" });
  if (docsSubmitted && !c.documentsApproved && c.documentsVerificationStatus !== "rejected")
    items.push({ id: "dossier", group: "Dosijei za pregled", title: "Pregledaj dosije" });
  if (c.jobApplicationStatus === "APPLIED" && !jobAccepted)
    items.push({ id: "interview", group: "Poslovi", title: "Dogovori razgovor sa poslodavcem" });
  if (c.jobApplicationStatus === "SCHEDULED")
    items.push({ id: "outcome", group: "Poslovi", title: "Upiši ishod razgovora" });
  if (!isFull && c.secondInstallmentStatus === "pending" && !(c.secondInstallmentPaid || c.secondInstallmentApproved))
    items.push({ id: "pay2", group: "Uplate za knjiženje", title: "Uplata II rate" });
  if (!isFull && c.thirdInstallmentStatus === "pending" && !(c.thirdInstallmentPaid || c.thirdInstallmentApproved))
    items.push({ id: "pay3", group: "Uplate za knjiženje", title: "Uplata III rate" });
  if (c.status === "departure" && !c.hasVisa) {
    if (c.ds2019Status !== "ISSUED") items.push({ id: "ds2019", group: "Viza", title: "Unesi DS-2019" });
    else if (!c.embassyInterviewDate) items.push({ id: "embassy", group: "Viza", title: ds.isComplete ? "Zakaži ambasadu" : "Čeka DS-160 i ambasadu" });
    else items.push({ id: "visa", group: "Viza", title: "Potvrdi vizu posle razgovora" });
  }
  return items;
}

export const STAGE_OF = (c) => {
  if (isPreApplication(c)) return "pre";
  if (c.status === "ready" || c.hasVisa) return "ready";
  if (c.status === "departure") return "visa";
  if (c.status === "job") return "job";
  if (c.status === "docs" || c.status === "in_review") return "docs";
  return "reg";
};

export const STAGES = [
  { id: "reg", label: "Registracija" },
  { id: "docs", label: "Korak 1 · Dokumenta" },
  { id: "job", label: "Korak 2 · Posao" },
  { id: "visa", label: "Korak 3 · Viza" },
  { id: "ready", label: "Viza odobrena" },
];
