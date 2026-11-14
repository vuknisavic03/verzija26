// front/src/components/dashboard/modals/Ds160Modal.jsx
import { useState } from "react";
import { getDs160Status } from "../../../data/candidateStore";
import { Button } from "../../ui";
import Sheet, { SheetSteps, SheetFooter, FormField, Hint, fieldInputCls as inp } from "../Sheet";

export default function Ds160Modal({ candidate, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [f, setF] = useState(() => {
    const d = candidate.ds160 || {};
    const candFirst = candidate.firstName || (candidate.name ? candidate.name.split(" ")[0] : "");
    const candLast = candidate.lastName || (candidate.name ? candidate.name.split(" ").slice(1).join(" ") : "");
    return {
      lastNameAndMaiden: d.lastNameAndMaiden || candLast || "",
      firstName: d.firstName || candFirst || "",
      gender: d.gender || candidate.gender || "Muški",
      maritalStatus: d.maritalStatus || candidate.maritalStatus || "Neoženjen / Neudata",
      dateOfBirth: d.dateOfBirth || candidate.birthDate || candidate.dateOfBirth || "",
      birthPlace: d.birthPlace || candidate.birthPlace || candidate.city || candidate.studyCity || "",
      birthCountry: d.birthCountry || candidate.birthCountry || "Srbija",
      citizenship: d.citizenship || candidate.citizenship || "Republika Srbija",
      jmbg: d.jmbg || candidate.jmbg || "",
      ssn: d.ssn || candidate.ssn || "",
      passportNumber: d.passportNumber || candidate.passportNumber || candidate.idCardNumber || "",
      passportCountry: d.passportCountry || candidate.passportCountry || "Republika Srbija",
      passportExpiryDate: d.passportExpiryDate || candidate.passportExpiryDate || candidate.passportExpiry || "",
      employerInfo: d.employerInfo || (candidate.selectedJobEmployer || candidate.jobEmployer ? `${candidate.selectedJobEmployer || candidate.jobEmployer} (${candidate.selectedJobTitle || candidate.jobTitle || "Radna pozicija"})` : ""),
      stayAddress: d.stayAddress || (candidate.selectedJobCity || candidate.jobCity || candidate.jobLocation ? `${candidate.selectedJobHousing || candidate.jobHousing ? `${candidate.selectedJobHousing || candidate.jobHousing}, ` : ""}${candidate.selectedJobCity || candidate.jobCity || candidate.jobLocation}, SAD` : ""),
      supervisorName: d.supervisorName || (candidate.selectedJobEmployer || candidate.jobEmployer ? "HR Department / Supervisor" : ""),
      employerPhone: d.employerPhone || (candidate.selectedJobEmployer || candidate.jobEmployer ? "+1 (555) 234-5678" : ""),
      tripFunder: d.tripFunder || "Roditelji / Lična sredstva",
      previousUsTravel: d.previousUsTravel || "Ne",
      visaRefusal: d.visaRefusal || "Ne",
      homeAddress: d.homeAddress || candidate.address || "",
      mobilePhone: d.mobilePhone || candidate.phone || "",
      primaryEmail: d.primaryEmail || candidate.email || "",
      socialMediaAccounts: d.socialMediaAccounts || "",
      highSchoolInfo: d.highSchoolInfo || "",
      university: d.university || candidate.faculty || "",
      studyProgram: d.studyProgram || candidate.studyProgram || "",
      referencePerson1: d.referencePerson1 || "",
      referencePerson2: d.referencePerson2 || "",
      emergencyContact: d.emergencyContact || (candidate.guarantor ? `${candidate.guarantor.name} (${candidate.guarantor.phone || "Roditelj"})` : ""),
    };
  });

  const upd = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(f);
  };

  const dsStatus = getDs160Status(f);

  const STEPS = [
    { id: "personal", label: "Lični podaci" },
    { id: "us_travel", label: "Posao u SAD" },
    { id: "contact_edu", label: "Kontakt i škola" },
    { id: "references", label: "Reference" },
  ];
  const stepIndex = STEPS.findIndex((x) => x.id === activeTab);
  const isLast = stepIndex === STEPS.length - 1;

  // [ključ, oznaka, { type, options, wide, hint, placeholder, rows }]
  const FIELDS = {
    personal: [
      ["lastNameAndMaiden", "Prezime (i devojačko)"],
      ["firstName", "Ime"],
      ["gender", "Pol", { options: ["Muški", "Ženski"] }],
      ["maritalStatus", "Bračno stanje", { options: ["Neoženjen / Neudata", "U braku", "Veren / Verena", "Razveden / Razvedena"] }],
      ["dateOfBirth", "Datum rođenja", { placeholder: "DD/MM/GGGG" }],
      ["birthPlace", "Mesto i država rođenja"],
      ["jmbg", "JMBG", { placeholder: "13 cifara", inputMode: "numeric" }],
      ["ssn", "SSN", { hint: "Samo ako si ga već dobio u SAD." }],
      ["passportNumber", "Broj pasoša"],
      ["passportExpiryDate", "Pasoš važi do", { placeholder: "DD/MM/GGGG" }],
    ],
    us_travel: [
      ["employerInfo", "Poslodavac u SAD"],
      ["supervisorName", "Supervizor"],
      ["stayAddress", "Adresa smeštaja ili poslodavca", { wide: true }],
      ["employerPhone", "Telefon poslodavca", { inputMode: "tel" }],
      ["tripFunder", "Ko plaća put"],
      ["previousUsTravel", "Ranije u SAD?", { hint: "Datumi i svrha, ili „Ne“." }],
      ["visaRefusal", "Odbijen za vizu SAD?", { hint: "„Ne“, ili kada i zašto." }],
    ],
    contact_edu: [
      ["homeAddress", "Adresa u Srbiji"],
      ["mobilePhone", "Mobilni", { inputMode: "tel" }],
      ["socialMediaAccounts", "Društvene mreže (poslednjih 5 godina)", { wide: true, rows: 2, hint: "Profili moraju biti javni." }],
      ["highSchoolInfo", "Srednja škola (naziv i grad)"],
      ["university", "Fakultet i smer"],
    ],
    references: [
      ["referencePerson1", "Prva osoba", { wide: true, placeholder: "Ime, prezime, adresa, telefon" }],
      ["referencePerson2", "Druga osoba", { wide: true, placeholder: "Ime, prezime, adresa, telefon" }],
      ["emergencyContact", "Za hitne slučajeve", { wide: true, placeholder: "Roditelj ili staratelj — ime i telefon" }],
    ],
  };

  const renderField = ([key, label, o = {}]) => (
    <FormField key={key} label={label} hint={o.hint} className={o.wide ? "sm:col-span-2" : ""}>
      {o.options ? (
        <select value={f[key]} onChange={upd(key)} className={inp}>
          {o.options.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      ) : o.rows ? (
        <textarea rows={o.rows} value={f[key]} onChange={upd(key)} className={inp} />
      ) : (
        <input value={f[key]} onChange={upd(key)} placeholder={o.placeholder} inputMode={o.inputMode} className={inp} />
      )}
    </FormField>
  );

  return (
    <Sheet
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={handleSubmit}
      title="DS-160 upitnik"
      subtitle="Podaci za vizu. Proveri ih dva puta — greška može da znači odbijenu vizu."
      aside={
        <span className="text-[13px] text-ink-3">
          <span className="font-semibold tabular-nums text-ink">{dsStatus.filledCount}</span> od {dsStatus.totalCount} polja
        </span>
      }
      nav={<SheetSteps steps={STEPS} active={activeTab} onChange={setActiveTab} />}
      footer={
        <SheetFooter
          left={
            <Button type="submit" variant="ghost" className={isLast ? "hidden" : ""}>
              Sačuvaj
            </Button>
          }
        >
          {isLast ? (
            <Button type="submit" variant="primary">
              {dsStatus.isComplete ? "Sačuvaj upitnik" : "Sačuvaj nacrt"}
            </Button>
          ) : (
            <Button variant="dark" onClick={() => setActiveTab(STEPS[stepIndex + 1].id)}>
              Dalje
            </Button>
          )}
        </SheetFooter>
      }
    >
      <div className="space-y-6">
        {activeTab === "us_travel" && <Hint>Podatke o poslodavcu smo upisali iz tvog Job Offer-a. Samo proveri.</Hint>}
        {activeTab === "references" && <Hint>Ambasada traži dve osobe u Srbiji koje te poznaju, a nisu ti rod.</Hint>}
        <div className="grid gap-4 sm:grid-cols-2">{FIELDS[activeTab].map(renderField)}</div>
        <p className="text-[13px] text-ink-3">
          Radije u Word-u?{" "}
          <a
            href="/documents/UPITNIK_za_izradu_DS160_J1.docx"
            download="UPITNIK_za_izradu_DS160_J1.docx"
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Preuzmi upitnik (.docx)
          </a>
        </p>
      </div>
    </Sheet>
  );
}
