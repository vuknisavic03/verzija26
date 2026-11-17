// front/src/components/admin/queue.js
// Šta kod kog kandidata čeka agenciju — ista pravila kao "Čeka tebe" u dosijeu.
import { getDs160Status, jobOfferState } from "../../data/candidateStore";

export function isPreApplication(c) {
  return c.status === "applying" || c.status === "rejected" || String(c.id).startsWith("preapp-");
}

/** Lista stavki koje čekaju admina za jednog kandidata: [{ id, tab, title, group }] (tab = kartica dosijea) */
export function candidateQueue(c) {
  if (!c || isPreApplication(c)) {
    if (c && c.status === "applying" && (!c.contactStatus || c.contactStatus === "NOT_ATTEMPTED") && c.selectionDecision !== "REJECTED") {
      return [{ id: "call", group: "Nove prijave", title: "Pozovi kandidata" }];
    }
    return [];
  }
  const isFull = c.paymentMethod === "now";
  const firstPaid = isFull ? Boolean(c.isFullPaymentPaid || c.firstInstallmentApproved) : Boolean(c.firstInstallmentApproved);
  const jobAccepted = c.jobApplicationStatus === "ACCEPTED" || jobOfferState(c) === "approved";
  const contractSigned = Boolean(c.signedContractFileName || c.contractSigned);
  const docsSubmitted = Boolean(c.documentsVerificationStatus === "pending" || c.documentsSubmittedForReview);
  const ds = getDs160Status(c.ds160);
  const items = [];

  if (contractSigned && !c.contractApproved && c.contractVerificationStatus !== "rejected")
    items.push({ id: "contract", tab: "docs", group: "Dokumenta za proveru", title: "Proveri potpisan ugovor" });
  if (!firstPaid && (c.firstInstallmentStatus === "pending" || c.firstPaymentStatus === "pending" || c.fullPaymentStatus === "pending"))
    items.push({ id: "pay1", tab: "pay", group: "Uplate za knjiženje", title: isFull ? "Proknjiži uplatu programa" : "Proknjiži I ratu" });
  if (docsSubmitted && !c.documentsApproved && c.documentsVerificationStatus !== "rejected")
    items.push({ id: "dossier", tab: "docs", group: "Dokumenta za proveru", title: "Proveri dosije" });
  if (jobOfferState(c) === "pending")
    items.push({ id: "jobOffer", tab: "docs", group: "Dokumenta za proveru", title: "Proveri potpisan Job Offer" });
  if (c.jobApplicationStatus === "APPLIED" && !jobAccepted)
    items.push({ id: "interview", tab: "job", group: "Poslovi", title: "Zakaži razgovor sa poslodavcem" });
  if (c.jobApplicationStatus === "SCHEDULED")
    items.push({ id: "outcome", tab: "job", group: "Poslovi", title: "Upiši šta je poslodavac odlučio" });
  if (!isFull && c.secondInstallmentStatus === "pending" && !(c.secondInstallmentPaid || c.secondInstallmentApproved))
    items.push({ id: "pay2", tab: "pay", group: "Uplate za knjiženje", title: "Proknjiži II ratu" });
  if (!isFull && c.thirdInstallmentStatus === "pending" && !(c.thirdInstallmentPaid || c.thirdInstallmentApproved))
    items.push({ id: "pay3", tab: "pay", group: "Uplate za knjiženje", title: "Proknjiži III ratu" });
  if (c.status === "departure" && !c.hasVisa) {
    if (c.ds2019Status !== "ISSUED") items.push({ id: "ds2019", tab: "visa", group: "Viza", title: "Unesi DS-2019" });
    else if (!c.embassyInterviewDate) items.push({ id: "embassy", tab: "visa", group: "Viza", title: ds.isComplete ? "Zakaži ambasadu" : "Čeka DS-160 i ambasadu" });
    else items.push({ id: "visa", tab: "visa", group: "Viza", title: "Potvrdi vizu posle razgovora" });
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
  { id: "visa", tab: "visa", label: "Korak 3 · Viza" },
  { id: "ready", label: "Viza odobrena" },
];
