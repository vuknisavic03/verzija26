// Dashboard.jsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "../i18n/LanguageContext";
import {
  getCurrentUser,
  saveCandidate,
  syncFromBackend,
  uploadDocumentWithBackend,
  uploadSignedContractWithBackend,
  uploadJobOfferWithBackend,
  reportVisaFeeWithBackend,
  jobOfferState,
  removeDocumentWithBackend,
  submitDossierWithBackend,
  setTranslationNotNeeded,
  readFileAsDataUrl,
  saveCandidateDs160WithBackend,
  getDs160Status,
  translationDone,
  calculateProfileScore,
  reportInstallmentPayment,
  fetchPortalInvoices,
  selectJobOnServer,
  formatUsd,
} from "../data/candidateStore";

import InvoicesSheet from "./dashboard/modals/InvoicesSheet";
import ProfileBuilderModal from "./ProfileBuilderModal";
import JobFairModal from "./JobFairModal";

import DashboardHeader, { MobileNav } from "./dashboard/DashboardHeader";
import ApplicationTimeline from "./dashboard/ApplicationTimeline";
import { openTask, taskTarget } from "./dashboard/ui";
import Step0Registration, { buildRegistrationTasks } from "./dashboard/Step0Registration";
import Step1Documents, { buildDocumentTasks } from "./dashboard/Step1Documents";
import Step2JobPlacement, { buildJobTasks } from "./dashboard/Step2JobPlacement";
import Step3VisaDeparture, { buildVisaTasks } from "./dashboard/Step3VisaDeparture";
import DocumentsView from "./dashboard/DocumentsView";
import PaymentsView from "./dashboard/PaymentsView";
import ProfileView from "./dashboard/ProfileView";

import SignContractModal from "./dashboard/modals/SignContractModal";
import Ds160Modal from "./dashboard/modals/Ds160Modal";
import TranslationModal from "./dashboard/modals/TranslationModal";
import VideoInstructionsModal from "./dashboard/modals/VideoInstructionsModal";

import { getYouTubeEmbedUrl } from "./dashboard/icons";

export default function Dashboard({
  onLogout = () => {},
  onNavigate = () => {},
  logoHref = "/",
  candidateData = null,
}) {
  const { t } = useTranslation();

  // Učitaj kandidata iz props-a, ili iz localStorage store-a
  const [candidate, setCandidate] = useState(() => {
    return (
      candidateData ||
      getCurrentUser() || {
        firstName: "",
        lastName: "",
        email: "",
        packageName: "Work & Travel USA",
        finalPrice: 1850,
        paymentMethod: "now",
        guarantor: null,
        preferences: {
          location: "",
          position: "",
          englishLevel: "B2",
          testLink: "",
        },
        youtubeUrl: "",
        cvFileName: "",
        facultyCertFileName: "",
        facultyCertAiTranslation: false,
        status: "applying",
        progress: 10,
      }
    );
  });

  // Sinhronizacija sa candidateData kada se uloguje drugi korisnik ili sa backenda
  useEffect(() => {
    if (candidateData) {
      setCandidate(candidateData);
      setYoutubeInput(candidateData.youtubeUrl || "");
      setIsYoutubeEditing(!candidateData.youtubeUrl);
      setCvFile(candidateData.cvFileName || null);
      setFacultyFile(candidateData.facultyCertFileName || null);
      setPoliceFile(candidateData.policeCertificateFileName || null);
    }
  }, [candidateData]);

  useEffect(() => {
    const emailToSync = candidateData?.email || candidate?.email;
    if (!emailToSync) return;
    syncFromBackend(emailToSync).then((data) => {
      if (data?.candidate) {
        setCandidate(data.candidate);
        setYoutubeInput(data.candidate.youtubeUrl || "");
        setIsYoutubeEditing(!data.candidate.youtubeUrl);
        setCvFile(data.candidate.cvFileName || null);
        setFacultyFile(data.candidate.facultyCertFileName || null);
        setPoliceFile(data.candidate.policeCertificateFileName || null);
      }
    });
  }, [candidateData?.email]);

  // Kad se kandidat vrati na karticu, preuzmi izmene agencije (overa ugovora, uplate, dosije).
  useEffect(() => {
    const emailToSync = candidateData?.email || candidate?.email;
    if (!emailToSync) return undefined;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 15_000) return;
      last = Date.now();
      syncFromBackend(emailToSync).then((data) => {
        if (data?.candidate) setCandidate((prev) => ({ ...(prev || {}), ...data.candidate }));
      });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateData?.email]);

  // Stanja za ispunjavanje obaveznih stavki
  const [youtubeInput, setYoutubeInput] = useState(candidate.youtubeUrl || "");
  const [isYoutubeEditing, setIsYoutubeEditing] = useState(!candidate.youtubeUrl);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const [cvFile, setCvFile] = useState(candidate.cvFileName || null);
  const [facultyFile, setFacultyFile] = useState(candidate.facultyCertFileName || null);
  const [policeFile, setPoliceFile] = useState(candidate.policeCertificateFileName || null);

  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [activeTranslationDoc, setActiveTranslationDoc] = useState("faculty"); // "faculty" | "police"
  const policeInputRef = useRef(null);

  const status = candidate.status || "applying";
  const isPastReview = ["job", "departure", "ready"].includes(status);
  const isInReview = ["review", "docs", "in_review", "registered"].includes(status);
  const isReady = status === "ready";
  const isDeparture = status === "departure" || isReady;

  const currentProgress =
    typeof candidate.progress === "number"
      ? candidate.progress
      : status === "ready"
      ? 100
      : status === "departure"
      ? 90
      : status === "job"
      ? 75
      : status === "docs" || status === "in_review"
      ? 55
      : status === "review" || status === "registered"
      ? 40
      : 18;

  const hasConfirmedJob = Boolean(
    (candidate.jobApplicationStatus === "ACCEPTED" ||
      candidate.jobOfferSignedAt ||
      (candidate.jobOfferAccepted && isPastReview) ||
      candidate.hasJob) &&
    candidate.jobApplicationStatus !== "SCHEDULED" &&
    candidate.jobApplicationStatus !== "APPLIED" &&
    candidate.jobApplicationStatus !== "NO_SLOTS" &&
    candidate.jobApplicationStatus !== "REJECTED"
  );

  // Gate 1: Ugovor & Uplata I rate (Registracija -> Korak 1)
  const isPastRegistration = ["docs", "in_review", "job", "departure", "ready"].includes(status);
  const hasSignedContract = Boolean(candidate.signedContractFileName || candidate.contractSigned || isPastRegistration);
  const isContractApproved = Boolean(
    candidate.contractApproved ||
    candidate.contractVerificationStatus === "approved" ||
    isPastRegistration
  );
  const isContractPending = Boolean(
    hasSignedContract &&
    !isContractApproved &&
    candidate.contractVerificationStatus !== "rejected"
  );

  const isFullPaymentPaid = Boolean(
    candidate.isFullPaymentPaid ||
    (candidate.paymentMethod === "now" &&
      (candidate.firstInstallmentApproved ||
        candidate.firstInstallmentStatus === "paid" ||
        candidate.firstPaymentStatus === "paid"))
  );

  const isFirstInstallmentPaid = Boolean(
    candidate.firstInstallmentApproved ||
    candidate.firstInstallmentStatus === "paid" ||
    candidate.firstPaymentStatus === "paid" ||
    isFullPaymentPaid ||
    isPastRegistration
  );
  const isFirstInstallmentPending = Boolean(
    !isFirstInstallmentPaid &&
    (candidate.firstInstallmentStatus === "pending" ||
      candidate.firstPaymentStatus === "pending" ||
      candidate.fullPaymentStatus === "pending")
  );

  const isRegistrationDone = Boolean(isContractApproved && isFirstInstallmentPaid);

  // Gate 2: Dosije & Verifikacija (Korak 1 -> Korak 2)
  const isDocumentsApproved = Boolean(
    candidate.documentsApproved ||
    candidate.documentsVerificationStatus === "approved" ||
    isPastReview
  );
  const isDocumentsRejected = Boolean(
    !isDocumentsApproved &&
    (candidate.documentsVerificationStatus === "rejected" || Boolean(candidate.documentsRejectionReason))
  );
  const isDocumentsPending = Boolean(
    !isDocumentsApproved &&
    !isDocumentsRejected &&
    // „docs" je i korak Dokumenta (pre slanja), pa predat dosije prepoznajemo samo po slanju na pregled.
    (candidate.documentsVerificationStatus === "pending" || candidate.documentsSubmittedForReview || status === "in_review")
  );
  const isStep1Done = Boolean(isDocumentsApproved);

  // Gate 3: Posao & II Rata (Korak 2 -> Korak 3)
  const isSecondInstallmentPaid = Boolean(
    candidate.secondInstallmentPaid ||
    candidate.secondInstallmentApproved ||
    candidate.secondInstallmentStatus === "paid" ||
    isFullPaymentPaid ||
    (candidate.paymentMethod === "now" && isFirstInstallmentPaid) ||
    isDeparture
  );
  const isSecondInstallmentPending = Boolean(
    !isSecondInstallmentPaid &&
    candidate.paymentMethod !== "now" &&
    candidate.secondInstallmentStatus === "pending"
  );
  const isStep2Done = Boolean(hasConfirmedJob && jobOfferState(candidate) === "approved" && isSecondInstallmentPaid);

  // Gate 4: Viza, III Rata / PKZ & Polazak (Korak 3 -> Završeno)
  const isThirdInstallmentPaid = Boolean(
    candidate.thirdInstallmentPaid ||
    candidate.thirdInstallmentApproved ||
    candidate.thirdInstallmentStatus === "paid" ||
    isFullPaymentPaid ||
    candidate.paymentMethod === "now" ||
    candidate.paymentMethod === "later" ||
    candidate.paymentMethod === "installments" ||
    isReady
  );
  const isThirdInstallmentPending = Boolean(
    !isThirdInstallmentPaid &&
    candidate.paymentMethod !== "now" &&
    candidate.thirdInstallmentStatus === "pending"
  );
  const isStep3Done = isReady;

  // 'all' | 'reg' | 'step1' | 'step2' | 'step3' — portal se otvara na koraku koji je trenutno na redu.
  const [activeStepTab, setActiveStepTab] = useState(() =>
    !isRegistrationDone ? "reg" : !isStep1Done ? "step1" : !isStep2Done ? "step2" : "step3"
  );

  const [applicationSubmitted, setApplicationSubmitted] = useState(isPastReview || isInReview);

  useEffect(() => {
    setApplicationSubmitted(isPastReview || isInReview);
  }, [status, isPastReview, isInReview]);

  const cvInputRef = useRef(null);
  const certInputRef = useRef(null);

  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [uploadToast, setUploadToast] = useState("");
  const [showDs160Modal, setShowDs160Modal] = useState(false);
  const [showSignContractModal, setShowSignContractModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [showProfileBuilderModal, setShowProfileBuilderModal] = useState(false);
  // Fakture izdaje agencija na serveru pri potvrdi uplate.
  const [candidateInvoices, setCandidateInvoices] = useState([]);
  const paidSignature = [
    candidate?.firstInstallmentStatus,
    candidate?.secondInstallmentStatus,
    candidate?.thirdInstallmentStatus,
    candidate?.isFullPaymentPaid,
  ].join("|");
  useEffect(() => {
    if (!candidate?.email) return;
    let active = true;
    fetchPortalInvoices().then((list) => active && setCandidateInvoices(list));
    return () => {
      active = false;
    };
  }, [candidate?.email, paidSignature, showInvoicesModal]);
  // Koja uplatnica treba da se otvori kad kandidat dođe na „Uplate" iz koraka.
  const [slipRequest, setSlipRequest] = useState(null);
  const profileScore = calculateProfileScore(candidate);
  const [showJobFairModal, setShowJobFairModal] = useState(false);
  const interviewScheduled = Boolean(
    candidate.jobApplicationStatus === "SCHEDULED" ||
    candidate.interviewScheduled ||
    Boolean(candidate.interviewScheduledAt) ||
    Boolean(candidate.interviewDetails)
  );

  const handleSelectJob = async (job) => {
    const result = await selectJobOnServer(job.id);
    if (!result.ok) {
      setUploadToast(result.error);
      setTimeout(() => setUploadToast(""), 4500);
      return;
    }
    setCandidate(result.candidate);
    setUploadToast(`Prijavio/la si se za poziciju ${job.title} (${job.employer}). Termin intervjua ti javljamo ovde.`);
    setTimeout(() => setUploadToast(""), 4500);
  };

  // Ažuriranje i perzistencija
  const updateCandidateState = (updates) => {
    setCandidate((prev) => {
      const base = prev || candidate;
      const updated = { ...base, ...updates };
      saveCandidate(updated);
      return updated;
    });
  };

  const signedContractInputRef = useRef(null);
  const jobOfferInputRef = useRef(null);
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);

  // Rukovaoci čekanja i simulacije uplata / verifikacija
  const handleReportFirstInstallment = () => {
    const isFull = candidate.paymentMethod === "now";
    reportInstallmentPayment(candidate.id || candidate.email, isFull ? "FULL" : 1);
    updateCandidateState({
      firstInstallmentStatus: "pending",
      firstPaymentStatus: "pending",
      ...(isFull ? { fullPaymentStatus: "pending", fullPaymentReportedAt: new Date().toISOString() } : {}),
      firstInstallmentReportedAt: new Date().toISOString(),
    });
    setUploadToast(
      isFull
        ? "Prijavljena uplata programa u celosti. Čeka se potvrda administratora (izvod banke)."
        : `Prijavljena uplata I rate (${formatUsd(candidate.firstInstallmentAmount || 250)}). Čeka se potvrda administratora (izvod banke).`
    );
    setTimeout(() => setUploadToast(""), 5000);
  };

  const handleReportSecondInstallment = () => {
    reportInstallmentPayment(candidate.id || candidate.email, 2);
    updateCandidateState({
      secondInstallmentStatus: "pending",
      secondInstallmentReportedAt: new Date().toISOString(),
    });
    setUploadToast(`Prijavljena uplata II rate (${formatUsd(candidate.secondInstallmentAmount || 400)}). Čeka se knjiženje KIR fakture.`);
    setTimeout(() => setUploadToast(""), 5000);
  };

  const handleReportThirdInstallment = () => {
    reportInstallmentPayment(candidate.id || candidate.email, 3);
    updateCandidateState({
      thirdInstallmentStatus: "pending",
      thirdInstallmentReportedAt: new Date().toISOString(),
    });
    setUploadToast(`Prijavljena uplata III rate (${formatUsd(candidate.thirdInstallmentAmount || 450)}). Čeka se potvrda pre preuzimanja vize i avio karte.`);
    setTimeout(() => setUploadToast(""), 5000);
  };

  const handlePaymentSlipClick = () => {
    if (!hasSignedContract) {
      setShowSignContractModal(true);
      return;
    }
    setSlipRequest(candidate.paymentMethod === "now" ? "FULL" : "1");
    changeView("uplate");
  };

  const handleUploadSignedContract = async (file) => {
    if (!file) return { ok: false };
    setIsUploadingSignedContract(true);
    try {
      const res = await uploadSignedContractWithBackend(file, candidate.email);
      if (!res.success) return { ok: false, error: res.error };
      // Status ugovora upisuje server; preuzmi ga odatle.
      const synced = await syncFromBackend();
      setCandidate((prev) => ({
        ...(prev || {}),
        ...(synced?.candidate || {
          contractSigned: true,
          contractVerificationStatus: "pending",
          signedContractFileName: res.fileName,
          signedContractUrl: res.fileUrl,
        }),
      }));
      setShowSignContractModal(false);
      setUploadToast(res.message || "Potpisan ugovor je okačen. Uplata ti je otvorena, a agencija proverava ugovor.");
      setTimeout(() => setUploadToast(""), 6000);
      return { ok: true };
    } finally {
      setIsUploadingSignedContract(false);
    }
  };

  const handleSaveYoutube = (e) => {
    e.preventDefault();
    if (!youtubeInput.trim()) return;
    updateCandidateState({ youtubeUrl: youtubeInput.trim() });
    setIsYoutubeEditing(false);
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name;
      setIsUploadingCv(true);
      setCvFile(fileName);
      const dataUrl = await readFileAsDataUrl(file);
      updateCandidateState({
        cvFileName: fileName,
        cvDataUrl: dataUrl,
        cvUploadedAt: new Date().toISOString(),
      });
      try {
        const res = await uploadDocumentWithBackend(file, "cv", candidate.email, candidate.id);
        if (res?.fileUrl) {
          updateCandidateState({ cvUrl: res.fileUrl });
        }
        setUploadToast(res?.message || "CV je uspešno otpremljen.");
      } catch (err) {
        console.warn("CV upload error:", err);
        setUploadToast("CV je uspešno otpremljen.");
      } finally {
        setIsUploadingCv(false);
        setTimeout(() => setUploadToast(""), 4000);
        if (e.target) e.target.value = "";
      }
    }
  };

  // Uverenja: original ide na server (šifrovano). Novi original poništava prethodni prevod,
  // pa se posle otpremanja stanje uvek povlači sa servera.
  const uploadCertificate = async (e, type, setFile) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setIsUploadingCert(true);
    setFile(file.name);
    try {
      const res = await uploadDocumentWithBackend(file, type, candidate.email, candidate.id);
      const synced = await syncFromBackend();
      if (synced?.candidate) setCandidate(synced.candidate);
      setUploadToast(res?.message || "Dokument je otpremljen. Sledeći korak: prevod na engleski.");
    } catch (err) {
      console.warn("Certificate upload error:", err);
      setUploadToast("Dokument nije otpremljen. Pokušaj ponovo.");
    } finally {
      setIsUploadingCert(false);
      setTimeout(() => setUploadToast(""), 4500);
    }
  };
  const handleCertUpload = (e) => uploadCertificate(e, "facultyCert", setFacultyFile);
  const handlePoliceCertUpload = (e) => uploadCertificate(e, "policeCert", setPoliceFile);

  const isRequirementsMet = Boolean(
    candidate.youtubeUrl &&
      candidate.cvFileName &&
      candidate.facultyCertFileName &&
      translationDone(candidate, "faculty") &&
      translationDone(candidate, "police")
  );

  const [isSubmittingDossier, setIsSubmittingDossier] = useState(false);
  const handleSubmitForReview = async () => {
    if (!isRequirementsMet || isSubmittingDossier) return;
    const wasRejected = isDocumentsRejected;
    setIsSubmittingDossier(true);
    const res = await submitDossierWithBackend();
    setIsSubmittingDossier(false);
    if (!res.ok) {
      flash(res.error, 7000);
      return;
    }
    setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
    setApplicationSubmitted(true);
    flash(
      wasRejected
        ? "Dopunjen dosije je poslat koordinatoru na ponovni pregled."
        : "Dosije je poslat na pregled. Javićemo ti mejlom kad ga koordinator pregleda.",
      6000
    );
  };

  const goHome = (e) => {
    e.preventDefault();
    onNavigate(e, logoHref);
  };

  const embedUrl = getYouTubeEmbedUrl(candidate.youtubeUrl);


  // Sekcija portala: "put" (koraci) | "dokumenta" | "uplate" | "podaci"
  const [view, setView] = useState("put");
  const [showTimeline, setShowTimeline] = useState(false);
  const changeView = (v) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Na telefonu je donja navigacija — čet dugme ide iznad nje.
  useEffect(() => {
    document.body.classList.add("has-bottom-nav");
    return () => document.body.classList.remove("has-bottom-nav");
  }, []);

  /** Prebaci na sekciju (i korak) i skroluj do elementa. */
  const goTo = (nextView, anchorId, stage) => {
    setView(nextView);
    // Uplata iz „Sledećeg koraka" odmah otvara svoju uplatnicu.
    const rate = /^pay-rate(\d)$/.exec(anchorId || "");
    if (rate) {
      setSlipRequest(rate[1] === "1" && candidate?.paymentMethod === "now" ? "FULL" : rate[1]);
      return;
    }
    if (stage) setActiveStepTab(stage);
    if (anchorId?.startsWith("task-")) setTimeout(() => openTask(anchorId.slice(5)), 0);
    setTimeout(() => {
      const el = anchorId && document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: document.getElementById("portal-sections")?.offsetTop - 80 || 0, behavior: "smooth" });
    }, 60);
  };

  const flash = (msg, ms = 4000) => {
    setUploadToast(msg);
    setTimeout(() => setUploadToast(""), ms);
  };

  // Svi fajl-inputi žive na jednom mestu — dugmad u koracima i u "Dokumentima" ih samo otvaraju.
  const pickSignedContract = () => signedContractInputRef.current?.click();
  const pickJobOffer = () => jobOfferInputRef.current?.click();
  const handleReportVisaFee = async (paid) => {
    const res = await reportVisaFeeWithBackend(paid);
    if (!res.ok) {
      flash(res.error, 6000);
      return;
    }
    setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
    flash(paid ? "Zabeleženo: vizna taksa je plaćena. Potvrdu ponesi na razgovor u ambasadi." : "Oznaka o uplati vizne takse je skinuta.");
  };
  const handleUploadJobOffer = async (file) => {
    if (!file) return;
    flash("Kačim Job Offer…", 20000);
    const res = await uploadJobOfferWithBackend(file, candidate.email);
    if (!res.success) {
      flash(res.error, 6000);
      return;
    }
    if (res.candidate) setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
    flash(res.message || "Potpisan Job Offer je okačen. Agencija ga proverava.", 6000);
  };
  const pickCv = () => cvInputRef.current?.click();

  // Uverenje je već na engleskom: prevod ne treba (agencija to potvrđuje).
  const markNoTranslation = async (doc, notNeeded) => {
    const res = await setTranslationNotNeeded(doc, notNeeded);
    if (!res.ok) {
      flash(res.error, 6000);
      return;
    }
    if (res.candidate) setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
    flash(notNeeded ? "Označeno: uverenje je već na engleskom. Agencija će to potvrditi." : "Oznaka je skinuta. Možeš da napraviš prevod.");
  };

  // Brisanje okačenog dokumenta (iste provere radi i server: dosije na pregledu, overen ugovor, prijavljena uplata).
  const canRemoveDocument = (type) => {
    if (type === "signedContract") {
      return Boolean(hasSignedContract && !isContractApproved && !isFirstInstallmentPaid && !isFirstInstallmentPending);
    }
    if (type === "jobOffer") return Boolean(candidate.jobOfferFileName) && jobOfferState(candidate) !== "approved";
    return !(isDocumentsApproved || isDocumentsPending);
  };
  const removeDocument = async (type) => {
    const res = await removeDocumentWithBackend(type);
    if (!res.ok) {
      flash(res.error, 6000);
      return false;
    }
    setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
    if (type === "cv") setCvFile(null);
    if (type === "facultyCert") setFacultyFile(null);
    if (type === "policeCert") setPoliceFile(null);
    flash(res.message || "Dokument je obrisan.");
    return true;
  };
  const pickFacultyCert = () => certInputRef.current?.click();
  const pickPoliceCert = () => policeInputRef.current?.click();
  const openTranslation = (doc) => {
    setActiveTranslationDoc(doc);
    setShowTranslationModal(true);
  };

  const payNow = candidate.paymentMethod === "now";
  const fullyPaid = payNow || candidate.isFullPaymentPaid;

  const ctx = {
    candidate,
    status,
    t,
    slipRequest,
    clearSlipRequest: () => setSlipRequest(null),
    openPaymentSlip: (installment) => {
      setSlipRequest(installment);
      changeView("uplate");
    },
    goTo,
    flash,
    // Registracija
    hasSignedContract,
    isContractApproved,
    isContractPending,
    isFirstInstallmentPaid,
    isFirstInstallmentPending,
    isRegistrationDone,
    isUploadingSignedContract,
    pickSignedContract,
    canRemoveDocument,
    removeDocument,
    markNoTranslation,
    setShowSignContractModal,
    handlePaymentSlipClick,
    handleReportFirstInstallment,
    // Korak 1
    isStep1Done,
    isDocumentsApproved,
    isDocumentsPending,
    isDocumentsRejected,
    isRequirementsMet,
    handleSubmitForReview,
    isSubmittingDossier,
    setShowProfileBuilderModal,
    setShowVideoModal,
    isYoutubeEditing,
    setIsYoutubeEditing,
    youtubeInput,
    setYoutubeInput,
    handleSaveYoutube,
    embedUrl,
    pickCv,
    isUploadingCv,
    setCvFile,
    updateCandidateState,
    pickFacultyCert,
    pickPoliceCert,
    isUploadingCert,
    openTranslation,
    // Korak 2
    isStep2Done,
    hasConfirmedJob,
    isSecondInstallmentPaid,
    isSecondInstallmentPending,
    handleReportSecondInstallment,
    setShowJobFairModal,
    pickJobOffer,
    handleReportVisaFee,
    // Korak 3
    isStep3Done,
    isDeparture,
    isReady,
    isThirdInstallmentPaid,
    isThirdInstallmentPending,
    handleReportThirdInstallment,
    setShowDs160Modal,
    // Uplate
    setShowInvoicesModal,
    candidateInvoices,
  };

  // Četiri koraka: stanje, kratka napomena i zadaci (iz istih funkcija koje crtaju korake).
  const step3Locked = !isSecondInstallmentPaid && !fullyPaid;
  const stages = [
    {
      id: "reg",
      label: "Registracija",
      title: payNow ? "Ugovor i uplata" : "Ugovor i I rata",
      done: isRegistrationDone,
      quiet: false,
      tasks: buildRegistrationTasks(ctx),
      state: isRegistrationDone ? "done" : isFirstInstallmentPending || isContractPending ? "wait" : "current",
      note: isRegistrationDone
        ? "Završeno"
        : isFirstInstallmentPending
        ? "Proveravamo uplatu"
        : isContractPending
        ? "Ugovor na overi"
        : hasSignedContract
        ? "Čeka uplatu"
        : "Čeka potpisan ugovor",
    },
    {
      id: "step1",
      label: "Korak 1",
      title: "Profil i dokumenta",
      done: isStep1Done,
      quiet: !isRegistrationDone,
      tasks: buildDocumentTasks(ctx),
      state: isStep1Done ? "done" : isDocumentsRejected ? "danger" : isDocumentsPending ? "wait" : !isRegistrationDone ? "locked" : "current",
      note: isStep1Done
        ? "Dosije odobren"
        : isDocumentsRejected
        ? "Vraćeno na dopunu"
        : isDocumentsPending
        ? "Dosije na pregledu"
        : !isRegistrationDone
        ? "Posle registracije"
        : "Profil i dokumenta",
    },
    {
      id: "step2",
      label: "Korak 2",
      title: fullyPaid ? "Posao i Job Offer" : "Posao i II rata",
      done: isStep2Done,
      quiet: !isDocumentsApproved,
      tasks: buildJobTasks(ctx),
      state: isStep2Done
        ? "done"
        : isSecondInstallmentPending
        ? "wait"
        : hasConfirmedJob || status === "job" || interviewScheduled || isDocumentsApproved
        ? "current"
        : "locked",
      note: isStep2Done
        ? "Završeno"
        : isSecondInstallmentPending
        ? "Proveravamo II ratu"
        : hasConfirmedJob
        ? jobOfferState(candidate) === "pending"
          ? "Job Offer na proveri"
          : jobOfferState(candidate) === "rejected"
          ? "Job Offer vraćen"
          : jobOfferState(candidate) === "approved"
          ? "Job Offer odobren"
          : "Okači Job Offer"
        : !isDocumentsApproved
        ? "Posle odobrenog dosijea"
        : candidate.jobApplicationStatus === "SCHEDULED" || interviewScheduled
        ? "Intervju zakazan"
        : candidate.jobApplicationStatus === "APPLIED"
        ? "Prijava kod poslodavca"
        : candidate.jobApplicationStatus === "NO_SLOTS" || candidate.jobApplicationStatus === "REJECTED"
        ? "Biraj drugi posao"
        : "Izaberi posao",
    },
    {
      id: "step3",
      label: "Korak 3",
      title: isStep3Done ? "Viza odobrena" : "Viza i polazak",
      done: isStep3Done,
      quiet: step3Locked,
      tasks: buildVisaTasks({ ...ctx, stepLocked: step3Locked }),
      state: isStep3Done ? "done" : isThirdInstallmentPending ? "wait" : status === "departure" ? "current" : "locked",
      note: isStep3Done
        ? "Spreman za let"
        : isThirdInstallmentPending
        ? "Proveravamo III ratu"
        : status === "departure"
        ? "Ambasada SAD"
        : step3Locked
        ? "Posle II rate"
        : "DS-2019 i viza",
    },
  ];

  // Sledeći korak: prvi zadatak koji traži akciju u koraku koji je na redu.
  const currentStage = stages.find((s) => !s.done) || null;
  const next = (() => {
    if (!currentStage) {
      const pdo = stages[3].tasks.find((x) => x.id === "pdo");
      return {
        kind: "done",
        title: "Viza je odobrena — vidimo se na orijentaciji",
        desc: pdo?.desc,
        cta: "Pogledaj Korak 3",
        onGo: () => goTo("put", "task-pdo", "step3"),
      };
    }
    const todo = currentStage.tasks.find((x) => x.state === "current" || x.state === "danger");
    if (todo) {
      // Dokumenta i uplate vode u svoj tab, ostalo u Aplikaciju.
      const [targetView, anchor] = taskTarget(todo);
      return {
        kind: "do",
        stageLabel: currentStage.label,
        title: todo.title,
        cta: todo.state === "danger" ? "Reši" : "Kreni",
        onGo: () => goTo(targetView, anchor, currentStage.id),
      };
    }
    const waiting =
      currentStage.tasks.find((x) => x.state === "wait" && x.waitText) || currentStage.tasks.find((x) => x.state === "wait");
    return {
      kind: "wait",
      title: waiting?.waitText || waiting?.title || "Proveravamo tvoje podatke",
      desc: waiting?.desc || "Javljamo ti se čim završimo. Ne moraš ništa da radiš.",
      cta: "Detalji",
      onGo: () => {
        const [targetView, anchor] = waiting ? taskTarget(waiting) : ["put", null];
        goTo(targetView, anchor, currentStage.id);
      },
    };
  })();

  // Tab Dokumenta prikazuje dokumenta po koracima, istim redom kao proces.
  ctx.stages = stages;

  const paymentDue =
    (hasSignedContract && !isFirstInstallmentPaid && !isFirstInstallmentPending ? 1 : 0) +
    (!fullyPaid && hasConfirmedJob && !isSecondInstallmentPaid && !isSecondInstallmentPending ? 1 : 0);

  const stepProps = (id) => ({ ctx, quiet: stages.find((s) => s.id === id)?.quiet, compact: true });
  const currentStageId = currentStage?.id || "step3";
  const shownStage = activeStepTab === "all" ? currentStageId : activeStepTab;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <DashboardHeader
        candidate={candidate}
        logoHref={logoHref}
        goHome={goHome}
        onLogout={onLogout}
        t={t}
        onOpenTimeline={() => setShowTimeline(true)}
        next={next}
        view={view}
        setView={setView}
        badges={{ uplate: paymentDue }}
      />

      <main id="portal-sections" className="mx-auto max-w-6xl px-4 pb-32 pt-7 sm:px-8 sm:pb-24 sm:pt-8">
        {view !== "put" && (
          <h2 className="mb-4 text-xl font-semibold text-ink [font-stretch:100%] tracking-[-0.015em] sm:hidden">
            {{ dokumenta: "Dokumenta", uplate: "Uplate", podaci: "Moji podaci" }[view]}
          </h2>
        )}
        {view === "put" && (
          <>
            {shownStage !== currentStageId && (
              <button
                type="button"
                onClick={() => setActiveStepTab(currentStageId)}
                className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink"
              >
                <span aria-hidden="true">←</span> Nazad na trenutni korak
              </button>
            )}
            {shownStage === "reg" && <Step0Registration {...stepProps("reg")} />}
            {shownStage === "step1" && <Step1Documents {...stepProps("step1")} />}
            {shownStage === "step2" && <Step2JobPlacement {...stepProps("step2")} />}
            {shownStage === "step3" && <Step3VisaDeparture {...stepProps("step3")} />}
          </>
        )}
        {view === "dokumenta" && <DocumentsView ctx={ctx} />}
        {view === "uplate" && <PaymentsView ctx={ctx} />}
        {view === "podaci" && <ProfileView ctx={ctx} />}
      </main>

      <MobileNav view={view} setView={changeView} badges={{ uplate: paymentDue }} />

      <ApplicationTimeline
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        stages={stages}
        currentId={currentStageId}
        onOpenStage={(id) => {
          setShowTimeline(false);
          goTo("put", null, id);
        }}
      />

      {/* Fajl-inputi (jedno mesto za sva kačenja) */}
      <input
        ref={signedContractInputRef}
        type="file"
        accept=".pdf,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const result = await handleUploadSignedContract(file);
          if (result && !result.ok && result.error) {
            setUploadToast(result.error);
            setTimeout(() => setUploadToast(""), 6000);
          }
        }}
      />
      <input
        ref={jobOfferInputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          handleUploadJobOffer(file);
        }}
      />
      <input
        ref={cvInputRef}
        type="file"
        accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleCvUpload}
      />
      <input
        ref={certInputRef}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleCertUpload}
      />
      <input
        ref={policeInputRef}
        type="file"
        accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePoliceCertUpload}
      />

      {uploadToast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-lg rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg sm:bottom-8"
        >
          {uploadToast}
        </div>
      )}

      {/* MODAL: UPUTSTVO ZA YOUTUBE VIDEO */}
      <VideoInstructionsModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        t={t}
      />

      {/* MODAL: PREGLED AI PREVODA UVERENJA */}
      <TranslationModal
        isOpen={showTranslationModal}
        onClose={() => setShowTranslationModal(false)}
        activeTranslationDoc={activeTranslationDoc}
        setActiveTranslationDoc={setActiveTranslationDoc}
        candidate={candidate}
        onCandidate={(next) => setCandidate((prev) => ({ ...(prev || {}), ...next }))}
        pickOriginal={(doc) => (doc === "police" ? pickPoliceCert() : pickFacultyCert())}
      />

      {/* MODAL: DS-160 UPITNIK ZA AMBASADU SAD */}
      {showDs160Modal && (
        <Ds160Modal
          candidate={candidate}
          onClose={() => setShowDs160Modal(false)}
          onSave={async (ds160Data) => {
            // Čuva se na serveru; poruka o uspehu tek kad server potvrdi.
            const res = await saveCandidateDs160WithBackend(ds160Data);
            if (!res.ok) return res;
            setCandidate((prev) => ({ ...(prev || {}), ...res.candidate }));
            const dsStatus = getDs160Status(res.candidate.ds160);
            if (dsStatus.isComplete) setShowDs160Modal(false);
            flash(
              dsStatus.isComplete
                ? "DS-160 upitnik je kompletan i sačuvan."
                : `Sačuvano. Još ${dsStatus.missing.length} obaveznih polja — vidiš ih u upitniku.`,
              5000
            );
            return res;
          }}
        />
      )}

      {/* MODAL: POTPISIVANJE I KAČENJE UGOVORA */}
      {showSignContractModal && (
        <SignContractModal
          candidate={candidate}
          onClose={() => setShowSignContractModal(false)}
          onUploadSignedContract={(file) => handleUploadSignedContract(file)}
          isUploading={isUploadingSignedContract}
        />
      )}

      {/* MODAL: KNJIGA IZDATIH RAČUNA (KIR) / FAKTURE */}
      {showInvoicesModal && <InvoicesSheet invoices={candidateInvoices} onClose={() => setShowInvoicesModal(false)} />}

      {/* MODAL: PROFIL BUILDER (CV, ISKUSTVO, DOSTUPNOST) */}
      {showProfileBuilderModal && (
        <ProfileBuilderModal
          isOpen={Boolean(showProfileBuilderModal)}
          initialTab={typeof showProfileBuilderModal === "string" ? showProfileBuilderModal : undefined}
          onClose={() => setShowProfileBuilderModal(false)}
          candidate={candidate}
          onSave={(profileData) => {
            updateCandidateState(profileData);
            setShowProfileBuilderModal(false);
            setUploadToast("Vaš CV i profil su uspešno ažurirani i sačuvani!");
            setTimeout(() => setUploadToast(""), 4500);
          }}
        />
      )}

      {/* MODAL: SAJAM POSLOVA (KATALOG RADNIH PONUDA) */}
      {showJobFairModal && (
        <JobFairModal
          isOpen={showJobFairModal}
          onClose={() => setShowJobFairModal(false)}
          candidate={candidate}
          onSelectJob={(job) => {
            setShowJobFairModal(false);
            handleSelectJob(job);
          }}
        />
      )}

    </div>
  );
}
