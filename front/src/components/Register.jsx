// front/src/components/Register.jsx
// Glavni orkestrator za registraciju kandidata u 4 koraka

import { useState, useEffect } from "react";
import { useTranslation } from "../i18n/LanguageContext";
import {
  verifyInvitationWithBackend,
  registerCandidateWithBackend,
  getCandidates,
  resendVerificationEmail,
} from "../data/candidateStore";
import { RegisterStepper } from "./register/ui";
import { Button } from "./ui";
import Step1Activation from "./register/Step1Activation";
import Step2Documents from "./register/Step2Documents";
import Step3PaymentGuarantor from "./register/Step3PaymentGuarantor";
import Step4PreferencesJob from "./register/Step4PreferencesJob";

/** Link iz mejla (pun URL) → putanja unutar aplikacije. */
const devPath = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
};

export default function Register({
  onSubmit = () => {},
  onNavigate = () => {},
  loginHref = "/prijava",
  applyHref = "/prijava-online",
  logoHref = "/",
}) {
  const { t } = useTranslation();

  // Koraci: 1 = Aktivacija i lozinka, 2 = Pasoš & OCR, 3 = Plaćanje & Jemac, 4 = Posao & Test
  const [step, setStep] = useState(1);

  // Korak 1 stanja
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [matchedInvitation, setMatchedInvitation] = useState(null);
  const [codeError, setCodeError] = useState("");
  // Nalog za ovaj email je već aktiviran: student se vraća samo prijavom, bez koda.
  const [activeAccountEmail, setActiveAccountEmail] = useState("");
  // Posle registracije: nalog čeka potvrdu emaila (link iz mejla).
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [devLink, setDevLink] = useState("");
  const [resendState, setResendState] = useState({ busy: false, message: "" });

  // Korak 2 stanja (Pasoš & OCR)
  // Slike dokumenata ({ dataUrl, fileName }) i podaci očitani sa njih (kandidat ih proverava).
  const [docImages, setDocImages] = useState({ passport: null, idFront: null, idBack: null });
  const [ocrBirthDate, setOcrBirthDate] = useState("");
  const [ocrExpiryDate, setOcrExpiryDate] = useState("");
  const [ocrGender, setOcrGender] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [idCardExpiry, setIdCardExpiry] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [jmbg, setJmbg] = useState("");
  const [idCardNumber, setIdCardNumber] = useState("");

  // Korak 3 stanja (Plaćanje & Jemac)
  const [paymentMethod, setPaymentMethod] = useState("now"); // now | installments | later
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorIdCard, setGuarantorIdCard] = useState("");
  const [guarantorJmbg, setGuarantorJmbg] = useState("");
  const [promissoryNotesCount, setPromissoryNotesCount] = useState("2");

  // Korak 4 stanja (Preferencije & Engleski)
  const [prefLocation, setPrefLocation] = useState("");
  const [prefPosition, setPrefPosition] = useState("");
  const [englishLevel, setEnglishLevel] = useState("B2");
  const [englishTestLink, setEnglishTestLink] = useState("");

  // Afilijate & Grupni popust
  const [referredBy, setReferredBy] = useState("");
  const [groupCode, setGroupCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") || params.get("refCode") || params.get("referral");
      if (ref) setReferredBy(ref.trim().toUpperCase());
      const grp = params.get("group") || params.get("groupCode");
      if (grp) setGroupCode(grp.trim().toUpperCase());
      // Link iz mejla sa pozivnicom: email i kod su već upisani.
      const invitedEmail = params.get("email");
      const invitedCode = params.get("kod") || params.get("code");
      if (invitedEmail) setEmail(invitedEmail.trim());
      if (invitedCode) setCode(invitedCode.trim().toUpperCase());
      // Ponovo otvoren link iz pozivnice posle aktivacije vodi pravo na prijavu.
      if (invitedEmail && invitedCode) {
        verifyInvitationWithBackend(invitedEmail.trim(), invitedCode.trim()).then((res) => {
          if (res.alreadyActive) setActiveAccountEmail(invitedEmail.trim().toLowerCase());
        });
      }
    }
  }, []);

  const go = (href) => (e) => {
    e.preventDefault();
    onNavigate(e, href);
  };

  const applyInvitationDetails = (inv) => {
    setMatchedInvitation(inv);
    setEmail(inv.email);
    if (inv.referredBy && !referredBy) setReferredBy(inv.referredBy);
    if (inv.groupCode && !groupCode) setGroupCode(inv.groupCode);
    if (inv.candidateName) {
      const parts = inv.candidateName.split(" ");
      if (parts.length > 1) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      } else {
        setFirstName(parts[0]);
      }
    }
    // Povuci broj telefona i postojeće podatke iz pre-aplikacije kandidata (Faza 0)
    const existingPreApp = getCandidates().find(
      (c) => c.email && inv.email && c.email.toLowerCase() === inv.email.toLowerCase()
    );
    if (existingPreApp) {
      if (existingPreApp.phone && !phone) setPhone(existingPreApp.phone);
      if (existingPreApp.firstName && !firstName) setFirstName(existingPreApp.firstName);
      if (existingPreApp.lastName && !lastName) setLastName(existingPreApp.lastName);
      if (existingPreApp.birthDate && !ocrBirthDate) setOcrBirthDate(existingPreApp.birthDate);
    }
  };

  // Provera verifikacionog koda preko backend API-ja
  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    setCodeError("");

    if (!email.trim()) {
      setCodeError("Unesi e-mail na koji ti je poslat verifikacioni kod.");
      setMatchedInvitation(null);
      return null;
    }
    if (!code.trim()) {
      setCodeError("Unesi verifikacioni kod iz pozivnice.");
      setMatchedInvitation(null);
      return null;
    }

    const res = await verifyInvitationWithBackend(email, code);
    if (res.alreadyActive) {
      setActiveAccountEmail(email.trim().toLowerCase());
      setMatchedInvitation(null);
      return null;
    }
    if (!res.valid) {
      setCodeError(res.error);
      setMatchedInvitation(null);
      return null;
    }

    applyInvitationDetails(res.invitation);
    return res.invitation;
  };

  // Korak 1 nastavak
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (password.length < 12) {
      setCodeError("Lozinka mora imati najmanje 12 znakova.");
      return;
    }
    if (password !== confirmPassword) {
      setCodeError(t("auth.passwordMismatch") || "Lozinke se ne poklapaju.");
      return;
    }

    let inv = matchedInvitation;
    if (!inv) {
      inv = await handleVerifyCode();
      if (!inv) return;
    }

    if (email.trim().toLowerCase() !== inv.email.toLowerCase()) {
      setCodeError(`Registracija je dozvoljena isključivo sa email adresom: ${inv.email}`);
      return;
    }

    setStep(2);
  };

  // Korak 2 nastavak
  // Provere (dokumenti, JMBG, brojevi) radi sam korak 2.
  const handleStep2Submit = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const identityValues = {
    birthDate: ocrBirthDate,
    firstName,
    idCardExpiry,
    idCardNumber,
    jmbg,
    lastName,
    passportExpiry: ocrExpiryDate,
    passportNumber,
    phone,
    sex: ocrGender === "Ženski" ? "F" : ocrGender === "Muški" ? "M" : "",
  };
  const setIdentityValues = (patch) => {
    if ("birthDate" in patch) setOcrBirthDate(patch.birthDate);
    if ("firstName" in patch) setFirstName(patch.firstName);
    if ("idCardExpiry" in patch) setIdCardExpiry(patch.idCardExpiry);
    if ("idCardNumber" in patch) setIdCardNumber(patch.idCardNumber);
    if ("jmbg" in patch) setJmbg(patch.jmbg);
    if ("lastName" in patch) setLastName(patch.lastName);
    if ("passportExpiry" in patch) setOcrExpiryDate(patch.passportExpiry);
    if ("passportNumber" in patch) setPassportNumber(patch.passportNumber);
    if ("phone" in patch) setPhone(patch.phone);
    if ("sex" in patch) setOcrGender(patch.sex === "F" ? "Ženski" : patch.sex === "M" ? "Muški" : "");
  };

  // Korak 3 nastavak
  const handleStep3Submit = (e) => {
    e.preventDefault();
    if (paymentMethod === "later") {
      if (!guarantorName.trim() || !guarantorIdCard.trim() || !guarantorJmbg.trim() || !promissoryNotesCount.trim()) {
        alert("Unesi sve podatke o jemcu i broj menica.");
        return;
      }
    }
    setStep(4);
  };

  // Završetak registracije i kreiranje profila na backendu i u lokalnom store-u
  const handleStep4Submit = async (e) => {
    e.preventDefault();

    const verifiedEmail = (matchedInvitation?.email || email).trim().toLowerCase();
    const existingPreApp = getCandidates().find(
      (c) => c.email && c.email.toLowerCase() === verifiedEmail
    );
    const resolvedPhone = phone.trim() || existingPreApp?.phone || "";
    const passportImage = docImages.passport?.dataUrl || "";
    const resolvedPassportFileName = docImages.passport?.fileName || existingPreApp?.passportScanFileName || "";

    const candidateProfile = {
      id: existingPreApp?.id && !String(existingPreApp.id).startsWith("preapp-")
        ? existingPreApp.id
        : `cand-${Date.now()}`,
      code: matchedInvitation?.code || code.trim().toUpperCase(),
      email: verifiedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: resolvedPhone,
      jmbg: jmbg.trim(),
      idCardNumber: idCardNumber.trim(),
      idCardExpiryDate: idCardExpiry || "",
      idCardFrontDataUrl: docImages.idFront?.dataUrl || undefined,
      idCardFrontFileName: docImages.idFront?.fileName || undefined,
      idCardBackDataUrl: docImages.idBack?.dataUrl || undefined,
      idCardBackFileName: docImages.idBack?.fileName || undefined,
      passportNumber: passportNumber.trim(),
      passportImage,
      passportScanFileName: resolvedPassportFileName,
      passportScanDataUrl: passportImage || existingPreApp?.passportScanDataUrl || "",
      passportScanUrl: existingPreApp?.passportScanUrl || "",
      birthDate: ocrBirthDate || existingPreApp?.birthDate || "",
      passportExpiryDate: ocrExpiryDate || existingPreApp?.passportExpiryDate || "",
      gender: ocrGender || existingPreApp?.gender || "",
      address: existingPreApp?.address || "",
      faculty: existingPreApp?.faculty || "",
      studyCity: existingPreApp?.studyCity || "",
      studyYear: existingPreApp?.studyYear || "",
      ectsPoints: existingPreApp?.ectsPoints,
      packageId: matchedInvitation?.packageId || "swt-full",
      packageName: matchedInvitation?.packageName || "Work & Travel USA — Full Placement",
      basePrice: matchedInvitation?.basePrice || 1850,
      discountId: matchedInvitation?.discountId || null,
      discountTiming: matchedInvitation?.discountTiming || null,
      discount: matchedInvitation?.discount || 0,
      discountNote: matchedInvitation?.discountNote || "",
      finalPrice: matchedInvitation?.finalPrice || 1850,
      referredBy: referredBy.trim().toUpperCase() || matchedInvitation?.referredBy || "",
      groupCode: groupCode.trim().toUpperCase() || matchedInvitation?.groupCode || "",
      paymentMethod,
      guarantor:
        paymentMethod === "later"
          ? {
              name: guarantorName.trim(),
              idCardNumber: guarantorIdCard.trim(),
              jmbg: guarantorJmbg.trim(),
              promissoryNotesCount: Number(promissoryNotesCount) || 2,
            }
          : null,
      preferences: {
        location: prefLocation.trim(),
        position: prefPosition.trim(),
        englishLevel,
        testLink: englishTestLink.trim(),
      },
      youtubeUrl: "",
      cvFileName: "",
      facultyCertFileName: "",
      facultyCertAiTranslation: false,
      status: "review",
      progress: 40,
      isRegistered: true,
      registeredAt: new Date().toISOString(),
      createdAt: existingPreApp?.createdAt || new Date().toISOString(),
    };

    setSubmitError("");
    setSubmitting(true);
    const result = await registerCandidateWithBackend({ ...candidateProfile, password });
    if (!result.ok) {
      setSubmitting(false);
      setSubmitError(result.error);
      return;
    }
    // Nalog je napravljen, ali se aktivira tek potvrdom emaila (link iz mejla).
    setSubmitting(false);
    setRegisteredEmail(result.email || verifiedEmail);
    setDevLink(result.devVerificationUrl || "");
    setPassword("");
    setConfirmPassword("");
    window.scrollTo?.({ top: 0 });
  };

  const resendVerification = async () => {
    if (resendState.busy) return;
    setResendState({ busy: true, message: "" });
    const res = await resendVerificationEmail(registeredEmail);
    if (res.devVerificationUrl) setDevLink(res.devVerificationUrl);
    setResendState({ busy: false, message: res.message });
  };

  if (activeAccountEmail) {
    const loginWithEmail = `${loginHref}?email=${encodeURIComponent(activeAccountEmail)}`;
    return (
      <section className="bg-surface px-5 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-7 sm:p-10">
          <h1 className="font-display text-3xl font-bold text-ink">Nalog je već aktiviran</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Nalog za <span className="font-medium text-ink">{activeAccountEmail}</span> je aktivan. Kod iz pozivnice ti
            više ne treba — prijavi se emailom i lozinkom.
          </p>
          <Button href={loginWithEmail} onClick={go(loginWithEmail)} size="lg" block className="mt-7">
            Prijavi se
          </Button>
          <p className="mt-4 text-center text-sm text-ink-2">
            Ne sećaš se lozinke?{" "}
            <a href="/zaboravljena-lozinka" onClick={go("/zaboravljena-lozinka")} className="font-medium text-ink underline underline-offset-4">
              Postavi novu
            </a>
          </p>
        </div>
      </section>
    );
  }

  if (registeredEmail) {
    return (
      <section className="bg-surface px-5 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-7 sm:p-10">
          <h1 className="font-display text-3xl font-bold text-ink">Proveri email</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Poslali smo ti mejl na <span className="font-medium text-ink">{registeredEmail}</span>. Otvori link iz
            mejla da potvrdiš adresu, pa se prijavi lozinkom koju si upravo izabrao.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Link važi 48 sati.</p>
          {devLink && (
            <div className="mt-6 rounded-xl border border-dashed border-line px-4 py-3 text-sm leading-relaxed text-ink-2">
              Lokalni razvoj: mejlovi se ne šalju, pa je link iz mejla ovde.
              <Button href={devPath(devLink)} onClick={go(devPath(devLink))} size="md" block className="mt-3">
                Potvrdi email
              </Button>
            </div>
          )}
          <div className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-ink-2">
            Mejl ne stiže? Proveri Spam i Promocije.{" "}
            {resendState.message ? (
              <span role="status" className="text-ink">{resendState.message}</span>
            ) : (
              <button
                type="button"
                onClick={resendVerification}
                disabled={resendState.busy}
                className="font-medium text-ink underline underline-offset-4 disabled:opacity-60"
              >
                {resendState.busy ? "Šaljem…" : "Pošalji ponovo"}
              </button>
            )}
          </div>
          <a
            href={loginHref}
            onClick={go(loginHref)}
            className="mt-8 block text-center text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Već sam potvrdio, idem na prijavu
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface px-5 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-xl">
        {/* Stepper progress */}
        <RegisterStepper step={step} t={t} />

        <div className="mt-8 rounded-3xl border border-line bg-white p-7 sm:p-10">
          {step === 1 && (
            <Step1Activation
              email={email}
              setEmail={setEmail}
              code={code}
              setCode={setCode}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              matchedInvitation={matchedInvitation}
              setMatchedInvitation={setMatchedInvitation}
              codeError={codeError}
              setCodeError={setCodeError}
              onVerifyCode={handleVerifyCode}
              onSubmit={handleStep1Submit}
              t={t}
            />
          )}

          {step === 2 && (
            <Step2Documents
              email={(matchedInvitation?.email || email).trim().toLowerCase()}
              code={matchedInvitation?.code || code.trim().toUpperCase()}
              values={identityValues}
              onChange={setIdentityValues}
              images={docImages}
              onImages={(patch) => setDocImages((prev) => ({ ...prev, ...patch }))}
              onBack={() => setStep(1)}
              onSubmit={handleStep2Submit}
              t={t}
            />
          )}

          {step === 3 && (
            <Step3PaymentGuarantor
              matchedInvitation={matchedInvitation}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              guarantorName={guarantorName}
              setGuarantorName={setGuarantorName}
              guarantorIdCard={guarantorIdCard}
              setGuarantorIdCard={setGuarantorIdCard}
              guarantorJmbg={guarantorJmbg}
              setGuarantorJmbg={setGuarantorJmbg}
              promissoryNotesCount={promissoryNotesCount}
              setPromissoryNotesCount={setPromissoryNotesCount}
              onBack={() => setStep(2)}
              onSubmit={handleStep3Submit}
              t={t}
            />
          )}

          {step === 4 && (
            <Step4PreferencesJob
              prefLocation={prefLocation}
              setPrefLocation={setPrefLocation}
              prefPosition={prefPosition}
              setPrefPosition={setPrefPosition}
              englishLevel={englishLevel}
              setEnglishLevel={setEnglishLevel}
              englishTestLink={englishTestLink}
              setEnglishTestLink={setEnglishTestLink}
              referredBy={referredBy}
              setReferredBy={setReferredBy}
              groupCode={groupCode}
              setGroupCode={setGroupCode}
              onBack={() => setStep(3)}
              onSubmit={handleStep4Submit}
              submitting={submitting}
              submitError={submitError}
              t={t}
            />
          )}
        </div>

        {/* Link za prijavu ako korisnik već ima nalog */}
        <div className="mt-6 space-y-2 text-center text-sm text-ink-2">
          <p>
            {t("reg.haveAccount")}{" "}
            <a
              href={loginHref}
              onClick={go(loginHref)}
              className="font-semibold text-ink underline-offset-2 hover:underline"
            >
              {t("auth.loginAccount")}
            </a>
          </p>
          <p className="text-xs text-ink-3">
            {t("login.notInterviewed")}{" "}
            <a
              href={applyHref}
              onClick={go(applyHref)}
              className="font-semibold text-ink underline hover:opacity-80"
            >
              {t("login.applyFree")}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
