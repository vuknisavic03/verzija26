// front/src/components/admin/modals/CandidateApplicationModal.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import {
  PROGRAM_PACKAGES,
  getPromotions,
  uploadDocumentWithBackend,
  verifyCandidateContract,
  verifyCandidateDocuments,
  getCandidateStepInfo,
  getDs160Status,
  openPrintableContractWindow,
  confirmPortalPaymentAdmin,
  fetchPortalInvoices,
  portalInvoicePdfUrl,
  formatUsd,
  INSTALLMENT_LABEL,
} from "../../../data/candidateStore";
import { formatRsd } from "../../../data/invoicesStore";
import ProfileBuilderModal from "../../ProfileBuilderModal";
import { getJobs } from "../../../data/jobsStore";
import { FIELD_CLS, STATUS_FLOW, PlusIcon, XIcon, Modal, Field } from "../ui";
import { Button } from "../../ui";
import { TaskIcon, DataList, cardCls } from "../../dashboard/ui";

export default function CandidateApplicationModal({ candidate, onSave, onClose }) {
  const { t } = useTranslation();
  const promotions = getPromotions();

  // Odredi početni tab na osnovu trenutnog koraka kandidata kako admin odmah vidi aktuelni korak
  const getInitialTab = () => "overview";

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // 1. Lični i akademski podaci
  const [firstName, setFirstName] = useState(candidate.firstName || (candidate.name || "").split(" ")[0] || "");
  const [lastName, setLastName] = useState(
    candidate.lastName || (candidate.name || "").split(" ").slice(1).join(" ") || ""
  );
  const [email, setEmail] = useState(candidate.email || "");
  const [phone, setPhone] = useState(candidate.phone || "");
  const [jmbg, setJmbg] = useState(candidate.jmbg || candidate.ds160?.jmbg || "");
  const [idCardNumber, setIdCardNumber] = useState(candidate.idCardNumber || "");
  const [passportNumber, setPassportNumber] = useState(candidate.passportNumber || candidate.idCardNumber || candidate.ds160?.passportNumber || "");
  const [birthDate, setBirthDate] = useState(candidate.birthDate || candidate.dateOfBirth || candidate.ds160?.dateOfBirth || "");
  const [passportExpiryDate, setPassportExpiryDate] = useState(candidate.passportExpiryDate || candidate.passportExpiry || candidate.ds160?.passportExpiryDate || "");
  const [gender, setGender] = useState(candidate.gender || candidate.ds160?.gender || "Muški");
  const [birthPlace, setBirthPlace] = useState(candidate.birthPlace || candidate.city || candidate.ds160?.birthPlace || "");
  const [citizenship, setCitizenship] = useState(candidate.citizenship || candidate.ds160?.citizenship || "Republika Srbija");
  const [address, setAddress] = useState(candidate.address || candidate.ds160?.homeAddress || "");
  const [passportScanFileName, setPassportScanFileName] = useState(
    candidate.passportScanFileName ||
      (candidate.passportScanDataUrl || candidate.passportImage || candidate.passportScanUrl
        ? "Sken_Pasosa_OCR.png"
        : "")
  );
  const [passportScanUrl, setPassportScanUrl] = useState(candidate.passportScanUrl || "");
  const [passportScanDataUrl, setPassportScanDataUrl] = useState(
    candidate.passportScanDataUrl || candidate.passportImage || ""
  );
  const [faculty, setFaculty] = useState(candidate.faculty || "");
  const [studyCity, setStudyCity] = useState(candidate.studyCity || "Beograd");
  const [studyYear, setStudyYear] = useState(candidate.studyYear || "YEAR_2");
  const [ectsPoints, setEctsPoints] = useState(
    candidate.ectsPoints !== undefined && candidate.ectsPoints !== null ? String(candidate.ectsPoints) : ""
  );

  // Selekcioni i konsultacioni podaci (Faza 0)
  const [contactStatus, setContactStatus] = useState(candidate.contactStatus || "NOT_ATTEMPTED");
  const [contactNotes, setContactNotes] = useState(candidate.contactNotes || "");
  const [infoMaterialsSent, setInfoMaterialsSent] = useState(Boolean(candidate.infoMaterialsSent));
  const [consultationStatus, setConsultationStatus] = useState(candidate.consultationStatus || "NOT_SCHEDULED");
  const [consultationStartsAt, setConsultationStartsAt] = useState(candidate.consultationStartsAt || "");
  const [consultationType, setConsultationType] = useState(candidate.consultationType || "ONLINE");
  const [consultationNotes, setConsultationNotes] = useState(candidate.consultationNotes || "");
  const [selectionDecision, setSelectionDecision] = useState(candidate.selectionDecision || "QUALIFIED");
  const [decisionNote, setDecisionNote] = useState(candidate.decisionNote || "");

  // 2. Paket, finansije, jemac i popust
  const [packageId, setPackageId] = useState(candidate.packageId || "swt-full");
  const [discount, setDiscount] = useState(candidate.discount || 0);
  const [discountNote, setDiscountNote] = useState(candidate.discountNote || "");
  const [discountId, setDiscountId] = useState(candidate.discountId || "none");
  const [discountTiming, setDiscountTiming] = useState(candidate.discountTiming || "immediate");
  const [discountVerified, setDiscountVerified] = useState(Boolean(candidate.discountVerified));
  const [referredBy, setReferredBy] = useState(candidate.referredBy || "");
  const [groupCode, setGroupCode] = useState(candidate.groupCode || "");
  const [paymentMethod, setPaymentMethod] = useState(
    candidate.paymentMethod || (candidate.paymentModel === "installments" ? "installments" : "now")
  );
  const [guarantorName, setGuarantorName] = useState(candidate.guarantor?.name || "");
  const [guarantorIdCard, setGuarantorIdCard] = useState(candidate.guarantor?.idCardNumber || "");
  const [guarantorJmbg, setGuarantorJmbg] = useState(candidate.guarantor?.jmbg || "");

  // Statusi ugovora, rata i dokumenata
  const [contractVerificationStatus, setContractVerificationStatus] = useState(
    candidate.contractVerificationStatus || (candidate.contractApproved ? "approved" : "pending")
  );
  const [contractApproved, setContractApproved] = useState(Boolean(candidate.contractApproved));
  const [firstInstallmentStatus, setFirstInstallmentStatus] = useState(
    candidate.firstInstallmentStatus ||
      candidate.firstPaymentStatus ||
      (candidate.firstInstallmentApproved ? "paid" : "unpaid")
  );
  const [firstInstallmentApproved, setFirstInstallmentApproved] = useState(
    Boolean(candidate.firstInstallmentApproved || candidate.firstInstallmentStatus === "paid")
  );
  const [documentsVerificationStatus, setDocumentsVerificationStatus] = useState(
    candidate.documentsVerificationStatus || (candidate.documentsApproved ? "approved" : "pending")
  );
  const [documentsApproved, setDocumentsApproved] = useState(Boolean(candidate.documentsApproved));
  const [secondInstallmentStatus, setSecondInstallmentStatus] = useState(
    candidate.secondInstallmentStatus || (candidate.secondInstallmentPaid ? "paid" : "unpaid")
  );
  const [secondInstallmentPaid, setSecondInstallmentPaid] = useState(
    Boolean(candidate.secondInstallmentPaid || candidate.secondInstallmentStatus === "paid")
  );
  const [thirdInstallmentStatus, setThirdInstallmentStatus] = useState(
    candidate.thirdInstallmentStatus || (candidate.thirdInstallmentPaid ? "paid" : "unpaid")
  );
  const [thirdInstallmentPaid, setThirdInstallmentPaid] = useState(
    Boolean(candidate.thirdInstallmentPaid || candidate.thirdInstallmentStatus === "paid")
  );
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState(
    candidate.firstInstallmentAmount !== undefined ? Number(candidate.firstInstallmentAmount) : 250
  );
  const [secondInstallmentAmount, setSecondInstallmentAmount] = useState(
    candidate.secondInstallmentAmount !== undefined ? Number(candidate.secondInstallmentAmount) : 400
  );
  const [thirdInstallmentAmount, setThirdInstallmentAmount] = useState(
    candidate.thirdInstallmentAmount !== undefined
      ? Number(candidate.thirdInstallmentAmount)
      : Math.max(0, (Number(candidate.finalPrice) || 1750) - (Number(candidate.firstInstallmentAmount) || 250) - (Number(candidate.secondInstallmentAmount) || 400))
  );
  const [isFullPaymentPaid, setIsFullPaymentPaid] = useState(
    Boolean(
      candidate.isFullPaymentPaid ||
        (candidate.paymentMethod === "now" &&
          (candidate.firstInstallmentApproved ||
            candidate.firstInstallmentStatus === "paid" ||
            candidate.firstPaymentStatus === "paid"))
    )
  );
  const [adminToast, setAdminToast] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [rejectionModal, setRejectionModal] = useState(null);
  const [documentsRejectionReason, setDocumentsRejectionReason] = useState(candidate.documentsRejectionReason || "");
  const [contractRejectionReason, setContractRejectionReason] = useState(candidate.contractRejectionReason || "");
  const [showProfileBuilder, setShowProfileBuilder] = useState(false);

  // 3. Korak 2: Preferencije, Priprema za intervju i Job Offer
  const [englishLevel, setEnglishLevel] = useState(
    candidate.preferences?.englishLevel || candidate.englishLevel || "B2"
  );
  const [locationPref, setLocationPref] = useState(candidate.preferences?.location || "");
  const [positionPref, setPositionPref] = useState(candidate.preferences?.position || "");
  const [testLink, setTestLink] = useState(candidate.preferences?.testLink || "");
  const [startDate, setStartDate] = useState(candidate.availability?.startDate || "");
  const [endDate, setEndDate] = useState(candidate.availability?.endDate || "");

  const [interviewPrepStatus, setInterviewPrepStatus] = useState(candidate.interviewPrepStatus || "NOT_SCHEDULED");
  const [interviewPrepScheduledAt, setInterviewPrepScheduledAt] = useState(candidate.interviewPrepScheduledAt || "");
  const [interviewPrepType, setInterviewPrepType] = useState(candidate.interviewPrepType || "ONLINE");
  const [interviewPrepNotes, setInterviewPrepNotes] = useState(candidate.interviewPrepNotes || "");

  const [selectedJobTitle, setSelectedJobTitle] = useState(candidate.selectedJobTitle || "");
  const [selectedJobEmployer, setSelectedJobEmployer] = useState(candidate.selectedJobEmployer || "");
  const [selectedJobCity, setSelectedJobCity] = useState(candidate.selectedJobCity || "");
  const [selectedJobWage, setSelectedJobWage] = useState(candidate.selectedJobWage || "");
  const [selectedJobHousing, setSelectedJobHousing] = useState(candidate.selectedJobHousing || "");
  const [hasJob, setHasJob] = useState(
    Boolean(
      (candidate.jobApplicationStatus === "ACCEPTED" || candidate.jobOfferSignedAt || candidate.hasJob) &&
      candidate.jobApplicationStatus !== "SCHEDULED" &&
      candidate.jobApplicationStatus !== "APPLIED" &&
      candidate.jobApplicationStatus !== "NO_SLOTS" &&
      candidate.jobApplicationStatus !== "REJECTED"
    )
  );

  const [offerAllJobs, setOfferAllJobs] = useState(candidate.offerAllJobs !== false);
  const [offeredJobIds, setOfferedJobIds] = useState(
    Array.isArray(candidate.offeredJobIds) ? candidate.offeredJobIds : []
  );
  const [jobApplicationStatus, setJobApplicationStatus] = useState(
    candidate.jobApplicationStatus ||
      (candidate.jobOfferSignedAt ? "ACCEPTED" : candidate.selectedJobEmployer ? "APPLIED" : "NONE")
  );
  const [interviewScheduledAt, setInterviewScheduledAt] = useState(candidate.interviewScheduledAt || "");
  const [interviewType, setInterviewType] = useState(candidate.interviewType || "ONLINE");
  const [interviewLink, setInterviewLink] = useState(candidate.interviewLink || "");
  const [interviewNote, setInterviewNote] = useState(candidate.interviewNote || "");

  // 4. Korak 1: Dokumenta i CV
  const [youtubeUrl, setYoutubeUrl] = useState(candidate.youtubeUrl || "");
  const [cvFileName, setCvFileName] = useState(candidate.cvFileName || "");
  const [cvUrl, setCvUrl] = useState(candidate.cvUrl || "");
  const [cvDataUrl, setCvDataUrl] = useState(candidate.cvDataUrl || "");
  const [facultyCertFileName, setFacultyCertFileName] = useState(candidate.facultyCertFileName || "");
  const [facultyCertUrl, setFacultyCertUrl] = useState(candidate.facultyCertUrl || "");
  const [facultyCertDataUrl, setFacultyCertDataUrl] = useState(candidate.facultyCertDataUrl || "");
  const [facultyCertAiTranslation, setFacultyCertAiTranslation] = useState(
    Boolean(candidate.facultyCertAiTranslation)
  );
  const [policeCertificateFileName, setPoliceCertificateFileName] = useState(
    candidate.policeCertificateFileName || ""
  );
  const [policeCertificateUrl, setPoliceCertificateUrl] = useState(candidate.policeCertificateUrl || "");
  const [policeCertificateDataUrl, setPoliceCertificateDataUrl] = useState(
    candidate.policeCertificateDataUrl || ""
  );
  const [policeCertificateTranslated, setPoliceCertificateTranslated] = useState(
    Boolean(candidate.policeCertificateTranslated)
  );
  const [signedContractFileName, setSignedContractFileName] = useState(candidate.signedContractFileName || "");
  const [signedContractUrl, setSignedContractUrl] = useState(candidate.signedContractUrl || "");
  const [signedContractDataUrl, setSignedContractDataUrl] = useState(candidate.signedContractDataUrl || "");
  const [contractSigned, setContractSigned] = useState(
    Boolean(candidate.contractSigned || candidate.signedContractFileName)
  );
  const [uploadingDocType, setUploadingDocType] = useState("");

  // 5. Korak 3: Viza, Ambasada, DS-2019, Let i Orijentacija
  const [ds2019Status, setDs2019Status] = useState(
    candidate.ds2019Status || (secondInstallmentPaid ? "IN_PROGRESS" : "LOCKED")
  );
  const [ds2019Number, setDs2019Number] = useState(candidate.ds2019Number || "");
  const [embassyInterviewDate, setEmbassyInterviewDate] = useState(candidate.embassyInterviewDate || "");
  const [embassyPrepStatus, setEmbassyPrepStatus] = useState(candidate.embassyPrepStatus || "NOT_SCHEDULED");
  const [flightTicketStatus, setFlightTicketStatus] = useState(candidate.flightTicketStatus || "PENDING");
  const [flightDepartureDate, setFlightDepartureDate] = useState(candidate.flightDepartureDate || "");
  const [flightReturnDate, setFlightReturnDate] = useState(candidate.flightReturnDate || "");
  const [orientationAttended, setOrientationAttended] = useState(Boolean(candidate.orientationAttended));
  const [hasVisa, setHasVisa] = useState(Boolean(candidate.hasVisa || candidate.status === "ready"));

  // 6. Status koraka i napomene
  const normInitialStatus =
    candidate.status === "in_review"
      ? "docs"
      : candidate.status === "registered"
      ? "review"
      : candidate.status || "review";
  const [status, setStatus] = useState(normInitialStatus);
  const [notes, setNotes] = useState(candidate.notes || "");

  // 7. Fakture kandidata (KIR)
  // Fakture izdaje server pri potvrdi uplate (zajednička KIR numeracija).
  const [candidateInvoices, setCandidateInvoices] = useState([]);
  const refreshCandidateInvoices = () => {
    if (!candidate.email) return;
    fetchPortalInvoices(candidate.email).then(setCandidateInvoices);
  };
  useEffect(() => {
    refreshCandidateInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.email]);

  // Potvrda uplate: datum prijema, kurs NBS (prazno = automatski za taj dan), poziv na broj.
  const [payForm, setPayForm] = useState(null);
  const openPayForm = (num) => {
    setActiveTab("pay");
    setPayForm({ num, receivedAt: new Date().toISOString().slice(0, 10), rate: "", reference: "", busy: false, error: "" });
  };

  const selectedPackage = PROGRAM_PACKAGES.find((p) => p.id === packageId) || PROGRAM_PACKAGES[0];
  const basePrice = selectedPackage.basePrice;
  const numDiscount = Math.max(0, Number(discount) || 0);
  const finalPrice = Math.max(0, basePrice - numDiscount);

  const showToast = (msg) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(""), 4500);
  };

  // Izgradnja objekta kandidata iz trenutnog stanja forme
  const buildUpdatedCandidate = (overrides = {}) => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || candidate.name || email;
    const isNowRegistered = Boolean(
      candidate.isRegistered ||
        candidate.registeredAt ||
        ["review", "docs", "job", "departure", "ready"].includes(overrides.status || status)
    );
    return {
      ...candidate,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email: email.trim(),
      phone: phone.trim(),
      jmbg: jmbg.trim(),
      idCardNumber: idCardNumber.trim() || passportNumber.trim(),
      passportNumber: passportNumber.trim() || idCardNumber.trim(),
      birthDate: birthDate.trim(),
      dateOfBirth: birthDate.trim(),
      passportExpiryDate: passportExpiryDate.trim(),
      passportExpiry: passportExpiryDate.trim(),
      gender: gender.trim(),
      birthPlace: birthPlace.trim(),
      citizenship: citizenship.trim(),
      address: address.trim(),
      passportScanFileName: passportScanFileName.trim(),
      passportScanUrl,
      passportScanDataUrl,
      passportImage: passportScanDataUrl,
      faculty: faculty.trim(),
      studyCity: studyCity.trim(),
      studyYear,
      ectsPoints: ectsPoints !== "" ? Number(ectsPoints) : undefined,
      contactStatus,
      contactNotes: contactNotes.trim(),
      infoMaterialsSent: Boolean(infoMaterialsSent),
      consultationStatus,
      consultationStartsAt: consultationStartsAt || null,
      consultationType,
      consultationNotes: consultationNotes.trim(),
      selectionDecision,
      decisionNote: decisionNote.trim(),
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      program: selectedPackage.name,
      basePrice,
      discount: numDiscount,
      discountNote: discountNote.trim(),
      discountId,
      discountTiming,
      discountVerified: Boolean(discountVerified),
      referredBy: referredBy.trim(),
      groupCode: groupCode.trim().toUpperCase(),
      hasJob: Boolean(
        (hasJob || jobApplicationStatus === "ACCEPTED") &&
        jobApplicationStatus !== "SCHEDULED" &&
        jobApplicationStatus !== "APPLIED" &&
        jobApplicationStatus !== "NO_SLOTS" &&
        jobApplicationStatus !== "REJECTED"
      ),
      offerAllJobs,
      offeredJobIds,
      jobApplicationStatus,
      interviewScheduledAt,
      interviewType,
      interviewLink,
      interviewNote,
      selectedJobTitle: selectedJobTitle.trim(),
      selectedJobEmployer: selectedJobEmployer.trim(),
      selectedJobCity: selectedJobCity.trim(),
      selectedJobWage: selectedJobWage.trim(),
      selectedJobHousing: selectedJobHousing.trim(),
      hasVisa: Boolean(hasVisa),
      finalPrice,
      paymentMethod,
      guarantor:
        paymentMethod === "later" || paymentMethod === "installments" || guarantorName.trim()
          ? {
              name: guarantorName.trim(),
              idCardNumber: guarantorIdCard.trim(),
              jmbg: guarantorJmbg.trim(),
              promissoryNotesCount: 2,
            }
          : null,
      preferences: {
        ...(candidate.preferences || {}),
        englishLevel,
        location: locationPref.trim(),
        position: positionPref.trim(),
        testLink: testLink.trim(),
      },
      availability: {
        ...(candidate.availability || {}),
        startDate,
        endDate,
      },
      youtubeUrl: youtubeUrl.trim(),
      cvFileName: cvFileName.trim(),
      cvUrl,
      cvDataUrl,
      facultyCertFileName: facultyCertFileName.trim(),
      facultyCertUrl,
      facultyCertDataUrl,
      facultyCertAiTranslation: Boolean(facultyCertAiTranslation),
      policeCertificateFileName: policeCertificateFileName.trim(),
      policeCertificateUrl,
      policeCertificateDataUrl,
      policeCertificateUploaded: Boolean(policeCertificateFileName.trim()),
      policeCertificateTranslated: Boolean(policeCertificateTranslated),
      signedContractFileName: signedContractFileName.trim(),
      signedContractUrl,
      signedContractDataUrl,
      contractSigned: Boolean(contractSigned || signedContractFileName.trim()),
      contractVerificationStatus,
      contractApproved: Boolean(contractApproved),
      contractRejectionReason,
      firstInstallmentStatus,
      firstPaymentStatus: firstInstallmentStatus,
      firstInstallmentApproved: Boolean(firstInstallmentApproved),
      firstInstallmentAmount: Number(firstInstallmentAmount) || 0,
      documentsVerificationStatus,
      documentsApproved: Boolean(documentsApproved),
      documentsRejectionReason,
      secondInstallmentStatus,
      secondInstallmentPaid: Boolean(secondInstallmentPaid),
      secondInstallmentAmount: Number(secondInstallmentAmount) || 0,
      thirdInstallmentStatus,
      thirdInstallmentPaid: Boolean(thirdInstallmentPaid),
      thirdInstallmentAmount: Number(thirdInstallmentAmount) || 0,
      isFullPaymentPaid: Boolean(isFullPaymentPaid),
      firstInstallmentPaidRsd: candidate.firstInstallmentPaidRsd,
      firstInstallmentExchangeRate: candidate.firstInstallmentExchangeRate,
      firstInstallmentPaidDate: candidate.firstInstallmentPaidDate,
      secondInstallmentPaidRsd: candidate.secondInstallmentPaidRsd,
      secondInstallmentExchangeRate: candidate.secondInstallmentExchangeRate,
      secondInstallmentPaidDate: candidate.secondInstallmentPaidDate,
      thirdInstallmentPaidRsd: candidate.thirdInstallmentPaidRsd,
      thirdInstallmentExchangeRate: candidate.thirdInstallmentExchangeRate,
      thirdInstallmentPaidDate: candidate.thirdInstallmentPaidDate,
      fullPaymentPaidRsd: candidate.fullPaymentPaidRsd,
      fullPaymentExchangeRate: candidate.fullPaymentExchangeRate,
      fullPaymentPaidDate: candidate.fullPaymentPaidDate,
      interviewPrepStatus,
      interviewPrepScheduledAt: interviewPrepScheduledAt || null,
      interviewPrepType,
      interviewPrepNotes: interviewPrepNotes.trim(),
      selectedJobTitle: selectedJobTitle.trim(),
      selectedJobEmployer: selectedJobEmployer.trim(),
      selectedJobCity: selectedJobCity.trim(),
      selectedJobWage: selectedJobWage.trim(),
      selectedJobHousing: selectedJobHousing.trim(),
      ds2019Status,
      ds2019Number: ds2019Number.trim(),
      embassyInterviewDate: embassyInterviewDate || null,
      embassyPrepStatus,
      flightTicketStatus,
      flightDepartureDate: flightDepartureDate || null,
      flightReturnDate: flightReturnDate || null,
      orientationAttended: Boolean(orientationAttended),
      ds160: candidate.ds160,
      status,
      isRegistered: isNowRegistered,
      registeredAt: candidate.registeredAt || (isNowRegistered ? new Date().toISOString() : undefined),
      notes: notes.trim(),
      ...overrides,
    };
  };

  // Reaktivne akcije u modalu:
  const handleVerifyContractAction = (approved, reason = "") => {
    verifyCandidateContract(candidate.id || email, approved, reason);
    const nextVerStatus = approved ? "approved" : "rejected";
    setContractVerificationStatus(nextVerStatus);
    setContractApproved(approved);
    if (!approved) setContractRejectionReason(reason);
    else setContractRejectionReason("");

    // Ako su i ugovor i I rata sada odobreni, automatski prebaci na Korak 1 (docs); ako je ugovor odbijen, vrati na Registraciju (review)
    const shouldAdvanceToDocs = approved && firstInstallmentApproved && (status === "review" || status === "applying");
    const shouldRevertToReview = !approved && (status === "docs" || status === "in_review");
    const nextStatus = shouldAdvanceToDocs ? "docs" : shouldRevertToReview ? "review" : status;
    if (nextStatus !== status) setStatus(nextStatus);

    const updated = buildUpdatedCandidate({
      contractVerificationStatus: nextVerStatus,
      contractApproved: approved,
      contractRejectionReason: approved ? "" : reason,
      status: nextStatus,
    });
    onSave(updated, { keepOpen: true });

    showToast(
      shouldAdvanceToDocs
        ? "Ugovor odobren! Pošto je i I rata plaćena, kandidat je automatski prebačen na Korak 1: Dokumenta."
        : approved
        ? "Svojeručno potpisani ugovor je odobren!"
        : "Ugovor je odbijen uz obrazloženje. Student na svom profilu sada vidi status odbijenog ugovora i razlog vraćanja."
    );
  };

  const handleConfirmInstallmentAction = async (instNum, form) => {
    const isFullAction =
      instNum === "full" ||
      instNum === "FULL" ||
      instNum === 0 ||
      (paymentMethod === "now" && (instNum === 1 || instNum === "1"));
    const installment = isFullAction ? "FULL" : String(instNum);

    setPayForm((f) => (f ? { ...f, busy: true, error: "" } : f));
    const result = await confirmPortalPaymentAdmin({
      email: candidate.email,
      installment,
      receivedAt: form.receivedAt,
      exchangeRate: form.rate,
      reference: form.reference,
    });
    if (!result.ok) {
      setPayForm((f) => (f ? { ...f, busy: false, error: result.error } : f));
      return;
    }
    const server = result.candidate || {};

    let nextStatus = status;
    if (isFullAction) {
      setIsFullPaymentPaid(true);
      setFirstInstallmentStatus("paid");
      setFirstInstallmentApproved(true);
      setSecondInstallmentStatus("paid");
      setSecondInstallmentPaid(true);
      setThirdInstallmentStatus("paid");
      setThirdInstallmentPaid(true);
      if (contractApproved && (status === "review" || status === "applying")) nextStatus = "docs";
      if (hasJob && (status === "job" || status === "docs" || status === "review")) nextStatus = "departure";
    } else if (installment === "1") {
      setFirstInstallmentStatus("paid");
      setFirstInstallmentApproved(true);
      if (contractApproved && (status === "review" || status === "applying")) nextStatus = "docs";
    } else if (installment === "2") {
      setSecondInstallmentStatus("paid");
      setSecondInstallmentPaid(true);
      if (hasJob && (status === "job" || status === "docs" || status === "review")) nextStatus = "departure";
    } else {
      setThirdInstallmentStatus("paid");
      setThirdInstallmentPaid(true);
    }
    setStatus(nextStatus);
    const unlockDs2019 = (isFullAction || installment === "2") && ds2019Status === "LOCKED";
    if (unlockDs2019) setDs2019Status("IN_PROGRESS");

    // Polja uplate dolaze sa servera; dosije čuva samo korak i DS-2019.
    const paymentFields = Object.fromEntries(
      Object.entries(server).filter(([k]) => /^(first|second|third|fullPayment|isFullPayment|firstPayment)/.test(k) || k === "notes")
    );
    const updated = {
      ...buildUpdatedCandidate({
        status: nextStatus,
        ...(unlockDs2019 ? { ds2019Status: "IN_PROGRESS" } : {}),
      }),
      ...paymentFields,
    };
    if (server.notes) setNotes(server.notes);
    onSave(updated, { keepOpen: true });
    refreshCandidateInvoices();
    setPayForm(null);

    const label = INSTALLMENT_LABEL[installment] || `${installment}. rata`;
    showToast(
      result.alreadyConfirmed
        ? `${label} je već potvrđena (faktura ${result.invoiceNumber}).`
        : `${label} je potvrđena. Izdata je faktura ${result.invoiceNumber}.`
    );
  };

  const handleVerifyDocumentsAction = (approved, reason = "") => {
    verifyCandidateDocuments(candidate.id || email, approved, reason);
    const nextDocStatus = approved ? "approved" : "rejected";
    setDocumentsVerificationStatus(nextDocStatus);
    setDocumentsApproved(approved);
    if (!approved) setDocumentsRejectionReason(reason);
    else setDocumentsRejectionReason("");

    const nextStatus = approved ? "job" : status;
    if (approved) setStatus("job");

    const updated = buildUpdatedCandidate({
      documentsVerificationStatus: nextDocStatus,
      documentsApproved: approved,
      documentsRejectionReason: approved ? "" : reason,
      status: nextStatus,
    });
    onSave(updated, { keepOpen: true });

    showToast(
      approved
        ? "Kompletan dosije odobren! Kandidat je automatski prebačen na Korak 2: Posao i ponuda."
        : "Dokumentacija je vraćena na dopunu. Obrazloženje je prikazano kandidatu na profilu."
    );
  };

  const handleAdminDocUpload = async (file, type) => {
    if (!file) return;
    setUploadingDocType(type);
    try {
      const res = await uploadDocumentWithBackend(file, type, email, candidate.id);
      if (type === "signedContract") {
        setSignedContractFileName(res.fileName);
        if (res.fileUrl) setSignedContractUrl(res.fileUrl);
        if (res.dataUrl) setSignedContractDataUrl(res.dataUrl);
        setContractSigned(true);
      } else if (type === "cv") {
        setCvFileName(res.fileName);
        if (res.fileUrl) setCvUrl(res.fileUrl);
        if (res.dataUrl) setCvDataUrl(res.dataUrl);
      } else if (type === "facultyCert") {
        setFacultyCertFileName(res.fileName);
        if (res.fileUrl) setFacultyCertUrl(res.fileUrl);
        if (res.dataUrl) setFacultyCertDataUrl(res.dataUrl);
        setFacultyCertAiTranslation(true);
      } else if (type === "policeCert") {
        setPoliceCertificateFileName(res.fileName);
        if (res.fileUrl) setPoliceCertificateUrl(res.fileUrl);
        if (res.dataUrl) setPoliceCertificateDataUrl(res.dataUrl);
        setPoliceCertificateTranslated(true);
      } else if (type === "passport") {
        setPassportScanFileName(res.fileName);
        if (res.fileUrl) setPassportScanUrl(res.fileUrl);
        if (res.dataUrl) setPassportScanDataUrl(res.dataUrl);
      }
      showToast(`Dokument "${res.fileName}" je uspešno sačuvan u dosijeu.`);
    } finally {
      setUploadingDocType("");
    }
  };

  const openDocumentPreview = (title, fileName, fileUrl, dataUrl, docCategory) => {
    if (!fileName && !fileUrl && !dataUrl) return;
    setPreviewDoc({
      title,
      fileName: fileName || "Dokument.pdf",
      url: dataUrl || fileUrl || "",
      docCategory,
    });
  };

  // Promena koraka na gornjoj traci
  const handleSelectStep = (stepId) => {
    setStatus(stepId);
    if (stepId === "ready") setHasVisa(true);
    if (stepId === "review" || stepId === "docs") setActiveTab("docs");
    else if (stepId === "job") setActiveTab("job");
    else if (stepId === "departure" || stepId === "ready") setActiveTab("visa");
  };

  const currentFlow = STATUS_FLOW[status] || STATUS_FLOW.review;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const updated = buildUpdatedCandidate();
    onSave(updated);
  };

  const liveCandidateSnapshot = buildUpdatedCandidate();
  const stepInfo = getCandidateStepInfo(liveCandidateSnapshot);
  const ds160Entries = Object.entries(candidate.ds160 || {});

  // Finansijski saldo
  const r1Amount = Number(firstInstallmentAmount) || 250;
  const r2Amount = Number(secondInstallmentAmount) || 400;
  const r3Amount = Number(thirdInstallmentAmount) || Math.max(0, finalPrice - r1Amount - r2Amount);

  const isFull = paymentMethod === "now";

  const totalPaidEur = isFull
    ? isFullPaymentPaid || firstInstallmentApproved
      ? finalPrice
      : 0
    : (firstInstallmentApproved ? r1Amount : 0) +
      (secondInstallmentPaid ? r2Amount : 0) +
      (thirdInstallmentPaid ? r3Amount : 0);

  const remainingEur = Math.max(0, finalPrice - totalPaidEur);

  // Dinarski iznos postoji samo za potvrđene uplate (po kursu zaključanom pri potvrdi).
  const totalPaidRsd = isFull
    ? isFullPaymentPaid || firstInstallmentApproved
      ? Number(candidate.fullPaymentPaidRsd) || 0
      : 0
    : (firstInstallmentApproved ? Number(candidate.firstInstallmentPaidRsd) || 0 : 0) +
      (secondInstallmentPaid ? Number(candidate.secondInstallmentPaidRsd) || 0 : 0) +
      (thirdInstallmentPaid ? Number(candidate.thirdInstallmentPaidRsd) || 0 : 0);


  // ================================================================
  // PRIKAZ DOSIJEA
  // Pregled (šta čeka admina) → Dokumenta (sve na jednom mestu) → Uplate → Posao → Viza i let → Podaci → Beleške
  // ================================================================
  const firstPaid = isFull ? Boolean(isFullPaymentPaid || firstInstallmentApproved) : Boolean(firstInstallmentApproved);
  const ds160St = getDs160Status(candidate.ds160);
  const jobAccepted =
    jobApplicationStatus === "ACCEPTED" ||
    (hasJob && !["SCHEDULED", "APPLIED", "NO_SLOTS", "REJECTED"].includes(jobApplicationStatus));
  const offerSigned = Boolean(candidate.jobOfferSignedAt);
  const docsSubmitted = Boolean(candidate.documentsVerificationStatus === "pending" || candidate.documentsSubmittedForReview);
  const passportScan = passportScanFileName || passportScanDataUrl || passportScanUrl;

  const stages = [
    { id: "reg", label: "Registracija", title: "Ugovor i prva uplata", done: Boolean(contractApproved && firstPaid) },
    { id: "docs", label: "Korak 1", title: "Dokumenta", done: Boolean(documentsApproved) },
    { id: "job", label: "Korak 2", title: "Posao", done: Boolean(jobAccepted && (isFull || secondInstallmentPaid)) },
    { id: "visa", label: "Korak 3", title: "Viza i polazak", done: Boolean(hasVisa) },
  ];
  const currentStageId = stages.find((s) => !s.done)?.id || null;

  const go = (tab) => setActiveTab(tab);
  const openContract = () =>
    openDocumentPreview("Potpisani ugovor", signedContractFileName, signedContractUrl, signedContractDataUrl, "contract");
  const rejectContract = () =>
    setRejectionModal({ type: "contract", title: "Vrati ugovor na ispravku", reason: contractRejectionReason || "" });
  const rejectDocs = () =>
    setRejectionModal({ type: "documents", title: "Vrati dosije na dopunu", reason: documentsRejectionReason || "" });

  // Red čekanja: sve što trenutno traži odluku ili unos agencije.
  const queue = [
    contractSigned &&
      !contractApproved &&
      contractVerificationStatus !== "rejected" && {
        id: "contract",
        tab: "docs",
        title: "Pregledaj potpisani ugovor",
        desc: signedContractFileName || "Kandidat je okačio potpisan ugovor.",
        actions: (
          <>
            {signedContractFileName && (
              <Button size="sm" variant="outline" onClick={openContract}>
                Otvori
              </Button>
            )}
            <Button size="sm" variant="dark" onClick={() => handleVerifyContractAction(true)}>
              Odobri
            </Button>
            <Button size="sm" variant="ghost" onClick={rejectContract}>
              Vrati
            </Button>
          </>
        ),
      },
    !firstPaid &&
      firstInstallmentStatus === "pending" && {
        id: "pay1",
        tab: "pay",
        title: isFull ? `Potvrdi uplatu programa — ${finalPrice} USD` : `Potvrdi uplatu I rate — ${r1Amount} USD`,
        desc: "Kandidat je prijavio uplatu. Proveri izvod pa proknjiži.",
        actions: (
          <Button size="sm" variant="dark" onClick={() => openPayForm(isFull ? "full" : 1)}>
            Proknjiži
          </Button>
        ),
      },
    docsSubmitted &&
      !documentsApproved &&
      documentsVerificationStatus !== "rejected" && {
        id: "dossier",
        tab: "docs",
        title: "Pregledaj dosije",
        desc: "CV, video i oba uverenja su poslati na pregled.",
        actions: (
          <>
            <Button size="sm" variant="outline" onClick={() => go("docs")}>
              Dokumenta
            </Button>
            <Button size="sm" variant="dark" onClick={() => handleVerifyDocumentsAction(true)}>
              Odobri
            </Button>
            <Button size="sm" variant="ghost" onClick={rejectDocs}>
              Vrati
            </Button>
          </>
        ),
      },
    jobApplicationStatus === "APPLIED" &&
      !jobAccepted && {
        id: "interview",
        tab: "job",
        title: "Dogovori razgovor sa poslodavcem",
        desc: `${selectedJobTitle || "Pozicija"} — ${selectedJobEmployer || "poslodavac"}`,
        actions: (
          <Button size="sm" variant="dark" onClick={() => go("job")}>
            Zakaži
          </Button>
        ),
      },
    jobApplicationStatus === "SCHEDULED" && {
      id: "outcome",
      tab: "job",
      title: "Upiši ishod razgovora",
      desc: interviewScheduledAt ? `Razgovor: ${interviewScheduledAt.replace("T", " ")}` : "Razgovor je zakazan.",
      actions: (
        <Button size="sm" variant="dark" onClick={() => go("job")}>
          Otvori
        </Button>
      ),
    },
    !isFull &&
      secondInstallmentStatus === "pending" &&
      !secondInstallmentPaid && {
        id: "pay2",
        tab: "pay",
        title: `Potvrdi uplatu II rate — ${r2Amount} USD`,
        desc: "Kandidat je prijavio uplatu.",
        actions: (
          <Button size="sm" variant="dark" onClick={() => openPayForm(2)}>
            Proknjiži
          </Button>
        ),
      },
    !isFull &&
      thirdInstallmentStatus === "pending" &&
      !thirdInstallmentPaid && {
        id: "pay3",
        tab: "pay",
        title: `Potvrdi uplatu III rate — ${r3Amount} USD`,
        desc: "Kandidat je prijavio uplatu.",
        actions: (
          <Button size="sm" variant="dark" onClick={() => openPayForm(3)}>
            Proknjiži
          </Button>
        ),
      },
    status === "departure" &&
      ds2019Status !== "ISSUED" && {
        id: "ds2019",
        tab: "visa",
        title: "Unesi DS-2019 kad ga sponzor izda",
        desc: ds2019Status === "IN_PROGRESS" ? "U izradi kod sponzora." : "Čeka II ratu.",
        actions: (
          <Button size="sm" variant="outline" onClick={() => go("visa")}>
            Otvori
          </Button>
        ),
      },
    status === "departure" &&
      !hasVisa &&
      !embassyInterviewDate && {
        id: "embassy",
        tab: "visa",
        title: "Zakaži razgovor u ambasadi",
        desc: ds160St.isComplete ? "DS-160 je popunjen." : `DS-160: ${ds160St.filledCount} od ${ds160St.totalCount} polja.`,
        actions: (
          <Button size="sm" variant="outline" onClick={() => go("visa")}>
            Otvori
          </Button>
        ),
      },
    status === "departure" &&
      !hasVisa &&
      embassyInterviewDate && {
        id: "visa",
        tab: "visa",
        title: "Potvrdi vizu posle razgovora",
        desc: `Ambasada: ${embassyInterviewDate.replace("T", " ")}`,
        actions: (
          <Button size="sm" variant="outline" onClick={() => go("visa")}>
            Otvori
          </Button>
        ),
      },
  ].filter(Boolean);
  const queueByTab = (tab) => queue.filter((q) => q.tab === tab).length;

  const tabs = [
    { id: "overview", label: "Pregled", count: queue.length },
    { id: "docs", label: "Dokumenta", count: queueByTab("docs") },
    { id: "pay", label: "Uplate", count: queueByTab("pay") },
    { id: "job", label: "Posao", count: queueByTab("job") },
    { id: "visa", label: "Viza i let", count: queueByTab("visa") },
    { id: "data", label: "Podaci" },
    { id: "notes", label: "Beleške" },
  ];
  const activeTabInfo = tabs.find((x) => x.id === activeTab) || tabs[0];
  const initials = (firstName[0] || "") + (lastName[0] || "") || "AA";

  const prof = candidate || {};
  const av = prof.availability || {};
  const pref = prof.preferences || {};

  return (
    <Modal
      title={`Dosije: ${firstName} ${lastName}`.trim()}
      onClose={onClose}
      panel
      bodyClassName="flex min-h-0 flex-1 flex-col lg:flex-row"
      header={
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink">{initials}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="truncate text-lg font-semibold leading-tight text-ink">
                {firstName} {lastName}
              </h2>
              {candidate.activationCode && <span className="text-[13px] tabular-nums text-ink-3">{candidate.activationCode}</span>}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-ink-3">{[email, phone].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      }
      footer={
        <>
          <p className="hidden text-[13px] text-ink-3 sm:block">
            <span className="font-medium text-ink">{stepInfo.stepTitle}</span> · {stepInfo.subLabel}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("admin.modalCancel")}
            </Button>
            <Button variant="dark" onClick={handleSubmit}>
              Sačuvaj izmene
            </Button>
          </div>
        </>
      }
    >
      {/* Navigacija dosijea */}
      <nav aria-label="Delovi dosijea" className="shrink-0 border-b border-line bg-white lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2.5 lg:flex-col lg:gap-0.5 lg:p-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-full px-3.5 py-1.5 text-left text-[13px] font-medium transition-colors lg:rounded-lg lg:py-2 lg:text-sm ${
                  isActive ? "bg-ink text-white lg:bg-surface lg:text-ink" : "text-ink-3 hover:bg-surface hover:text-ink"
                }`}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                      isActive ? "bg-brand text-ink" : "bg-brand text-ink"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface px-4 py-5 sm:px-8 sm:py-7">
        <h3 className="text-xl font-semibold text-ink [font-stretch:100%] tracking-[-0.015em]">{activeTabInfo.label}</h3>

        {adminToast && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white">
            <span>{adminToast}</span>
            <button type="button" onClick={() => setAdminToast("")} aria-label="Zatvori obaveštenje" className="-mr-1 rounded p-0.5 text-white/70 hover:text-white">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =================== PREGLED =================== */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Section title="Čeka tebe" aside={<span className="text-[13px] text-ink-3">{queue.length || "Ništa"}</span>}>
              {queue.length === 0 ? (
                <p className="text-sm text-ink-3">Nema ničeg na čekanju — red je na kandidatu.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {queue.map((q) => (
                    <li key={q.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-3.5">
                        <TaskIcon state="wait" className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-ink">{q.title}</p>
                          {q.desc && <p className="mt-0.5 truncate text-[13px] text-ink-3">{q.desc}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[2.125rem] sm:pl-0">{q.actions}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Put kandidata">
              <ol className="grid gap-3 sm:grid-cols-4">
                {stages.map((s) => {
                  const isCurrent = s.id === currentStageId;
                  return (
                    <li key={s.id} className="flex gap-3 sm:block">
                      <TaskIcon state={s.done ? "done" : isCurrent ? "current" : "locked"} isNext={isCurrent} />
                      <div className="sm:mt-2.5">
                        <p className="text-xs text-ink-3">{s.label}</p>
                        <p className={`text-sm font-medium ${s.done || isCurrent ? "text-ink" : "text-ink-3"}`}>{s.title}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Ukratko">
                <DataList
                  cols={1}
                  items={[
                    ["Program", selectedPackage.name],
                    ["Cena", `${formatUsd(finalPrice)}${numDiscount ? ` (popust ${formatUsd(numDiscount)})` : ""}`],
                    ["Plaćeno", `${formatUsd(totalPaidEur)} od ${formatUsd(finalPrice)}`],
                    ["Posao", selectedJobEmployer ? `${selectedJobTitle} — ${selectedJobEmployer}` : "Nije izabran"],
                    ["Fakultet", faculty || "—"],
                  ]}
                />
              </Section>
              <Section title="Dokumenta" aside={<button type="button" onClick={() => go("docs")} className={linkCls}>Sva dokumenta</button>}>
                <ul className="divide-y divide-line">
                  {[
                    ["Potpisani ugovor", contractApproved ? "done" : contractSigned ? "wait" : "current"],
                    ["CV", cvFileName ? "done" : "current"],
                    ["Video", youtubeUrl ? "done" : "current"],
                    ["Uverenje o studiranju", facultyCertFileName ? (facultyCertAiTranslation ? "done" : "wait") : "current"],
                    ["MUP uverenje", policeCertificateFileName ? (policeCertificateTranslated ? "done" : "wait") : "current"],
                    ["DS-160", ds160St.isComplete ? "done" : ds160St.isStarted ? "wait" : "current"],
                  ].map(([n, st]) => (
                    <li key={n} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <TaskIcon state={st} className="h-4 w-4" />
                      <span className="text-sm text-ink-2">{n}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </div>
        )}

        {/* =================== DOKUMENTA =================== */}
        {activeTab === "docs" && (
          <div className="space-y-4">
            <Section
              title="Ugovor"
              aside={
                <button type="button" onClick={() => openPrintableContractWindow({ id: candidate.id, email })} className={linkCls}>
                  Ugovor za štampu
                </button>
              }
            >
              <ul className="divide-y divide-line">
                <DocRow
                  name="Potpisani ugovor"
                  sub={signedContractFileName || "Kandidat ga još nije okačio"}
                  state={contractApproved ? "done" : contractVerificationStatus === "rejected" ? "danger" : contractSigned ? "wait" : "current"}
                  status={contractApproved ? "Odobren" : contractVerificationStatus === "rejected" ? "Vraćen" : contractSigned ? "Čeka pregled" : "Nedostaje"}
                >
                  {signedContractFileName && (
                    <button type="button" onClick={openContract} className={linkCls}>
                      Otvori
                    </button>
                  )}
                  <Upload busy={uploadingDocType === "signedContract"} onFile={(f) => handleAdminDocUpload(f, "signedContract")} label={signedContractFileName ? "Zameni" : "Okači sken"} />
                  {contractSigned && !contractApproved && (
                    <>
                      <button type="button" onClick={() => handleVerifyContractAction(true)} className={linkCls}>
                        Odobri
                      </button>
                      <button type="button" onClick={rejectContract} className={`${linkCls} text-red-700`}>
                        Vrati
                      </button>
                    </>
                  )}
                </DocRow>
                {contractRejectionReason && !contractApproved && (
                  <li className="py-2 text-[13px] text-red-700">Razlog: {contractRejectionReason}</li>
                )}
                <DocRow name="Pasoš" sub={passportScanFileName || "Sken nije okačen"} state={passportScan ? "done" : "current"} status={passportScan ? "Okačen" : "Nedostaje"}>
                  {passportScan && (
                    <button
                      type="button"
                      onClick={() => openDocumentPreview("Pasoš", passportScanFileName || "Pasos.pdf", passportScanUrl, passportScanDataUrl, "passport")}
                      className={linkCls}
                    >
                      Otvori
                    </button>
                  )}
                  <Upload busy={uploadingDocType === "passport"} onFile={(f) => handleAdminDocUpload(f, "passport")} label={passportScan ? "Zameni" : "Okači sken"} />
                </DocRow>
              </ul>
            </Section>

            <Section
              title="Dosije"
              hint="Ovo kandidat šalje na pregled u Koraku 1. Kad je sve u redu, odobri — kandidat prelazi na izbor posla."
              aside={
                <StatusText state={documentsApproved ? "done" : documentsVerificationStatus === "rejected" ? "danger" : docsSubmitted ? "wait" : "current"}>
                  {documentsApproved ? "Odobren" : documentsVerificationStatus === "rejected" ? "Vraćen" : docsSubmitted ? "Na pregledu" : "Nije poslat"}
                </StatusText>
              }
            >
              <ul className="divide-y divide-line">
                <DocRow name="CV" sub={cvFileName || "Nije okačen"} state={cvFileName ? "done" : "current"} status={cvFileName ? "Okačen" : "Nedostaje"}>
                  {(cvDataUrl || cvUrl) && (
                    <button type="button" onClick={() => openDocumentPreview("CV", cvFileName, cvUrl, cvDataUrl, "documents")} className={linkCls}>
                      Otvori
                    </button>
                  )}
                  <Upload busy={uploadingDocType === "cv"} onFile={(f) => handleAdminDocUpload(f, "cv")} label={cvFileName ? "Zameni" : "Okači"} accept=".pdf,.doc,.docx" />
                  <button type="button" onClick={() => setShowProfileBuilder(true)} className={linkCls}>
                    Profil i CV builder
                  </button>
                </DocRow>
                <DocRow name="Video predstavljanje" sub={youtubeUrl || "Link nije dodat"} state={youtubeUrl ? "done" : "current"} status={youtubeUrl ? "Dodat" : "Nedostaje"}>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtu.be/…"
                    className={`${FIELD_CLS} max-w-sm`}
                  />
                  {youtubeUrl && (
                    <a href={youtubeUrl} target="_blank" rel="noreferrer" className={linkCls}>
                      Pogledaj
                    </a>
                  )}
                </DocRow>
                <DocRow
                  name="Uverenje o studiranju"
                  sub={facultyCertFileName || "Nije okačeno"}
                  state={facultyCertFileName ? (facultyCertAiTranslation ? "done" : "wait") : "current"}
                  status={facultyCertFileName ? (facultyCertAiTranslation ? "Sa prevodom" : "Fali prevod") : "Nedostaje"}
                >
                  {(facultyCertDataUrl || facultyCertUrl) && (
                    <button
                      type="button"
                      onClick={() => openDocumentPreview("Uverenje o studiranju", facultyCertFileName, facultyCertUrl, facultyCertDataUrl, "documents")}
                      className={linkCls}
                    >
                      Otvori
                    </button>
                  )}
                  <Upload busy={uploadingDocType === "facultyCert"} onFile={(f) => handleAdminDocUpload(f, "facultyCert")} label={facultyCertFileName ? "Zameni" : "Okači"} />
                  <Toggle checked={facultyCertAiTranslation} onChange={setFacultyCertAiTranslation}>
                    Prevod gotov
                  </Toggle>
                </DocRow>
                <DocRow
                  name="Uverenje o nekažnjavanju (MUP)"
                  sub={policeCertificateFileName || "Nije okačeno"}
                  state={policeCertificateFileName ? (policeCertificateTranslated ? "done" : "wait") : "current"}
                  status={policeCertificateFileName ? (policeCertificateTranslated ? "Sa prevodom" : "Fali prevod") : "Nedostaje"}
                >
                  {(policeCertificateDataUrl || policeCertificateUrl) && (
                    <button
                      type="button"
                      onClick={() =>
                        openDocumentPreview("MUP uverenje", policeCertificateFileName, policeCertificateUrl, policeCertificateDataUrl, "documents")
                      }
                      className={linkCls}
                    >
                      Otvori
                    </button>
                  )}
                  <Upload busy={uploadingDocType === "policeCert"} onFile={(f) => handleAdminDocUpload(f, "policeCert")} label={policeCertificateFileName ? "Zameni" : "Okači"} />
                  <Toggle checked={policeCertificateTranslated} onChange={setPoliceCertificateTranslated}>
                    Prevod gotov
                  </Toggle>
                </DocRow>
              </ul>

              {documentsRejectionReason && !documentsApproved && (
                <p className="mt-4 text-[13px] text-red-700">Razlog za dopunu: {documentsRejectionReason}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Button size="sm" variant="dark" onClick={() => handleVerifyDocumentsAction(true)}>
                  {documentsApproved ? "Odobren" : "Odobri dosije"}
                </Button>
                <Button size="sm" variant="outline" onClick={rejectDocs}>
                  Vrati na dopunu
                </Button>
              </div>
            </Section>

            <Section title="Posao i viza">
              <ul className="divide-y divide-line">
                <DocRow
                  name="Job Offer"
                  sub={selectedJobEmployer ? `${selectedJobTitle} — ${selectedJobEmployer}` : "Kandidat još nema posao"}
                  state={offerSigned ? "done" : jobAccepted ? "wait" : selectedJobEmployer ? "current" : "locked"}
                  status={
                    offerSigned
                      ? `Potpisan ${new Date(candidate.jobOfferSignedAt).toLocaleDateString("sr-RS")}`
                      : jobAccepted
                      ? "Čeka potpis kandidata"
                      : "Kasnije"
                  }
                >
                  {offerSigned && candidate.jobOfferSignature && (
                    <span className="font-serif text-[15px] italic text-ink-2">{candidate.jobOfferSignature}</span>
                  )}
                </DocRow>
                <DocRow
                  name="DS-160 upitnik"
                  sub={ds160St.isComplete ? "Popunjen" : ds160St.isStarted ? `${ds160St.filledCount} od ${ds160St.totalCount} polja` : "Nije počet"}
                  state={ds160St.isComplete ? "done" : ds160St.isStarted ? "wait" : "current"}
                  status={ds160St.isComplete ? "Popunjen" : ds160St.isStarted ? "U izradi" : "Nije počet"}
                >
                  <a href="/documents/UPITNIK_za_izradu_DS160_J1.docx" download="UPITNIK_za_izradu_DS160_J1.docx" className={linkCls}>
                    Prazan upitnik (.docx)
                  </a>
                </DocRow>
                <DocRow
                  name="DS-2019"
                  sub={ds2019Number ? `SEVIS ${ds2019Number}` : "Izdaje sponzor"}
                  state={ds2019Status === "ISSUED" ? "done" : ds2019Status === "IN_PROGRESS" ? "wait" : "locked"}
                  status={ds2019Status === "ISSUED" ? "Izdat" : ds2019Status === "IN_PROGRESS" ? "U izradi" : "Čeka II ratu"}
                />
                <DocRow name="J-1 viza" sub="Posle razgovora u ambasadi" state={hasVisa ? "done" : status === "departure" ? "wait" : "locked"} status={hasVisa ? "Odobrena" : "Kasnije"} />
              </ul>

              {ds160Entries.length > 0 && (
                <details className="mt-5 border-t border-line pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-ink">Odgovori iz DS-160 ({ds160Entries.length})</summary>
                  <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                    {ds160Entries.map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5 border-b border-line py-2">
                        <dt className="text-xs text-ink-3">{k}</dt>
                        <dd className="break-words text-sm text-ink">{String(v || "—")}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </Section>

            <Section title="Obrasci agencije">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <button type="button" onClick={() => openPrintableContractWindow({ id: candidate.id, email })} className={linkCls}>
                  Ugovor za štampu
                </button>
                <a href="/documents/UPITNIK_za_izradu_DS160_J1.docx" download className={linkCls}>
                  DS-160 upitnik (.docx)
                </a>
                <a href="/documents/Uplatnica_viziranje.docx" download="Uplatnica_viziranje.docx" className={linkCls}>
                  Uplatnica za vizu (.docx)
                </a>
                <a href="/documents/Narudzbenica-avio-karte.pdf" target="_blank" rel="noreferrer" className={linkCls}>
                  Narudžbenica avio karte
                </a>
                <a href="/documents/AA_Instrukcija_za_video_CV.pdf" download className={linkCls}>
                  Uputstvo za video
                </a>
              </div>
            </Section>
          </div>
        )}

        {/* =================== UPLATE =================== */}
        {activeTab === "pay" && (
          <div className="space-y-4">
            <dl className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}>
              {[
                ["Za uplatu", finalPrice, null, "text-ink"],
                ["Popust", numDiscount, null, "text-emerald-700"],
                ["Plaćeno", totalPaidEur, totalPaidRsd || null, "text-emerald-700"],
                ["Preostalo", remainingEur, null, remainingEur > 0 ? "text-ink" : "text-ink-3"],
              ].map(([k, eur, rsd, tone]) => (
                <div key={k} className="px-4 py-3.5 sm:px-5">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{formatUsd(eur)}</dd>
                  {rsd ? <dd className="text-xs tabular-nums text-ink-3">{formatRsd(rsd)}</dd> : null}
                </div>
              ))}
            </dl>

            <Section
              title="Uplate"
              hint="Potvrdi uplatu kad je vidiš na izvodu. Server zaključava srednji kurs NBS na dan prijema i izdaje fakturu."
            >
              <ul className="divide-y divide-line">
                {(isFull
                  ? [
                      {
                        num: "full",
                        title: "Program u celosti",
                        eur: finalPrice,
                        paid: firstPaid,
                        status: firstInstallmentStatus,
                        paidRsd: candidate.fullPaymentPaidRsd,
                        rate: candidate.fullPaymentExchangeRate,
                        paidDate: candidate.fullPaymentPaidDate,
                      },
                    ]
                  : [
                      {
                        num: 1,
                        title: "I rata — uz ugovor",
                        eur: r1Amount,
                        paid: firstInstallmentApproved,
                        status: firstInstallmentStatus,
                        paidRsd: candidate.firstInstallmentPaidRsd,
                        rate: candidate.firstInstallmentExchangeRate,
                        paidDate: candidate.firstInstallmentPaidDate,
                      },
                      {
                        num: 2,
                        title: "II rata — uz Job Offer",
                        eur: r2Amount,
                        paid: secondInstallmentPaid,
                        status: secondInstallmentStatus,
                        paidRsd: candidate.secondInstallmentPaidRsd,
                        rate: candidate.secondInstallmentExchangeRate,
                        paidDate: candidate.secondInstallmentPaidDate,
                      },
                      {
                        num: 3,
                        title: paymentMethod === "now" ? "III rata — pred vizu" : "III rata — pred vizu ili PKZ",
                        eur: r3Amount,
                        paid: thirdInstallmentPaid,
                        status: thirdInstallmentStatus,
                        paidRsd: candidate.thirdInstallmentPaidRsd,
                        rate: candidate.thirdInstallmentExchangeRate,
                        paidDate: candidate.thirdInstallmentPaidDate,
                      },
                    ]
                ).map((r) => {
                  const rsd = r.paid && r.paidRsd ? r.paidRsd : null;
                  const formOpen = payForm && String(payForm.num) === String(r.num);
                  const st = r.paid ? "done" : r.status === "pending" ? "wait" : "current";
                  return (
                    <li key={r.num} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-3.5">
                        <TaskIcon state={st} className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-ink">{r.title}</p>
                          <p className="mt-0.5 text-[13px] text-ink-3">
                            {r.paid
                              ? `Proknjiženo ${r.paidDate || ""}${r.rate ? ` · kurs ${Number(r.rate).toFixed(4)}` : ""}`
                              : r.status === "pending"
                              ? "Kandidat je prijavio uplatu"
                              : "Nije plaćeno"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 pl-[2.125rem] sm:pl-0">
                        <div className="text-right">
                          <p className="text-[15px] font-semibold tabular-nums text-ink">{formatUsd(r.eur)}</p>
                          {rsd ? <p className="text-xs tabular-nums text-ink-3">{formatRsd(rsd)}</p> : null}
                        </div>
                        {!r.paid && !formOpen && (
                          <Button size="sm" variant={r.status === "pending" ? "dark" : "outline"} onClick={() => openPayForm(r.num)}>
                            Proknjiži
                          </Button>
                        )}
                      </div>
                      {formOpen && (
                        <div className="w-full rounded-xl bg-surface p-4 sm:basis-full">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label="Datum prijema uplate">
                              <input
                                type="date"
                                value={payForm.receivedAt}
                                max={new Date().toISOString().slice(0, 10)}
                                onChange={(e) => setPayForm((f) => ({ ...f, receivedAt: e.target.value }))}
                                className={FIELD_CLS}
                              />
                            </Field>
                            <Field label="Srednji kurs NBS (USD)">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Automatski za taj dan"
                                value={payForm.rate}
                                onChange={(e) => setPayForm((f) => ({ ...f, rate: e.target.value }))}
                                className={`${FIELD_CLS} tabular-nums`}
                              />
                            </Field>
                            <Field label="Poziv na broj / izvod">
                              <input
                                type="text"
                                maxLength={160}
                                value={payForm.reference}
                                onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                                className={FIELD_CLS}
                              />
                            </Field>
                          </div>
                          {payForm.error && <p className="mt-3 text-[13px] text-red-700">{payForm.error}</p>}
                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setPayForm(null)} disabled={payForm.busy}>
                              Otkaži
                            </Button>
                            <Button size="sm" variant="dark" onClick={() => handleConfirmInstallmentAction(r.num, payForm)} disabled={payForm.busy || !payForm.receivedAt}>
                              {payForm.busy ? "Izdajem fakturu…" : `Potvrdi ${formatUsd(r.eur)} i izdaj fakturu`}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Plan plaćanja" hint="Iznosi rata mogu da se prilagode ovom kandidatu.">
              <div className="grid items-end gap-3 sm:grid-cols-2 md:grid-cols-4">
                <Field label="Model plaćanja">
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={FIELD_CLS}>
                    <option value="now">Jednokratno, u celosti</option>
                    <option value="installments">Na rate (I, II i III)</option>
                    <option value="later">PKZ, plaćanje kroz zaradu</option>
                  </select>
                </Field>
                {paymentMethod !== "now" && (
                  <>
                    <Field label="I rata (USD)">
                      <input type="number" min="0" step="10" value={firstInstallmentAmount} onChange={(e) => setFirstInstallmentAmount(Number(e.target.value) || 0)} className={FIELD_CLS} />
                    </Field>
                    <Field label="II rata (USD)">
                      <input type="number" min="0" step="10" value={secondInstallmentAmount} onChange={(e) => setSecondInstallmentAmount(Number(e.target.value) || 0)} className={FIELD_CLS} />
                    </Field>
                    <Field label="III rata (USD)">
                      <div className="flex gap-1.5">
                        <input type="number" min="0" step="10" value={thirdInstallmentAmount} onChange={(e) => setThirdInstallmentAmount(Number(e.target.value) || 0)} className={FIELD_CLS} />
                        <button
                          type="button"
                          onClick={() => {
                            const balanced = Math.max(0, finalPrice - Number(firstInstallmentAmount || 0) - Number(secondInstallmentAmount || 0));
                            setThirdInstallmentAmount(balanced);
                            showToast(`III rata je podešena na ${balanced} USD, da zbir odgovara ceni.`);
                          }}
                          title="Izračunaj III ratu"
                          className="shrink-0 rounded-lg border border-line-strong px-2.5 text-xs font-medium text-ink hover:bg-surface"
                        >
                          Auto
                        </button>
                      </div>
                    </Field>
                  </>
                )}
              </div>
              {paymentMethod !== "now" && (
                <p className="mt-3 text-[13px] text-ink-3">
                  Zbir rata {formatUsd(firstInstallmentAmount + secondInstallmentAmount + thirdInstallmentAmount)}
                  {firstInstallmentAmount + secondInstallmentAmount + thirdInstallmentAmount === finalPrice ? (
                    <span className="text-emerald-700"> — odgovara ceni</span>
                  ) : (
                    <span className="text-amber-700">
                      {" "}
                      — razlika {formatUsd(finalPrice - (firstInstallmentAmount + secondInstallmentAmount + thirdInstallmentAmount))}
                    </span>
                  )}
                </p>
              )}
            </Section>

            <Section title="Paket i popust">
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Field label="Paket">
                  <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className={FIELD_CLS}>
                    {PROGRAM_PACKAGES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.basePrice} USD)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Promocija">
                  <select
                    value={discountId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDiscountId(val);
                      if (val === "none") {
                        setDiscount(0);
                        setDiscountNote("");
                      } else {
                        const found = promotions.find((p) => p.id === val);
                        if (found) {
                          setDiscount(found.amount);
                          setDiscountNote(found.title);
                          setDiscountTiming(found.timing || "immediate");
                        }
                      }
                    }}
                    className={FIELD_CLS}
                  >
                    <option value="none">Bez promocije / ručno</option>
                    {promotions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (−{p.amount} USD)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Iznos popusta (USD)">
                  <input type="number" min="0" max={basePrice} value={discount} onChange={(e) => setDiscount(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Napomena o popustu">
                  <input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} placeholder="npr. Rana prijava" className={FIELD_CLS} />
                </Field>
                <Field label="Obračun popusta">
                  <select value={discountTiming} onChange={(e) => setDiscountTiming(e.target.value)} className={FIELD_CLS}>
                    <option value="immediate">Odmah umanjuje cenu</option>
                    <option value="end">Na poslednjoj rati</option>
                  </select>
                </Field>
                <div className="flex items-end pb-2.5">
                  <Toggle checked={discountVerified} onChange={setDiscountVerified}>
                    Uslov popusta proveren
                  </Toggle>
                </div>
                <Field label="Preporučio ga je">
                  <input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Kod ili ime" className={FIELD_CLS} />
                </Field>
                <Field label="Šifra grupe">
                  <input value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="BG-SUMMER-2026" className={FIELD_CLS} />
                </Field>
                <div className="flex flex-col justify-end pb-2.5 text-[13px] text-ink-3">
                  Kod kandidata za preporuke: <span className="font-medium tabular-nums text-ink">{candidate.referralCode || "—"}</span>
                </div>
              </div>

              {(paymentMethod === "later" || paymentMethod === "installments" || guarantorName) && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-3 text-sm font-medium text-ink">Jemac (za PKZ i odloženo plaćanje)</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Ime i prezime">
                      <input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="Broj lične karte">
                      <input value={guarantorIdCard} onChange={(e) => setGuarantorIdCard(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="JMBG">
                      <input value={guarantorJmbg} onChange={(e) => setGuarantorJmbg(e.target.value)} maxLength={13} className={`${FIELD_CLS} tabular-nums`} />
                    </Field>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Fakture" hint="Izdaje ih server pri potvrdi uplate. Brojevi su zajednički za KIR.">
              {candidateInvoices.length === 0 ? (
                <p className="text-sm text-ink-3">Još nema faktura.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {candidateInvoices.map((inv) => (
                    <li key={inv.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {inv.invoiceNumber} · {INSTALLMENT_LABEL[inv.installment] || inv.installment}
                        </p>
                        <p className="text-[13px] tabular-nums text-ink-3">
                          {formatUsd(inv.amountUsd)} × {Number(inv.exchangeRate).toFixed(4)} = {formatRsd(inv.settlementRsd)}
                          {inv.paymentReference ? ` · ${inv.paymentReference}` : ""}
                        </p>
                      </div>
                      <a href={portalInvoicePdfUrl(inv.id)} className={linkCls}>
                        Preuzmi PDF
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {/* =================== POSAO =================== */}
        {activeTab === "job" &&
          (() => {
            const allCatalogJobs = getJobs();
            const offeredCount = offerAllJobs ? allCatalogJobs.length : offeredJobIds.length;
            const toggleJobOffer = (jobId) =>
              setOfferedJobIds((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]));
            const saveJob = (overrides, msg) => {
              onSave(buildUpdatedCandidate(overrides), { keepOpen: true });
              showToast(msg);
            };

            return (
              <div className="space-y-4">
                <Section
                  title="Izabrani posao"
                  aside={
                    <StatusText
                      state={
                        jobAccepted ? "done" : jobApplicationStatus === "NO_SLOTS" || jobApplicationStatus === "REJECTED" ? "danger" : jobApplicationStatus ? "wait" : "current"
                      }
                    >
                      {jobAccepted
                        ? offerSigned
                          ? "Job Offer potpisan"
                          : "Prihvaćen"
                        : jobApplicationStatus === "SCHEDULED"
                        ? "Razgovor zakazan"
                        : jobApplicationStatus === "APPLIED"
                        ? "Čeka termin"
                        : jobApplicationStatus === "NO_SLOTS"
                        ? "Nema termina"
                        : jobApplicationStatus === "REJECTED"
                        ? "Odbijen"
                        : "Nije izabran"}
                    </StatusText>
                  }
                >
                  <Field label="Izaberi iz baze poslova">
                    <select
                      value=""
                      onChange={(e) => {
                        const job = allCatalogJobs.find((j) => String(j.id) === String(e.target.value));
                        if (job) {
                          setSelectedJobTitle(job.title);
                          setSelectedJobEmployer(job.employer);
                          setSelectedJobCity(job.city);
                          setSelectedJobWage(job.wage);
                          setSelectedJobHousing(job.housing);
                          setJobApplicationStatus("APPLIED");
                        }
                      }}
                      className={FIELD_CLS}
                    >
                      <option value="">—</option>
                      {allCatalogJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.employer}: {j.title} ({j.city}, {j.wage})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="mt-3.5 grid gap-3.5 sm:grid-cols-3">
                    <Field label="Poslodavac">
                      <input value={selectedJobEmployer} onChange={(e) => setSelectedJobEmployer(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="Pozicija">
                      <input value={selectedJobTitle} onChange={(e) => setSelectedJobTitle(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="Mesto">
                      <input value={selectedJobCity} onChange={(e) => setSelectedJobCity(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="Satnica">
                      <input value={selectedJobWage} onChange={(e) => setSelectedJobWage(e.target.value)} placeholder="$16.50 / sat" className={FIELD_CLS} />
                    </Field>
                    <Field label="Smeštaj">
                      <input value={selectedJobHousing} onChange={(e) => setSelectedJobHousing(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <div className="flex items-end pb-2.5">
                      <Toggle
                        checked={hasJob}
                        onChange={(v) => {
                          setHasJob(v);
                          if (v) setJobApplicationStatus("ACCEPTED");
                        }}
                      >
                        Job Offer potvrđen
                      </Toggle>
                    </div>
                  </div>
                  {offerSigned && (
                    <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-3">
                      Kandidat je potpisao Job Offer {new Date(candidate.jobOfferSignedAt).toLocaleDateString("sr-RS")}
                      {candidate.jobOfferSignature ? ` kao „${candidate.jobOfferSignature}“` : ""}.
                    </p>
                  )}
                </Section>

                <Section title="Razgovor sa poslodavcem">
                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <Field label="Termin">
                      <input type="datetime-local" value={interviewScheduledAt} onChange={(e) => setInterviewScheduledAt(e.target.value)} className={FIELD_CLS} />
                    </Field>
                    <Field label="Format">
                      <select value={interviewType} onChange={(e) => setInterviewType(e.target.value)} className={FIELD_CLS}>
                        <option value="ONLINE">Online</option>
                        <option value="IN_PERSON">Uživo</option>
                      </select>
                    </Field>
                    <Field label="Link ili adresa">
                      <input value={interviewLink} onChange={(e) => setInterviewLink(e.target.value)} placeholder="https://meet.google.com/…" className={FIELD_CLS} />
                    </Field>
                  </div>
                  <div className="mt-3.5">
                    <Field label="Poruka kandidatu">
                      <input value={interviewNote} onChange={(e) => setInterviewNote(e.target.value)} placeholder="Uputstvo za razgovor ili razlog odbijanja" className={FIELD_CLS} />
                    </Field>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button
                      size="sm"
                      variant="dark"
                      onClick={() => {
                        if (!interviewScheduledAt) {
                          showToast("Unesi datum i vreme razgovora.");
                          return;
                        }
                        setJobApplicationStatus("SCHEDULED");
                        setHasJob(false);
                        saveJob(
                          { jobApplicationStatus: "SCHEDULED", interviewScheduledAt, interviewType, interviewLink, interviewNote, hasJob: false },
                          "Razgovor je zakazan. Kandidat ga vidi u svom nalogu."
                        );
                      }}
                    >
                      Zakaži razgovor
                    </Button>
                    <Button
                      size="sm"
                      variant="dark"
                      onClick={() => {
                        setJobApplicationStatus("ACCEPTED");
                        setHasJob(true);
                        saveJob({ jobApplicationStatus: "ACCEPTED", hasJob: true }, "Poslodavac je prihvatio kandidata. Kandidat sada potpisuje Job Offer.");
                      }}
                    >
                      Prihvaćen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = interviewNote || "Poslodavac trenutno nema slobodnih termina. Izaberi drugi posao iz baze.";
                        setJobApplicationStatus("NO_SLOTS");
                        setHasJob(false);
                        if (!interviewNote) setInterviewNote(note);
                        saveJob({ jobApplicationStatus: "NO_SLOTS", interviewNote: note, hasJob: false }, "Evidentirano: nema termina. Kandidat je obavešten.");
                      }}
                    >
                      Nema termina
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const note = interviewNote || "Poslodavac nije prihvatio kandidata. Izaberi novi posao iz baze.";
                        setJobApplicationStatus("REJECTED");
                        setHasJob(false);
                        if (!interviewNote) setInterviewNote(note);
                        saveJob({ jobApplicationStatus: "REJECTED", interviewNote: note, hasJob: false }, "Evidentirano: poslodavac je odbio kandidata. Izbor posla je ponovo otvoren.");
                      }}
                    >
                      Odbijen
                    </Button>
                  </div>
                </Section>

                <Section title="Ponude koje kandidat vidi" aside={<span className="text-[13px] text-ink-3">{offeredCount} ponuda</span>}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Toggle checked={offerAllJobs} onChange={setOfferAllJobs}>
                      Sve iz baze poslova
                    </Toggle>
                    {!offerAllJobs && (
                      <div className="flex gap-4">
                        <button type="button" onClick={() => setOfferedJobIds(allCatalogJobs.map((j) => j.id))} className={linkCls}>
                          Označi sve
                        </button>
                        <button type="button" onClick={() => setOfferedJobIds([])} className={linkCls}>
                          Poništi
                        </button>
                      </div>
                    )}
                  </div>
                  {!offerAllJobs && (
                    <ul className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                      {allCatalogJobs.map((job) => {
                        const isOffered = offeredJobIds.includes(job.id);
                        return (
                          <li key={job.id}>
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                                isOffered ? "border-ink bg-white" : "border-line bg-white hover:border-line-strong"
                              }`}
                            >
                              <input type="checkbox" checked={isOffered} onChange={() => toggleJobOffer(job.id)} className="mt-0.5 h-4 w-4 accent-neutral-900" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{job.title}</span>
                                <span className="block truncate text-[13px] text-ink-3">
                                  {job.employer}, {job.city} · {job.wage}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>
              </div>
            );
          })()}

        {/* =================== VIZA I LET =================== */}
        {activeTab === "visa" && (
          <div className="space-y-4">
            <Section title="DS-2019 i ambasada">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="DS-2019">
                  <select value={ds2019Status} onChange={(e) => setDs2019Status(e.target.value)} className={FIELD_CLS}>
                    <option value="LOCKED">Čeka II ratu</option>
                    <option value="IN_PROGRESS">U izradi kod sponzora</option>
                    <option value="ISSUED">Izdat, SEVIS aktivan</option>
                  </select>
                </Field>
                <Field label="SEVIS / DS-2019 broj">
                  <input value={ds2019Number} onChange={(e) => setDs2019Number(e.target.value)} placeholder="N0012345678" className={`${FIELD_CLS} tabular-nums`} />
                </Field>
                <Field label="Razgovor u ambasadi">
                  <input type="datetime-local" value={embassyInterviewDate} onChange={(e) => setEmbassyInterviewDate(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Probni razgovor">
                  <select value={embassyPrepStatus} onChange={(e) => setEmbassyPrepStatus(e.target.value)} className={FIELD_CLS}>
                    <option value="NOT_SCHEDULED">Nije održan</option>
                    <option value="SCHEDULED">Zakazan</option>
                    <option value="COMPLETED">Održan</option>
                  </select>
                </Field>
              </div>
              <p className="mt-4 text-[13px] text-ink-3">
                DS-160: {ds160St.isComplete ? "popunjen" : ds160St.isStarted ? `${ds160St.filledCount} od ${ds160St.totalCount} polja` : "nije počet"} ·{" "}
                <button type="button" onClick={() => go("docs")} className={linkCls}>
                  odgovori u Dokumentima
                </button>
              </p>
            </Section>

            <Section
              title="Odluka o vizi"
              aside={<StatusText state={hasVisa ? "done" : "wait"}>{hasVisa ? "Odobrena" : "Čeka razgovor"}</StatusText>}
              hint="Kad ambasada odobri J-1 vizu, potvrdi je ovde — kandidat dobija status Viza odobrena."
            >
              {!hasVisa ? (
                <Button
                  variant="dark"
                  onClick={() => {
                    setHasVisa(true);
                    setStatus("ready");
                    onSave(buildUpdatedCandidate({ hasVisa: true, status: "ready" }), { keepOpen: true });
                    showToast("J-1 viza je potvrđena. Kandidat ima status Viza odobrena.");
                  }}
                >
                  Potvrdi odobrenu vizu
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setHasVisa(false);
                    setStatus("departure");
                    onSave(buildUpdatedCandidate({ hasVisa: false, status: "departure" }), { keepOpen: true });
                    showToast("Status je vraćen na Čekanje na vizu.");
                  }}
                >
                  Vrati na čekanje vize
                </Button>
              )}
            </Section>

            <Section title="Let i orijentacija">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Polazak">
                  <input type="date" value={flightDepartureDate} onChange={(e) => setFlightDepartureDate(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Povratak">
                  <input type="date" value={flightReturnDate} onChange={(e) => setFlightReturnDate(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Avio karta">
                  <select value={flightTicketStatus} onChange={(e) => setFlightTicketStatus(e.target.value)} className={FIELD_CLS}>
                    <option value="PENDING">Nije kupljena</option>
                    <option value="BOOKED">Rezervisana</option>
                    <option value="ISSUED">Izdata</option>
                  </select>
                </Field>
                <div className="flex items-end pb-2.5">
                  <Toggle checked={orientationAttended} onChange={setOrientationAttended}>
                    Orijentacija održana
                  </Toggle>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* =================== PODACI =================== */}
        {activeTab === "data" && (
          <div className="space-y-4">
            <Section title="Lični podaci" hint="Isti podaci idu u ugovor i DS-160.">
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Field label="Ime">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={FIELD_CLS} required />
                </Field>
                <Field label="Prezime">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD_CLS} required />
                </Field>
                <Field label="E-mail">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD_CLS} required />
                </Field>
                <Field label="Telefon">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="JMBG">
                  <input value={jmbg} onChange={(e) => setJmbg(e.target.value)} maxLength={13} className={`${FIELD_CLS} tabular-nums`} />
                </Field>
                <Field label="Broj pasoša / lične karte">
                  <input
                    value={passportNumber}
                    onChange={(e) => {
                      setPassportNumber(e.target.value);
                      setIdCardNumber(e.target.value);
                    }}
                    className={`${FIELD_CLS} tabular-nums`}
                  />
                </Field>
                <Field label="Datum rođenja">
                  <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="DD/MM/GGGG" className={FIELD_CLS} />
                </Field>
                <Field label="Pasoš važi do">
                  <input value={passportExpiryDate} onChange={(e) => setPassportExpiryDate(e.target.value)} placeholder="DD/MM/GGGG" className={FIELD_CLS} />
                </Field>
                <Field label="Pol">
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={FIELD_CLS}>
                    <option value="Muški">Muški</option>
                    <option value="Ženski">Ženski</option>
                  </select>
                </Field>
                <Field label="Mesto rođenja">
                  <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Državljanstvo">
                  <input value={citizenship} onChange={(e) => setCitizenship(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Adresa">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={FIELD_CLS} />
                </Field>
              </div>
            </Section>

            <Section title="Studije">
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Field label="Fakultet">
                  <input value={faculty} onChange={(e) => setFaculty(e.target.value)} className={FIELD_CLS} />
                </Field>
                <Field label="Godina">
                  <select value={studyYear} onChange={(e) => setStudyYear(e.target.value)} className={FIELD_CLS}>
                    <option value="YEAR_1">I godina</option>
                    <option value="YEAR_2">II godina</option>
                    <option value="YEAR_3">III godina</option>
                    <option value="YEAR_4">IV godina</option>
                    <option value="MASTER">Master</option>
                  </select>
                </Field>
                <Field label="ESPB">
                  <input type="number" min="0" max="300" value={ectsPoints} onChange={(e) => setEctsPoints(e.target.value)} className={FIELD_CLS} />
                </Field>
              </div>
            </Section>

            <Section
              title="Profil za poslodavce"
              hint="Ono što je kandidat uneo u portalu, korak po korak."
              aside={
                <button type="button" onClick={() => setShowProfileBuilder(true)} className={linkCls}>
                  Izmeni
                </button>
              }
            >
              <DataList
                items={[
                  ["Status", prof.profileCompleted ? `Popunjen (${prof.profileCompletionScore || 100}%)` : "Nije popunjen"],
                  ["Engleski", prof.englishLevel || pref.englishLevel || "—"],
                  ["Smer", prof.studyMajor || "—"],
                  ["Dostupnost", av.startDate ? `${av.startDate} – ${av.endDate || "?"}` : "—"],
                  ["Povratak do", av.travelUntil || "—"],
                  ["Vrsta posla", pref.jobType || pref.position || "—"],
                  ["Vrsta mesta", pref.locationType || pref.location || "—"],
                  ["Države", pref.preferredStates?.length ? pref.preferredStates.join(", ") : "—"],
                  ["Smeštaj", pref.housingPreference || "—"],
                  ["Putuje sa", pref.travelingWith || "—"],
                  ...(pref.testLink ? [["Test engleskog", <a href={pref.testLink} target="_blank" rel="noreferrer" className="underline">Rezultat</a>]] : []),
                ]}
              />
              {av.notes && <p className="mt-4 text-[13px] text-ink-2">Napomena o datumima: {av.notes}</p>}
              {prof.skills?.length > 0 && (
                <div className="mt-5">
                  <p className="text-[13px] text-ink-3">Veštine</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prof.skills.map((s) => (
                      <span key={s} className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5">
                <p className="text-[13px] text-ink-3">Radno iskustvo</p>
                {prof.workExperience?.length ? (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {prof.workExperience.map((exp) => (
                      <li key={exp.id || exp.position} className="px-4 py-3">
                        <p className="text-sm font-medium text-ink">{exp.position}</p>
                        <p className="text-[13px] text-ink-3">{[exp.employer, exp.city, exp.period].filter(Boolean).join(" · ")}</p>
                        {exp.duties && <p className="mt-1 text-[13px] text-ink-2">{exp.duties}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">Nije uneto.</p>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* =================== BELEŠKE =================== */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <Section title="Selekcija">
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Field label="Prvi kontakt">
                  <select value={contactStatus} onChange={(e) => setContactStatus(e.target.value)} className={FIELD_CLS}>
                    <option value="NOT_ATTEMPTED">Nije pozvan</option>
                    <option value="REACHED">Razgovor obavljen</option>
                    <option value="NO_ANSWER">Nije se javio</option>
                  </select>
                </Field>
                <Field label="Konsultacije">
                  <select value={consultationStatus} onChange={(e) => setConsultationStatus(e.target.value)} className={FIELD_CLS}>
                    <option value="NOT_SCHEDULED">Nisu zakazane</option>
                    <option value="SCHEDULED">Zakazane</option>
                    <option value="ATTENDED">Održane</option>
                  </select>
                </Field>
                <Field label="Odluka">
                  <select value={selectionDecision} onChange={(e) => setSelectionDecision(e.target.value)} className={FIELD_CLS}>
                    <option value="PENDING">Na čekanju</option>
                    <option value="QUALIFIED">Kvalifikovan</option>
                    <option value="REJECTED">Odbijen</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3.5">
                <Field label="Beleške sa konsultacija">
                  <textarea rows={2} value={consultationNotes} onChange={(e) => setConsultationNotes(e.target.value)} className={FIELD_CLS} />
                </Field>
              </div>
            </Section>

            <Section title="Interne beleške" hint="Vidi ih samo tim agencije. Ovde se automatski upisuju i važni događaji iz portala.">
              <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Beleška…" className={FIELD_CLS} />
            </Section>
          </div>
        )}
      </form>


      {/* PREGLED DOKUMENTA */}
      {previewDoc && (
        <div className="fixed inset-0 z-[130] flex items-stretch justify-center sm:items-center sm:p-6">
          <button type="button" aria-label="Zatvori" onClick={() => setPreviewDoc(null)} className="absolute inset-0 hidden bg-ink/60 sm:block" />
          <div className="relative flex h-full w-full max-w-5xl flex-col bg-white sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:shadow-2xl">
            <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold text-ink">{previewDoc.title}</h3>
                <p className="truncate text-[13px] text-ink-3">{previewDoc.fileName}</p>
              </div>
              <button type="button" onClick={() => setPreviewDoc(null)} aria-label="Zatvori" className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                <XIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-3 sm:p-5">
              {previewDoc.url ? (
                previewDoc.url.startsWith("data:image/") || /\.(jpg|jpeg|png|webp)$/i.test(previewDoc.fileName) ? (
                  <img src={previewDoc.url} alt={previewDoc.fileName} className="mx-auto max-h-[72vh] rounded-lg object-contain" />
                ) : (
                  <iframe src={previewDoc.url} title={previewDoc.fileName} className="h-[72vh] w-full rounded-xl border border-line bg-white" />
                )
              ) : (
                <p className="rounded-xl border border-line bg-white px-6 py-12 text-center text-sm text-ink-3">
                  Fajl ne može da se prikaže ovde. Kandidat može ponovo da ga okači.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3.5 sm:px-6">
              {previewDoc.url && (
                <a href={previewDoc.url} download={previewDoc.fileName} target="_blank" rel="noreferrer" className={linkCls}>
                  Preuzmi
                </a>
              )}
              <div className="ml-auto flex items-center gap-2">
                {previewDoc.docCategory === "contract" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewDoc(null);
                        rejectContract();
                      }}
                    >
                      Vrati
                    </Button>
                    <Button
                      size="sm"
                      variant="dark"
                      onClick={() => {
                        handleVerifyContractAction(true);
                        setPreviewDoc(null);
                      }}
                    >
                      Odobri ugovor
                    </Button>
                  </>
                )}
                {previewDoc.docCategory === "documents" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewDoc(null);
                        rejectDocs();
                      }}
                    >
                      Vrati
                    </Button>
                    <Button
                      size="sm"
                      variant="dark"
                      onClick={() => {
                        handleVerifyDocumentsAction(true);
                        setPreviewDoc(null);
                      }}
                    >
                      Odobri dosije
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VRAĆANJE UZ OBRAZLOŽENJE */}
      {rejectionModal && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" aria-label="Zatvori" onClick={() => setRejectionModal(null)} className="absolute inset-0 bg-ink/50" />
          <div className="relative w-full max-w-lg space-y-4 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
            <div>
              <h3 className="text-[17px] font-semibold text-ink">{rejectionModal.title}</h3>
              <p className="mt-0.5 text-[13px] text-ink-3">Kandidat vidi ovaj razlog u svom nalogu.</p>
            </div>
            <textarea
              rows={4}
              autoFocus
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
              placeholder="npr. Sken nije čitljiv, fali potpis na poslednjoj strani."
              className={FIELD_CLS}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectionModal(null)}>
                Otkaži
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const reasonText = rejectionModal.reason.trim() || "Dokument nije ispravan. Pošalji ga ponovo.";
                  if (rejectionModal.type === "contract") handleVerifyContractAction(false, reasonText);
                  else handleVerifyDocumentsAction(false, reasonText);
                  setRejectionModal(null);
                }}
              >
                Vrati i obavesti
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PROFIL / CV BUILDER */}
      {showProfileBuilder && (
        <ProfileBuilderModal
          candidate={liveCandidateSnapshot}
          onClose={() => setShowProfileBuilder(false)}
          onSave={(updatedFields) => {
            if (updatedFields.cvFileName) setCvFileName(updatedFields.cvFileName);
            if (updatedFields.youtubeUrl) setYoutubeUrl(updatedFields.youtubeUrl);
            const merged = buildUpdatedCandidate(updatedFields);
            onSave(merged, { keepOpen: true });
            setShowProfileBuilder(false);
            showToast("Profil kandidata je ažuriran.");
          }}
        />
      )}
    </Modal>
  );
}

/* ---------- Delovi dosijea (van komponente, da polja ne gube fokus) ---------- */
const linkCls = "text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";

function Section({ title, hint, aside, children, className = "" }) {
  return (
    <section className={`${cardCls} p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4">
            {title && <h4 className="text-base font-semibold text-ink">{title}</h4>}
            {aside}
          </div>
          {hint && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function StatusText({ state, children }) {
  return (
    <span
      className={`shrink-0 text-[13px] ${
        state === "done" ? "text-emerald-700" : state === "wait" ? "text-amber-700" : state === "danger" ? "text-red-700" : "text-ink-3"
      }`}
    >
      {children}
    </span>
  );
}

function DocRow({ name, sub, state = "current", status, children }) {
  return (
    <li className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <TaskIcon state={state} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-[15px] font-medium ${state === "locked" ? "text-ink-3" : "text-ink"}`}>{name}</p>
          {status && <StatusText state={state}>{status}</StatusText>}
        </div>
        {sub && <p className="mt-0.5 truncate text-[13px] text-ink-3">{sub}</p>}
        {children && <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div>}
      </div>
    </li>
  );
}

function Upload({ busy, onFile, label, accept = ".pdf,.jpg,.jpeg,.png" }) {
  return (
    <label className={`${linkCls} cursor-pointer`}>
      {busy ? "Otpremanje…" : label}
      <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
      {children}
    </label>
  );
}
