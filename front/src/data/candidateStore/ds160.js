// front/src/data/candidateStore/ds160.js
// DS-160 upitnik: jedna lista polja za formu studenta, brojanje i pregled u adminu.
// required: polje bez kog ambasada ne prima DS-160 (odgovor „Ne" ili „Nemam" je validan odgovor).

export const DS160_STEPS = [
  { id: "personal", label: "Lični podaci" },
  { id: "us_travel", label: "Posao u SAD" },
  { id: "contact_edu", label: "Kontakt i škola" },
  { id: "references", label: "Reference" },
];

// [ključ, oznaka, korak, obavezno, dodatno]
export const DS160_FIELDS = [
  ["lastNameAndMaiden", "Prezime (i devojačko)", "personal", true],
  ["firstName", "Ime", "personal", true],
  ["gender", "Pol", "personal", true, { options: ["Muški", "Ženski"] }],
  ["maritalStatus", "Bračno stanje", "personal", true, { options: ["Neoženjen / Neudata", "U braku", "Veren / Verena", "Razveden / Razvedena"] }],
  ["dateOfBirth", "Datum rođenja", "personal", true, { placeholder: "DD.MM.GGGG" }],
  ["birthPlace", "Mesto i država rođenja", "personal", true],
  ["jmbg", "JMBG", "personal", true, { placeholder: "13 cifara", inputMode: "numeric" }],
  ["ssn", "SSN", "personal", false, { hint: "Samo ako si ga već dobio u SAD." }],
  ["passportNumber", "Broj pasoša", "personal", true],
  ["passportExpiryDate", "Pasoš važi do", "personal", true, { placeholder: "DD.MM.GGGG" }],
  ["employerInfo", "Poslodavac u SAD", "us_travel", true],
  ["supervisorName", "Supervizor", "us_travel", true],
  ["stayAddress", "Adresa smeštaja ili poslodavca", "us_travel", true, { wide: true }],
  ["employerPhone", "Telefon poslodavca", "us_travel", true, { inputMode: "tel" }],
  ["tripFunder", "Ko plaća put", "us_travel", true, { hint: "Npr. „Sam“ ili „Roditelji“." }],
  ["previousUsTravel", "Da li si ranije bio u SAD?", "us_travel", true, { hint: "„Ne“, ili datumi i svrha." }],
  ["visaRefusal", "Da li si ikad odbijen za vizu SAD?", "us_travel", true, { hint: "„Ne“, ili kada i zašto." }],
  ["homeAddress", "Adresa u Srbiji", "contact_edu", true],
  ["mobilePhone", "Mobilni", "contact_edu", true, { inputMode: "tel" }],
  ["socialMediaAccounts", "Društvene mreže (poslednjih 5 godina)", "contact_edu", true, { wide: true, rows: 2, hint: "Mreža i korisničko ime. Ako nemaš nijednu, upiši „Nemam“." }],
  ["highSchoolInfo", "Srednja škola (naziv i grad)", "contact_edu", true],
  ["university", "Fakultet i smer", "contact_edu", true],
  ["referencePerson1", "Prva osoba", "references", true, { wide: true, placeholder: "Ime, prezime, adresa, telefon" }],
  ["referencePerson2", "Druga osoba", "references", true, { wide: true, placeholder: "Ime, prezime, adresa, telefon" }],
  ["emergencyContact", "Za hitne slučajeve", "references", true, { wide: true, placeholder: "Roditelj ili staratelj — ime i telefon" }],
].map(([key, label, step, required, extra = {}]) => ({ key, label, step, required, ...extra }));

export const DS160_REQUIRED_FIELDS = DS160_FIELDS.filter((f) => f.required).map((f) => f.key);

export const DS160_LABEL = Object.fromEntries(DS160_FIELDS.map((f) => [f.key, f.label]));

const filled = (v) => String(v ?? "").trim().length > 0;

/** Stanje upitnika: koliko obaveznih polja je popunjeno i koja nedostaju. */
export function getDs160Status(ds160) {
  const d = ds160 && typeof ds160 === "object" ? ds160 : {};
  const missing = DS160_FIELDS.filter((f) => f.required && !filled(d[f.key]));
  const totalCount = DS160_REQUIRED_FIELDS.length;
  const filledCount = totalCount - missing.length;
  const isStarted = DS160_FIELDS.some((f) => filled(d[f.key]));
  const isComplete = missing.length === 0;
  return {
    isComplete,
    isStarted: isStarted || isComplete,
    filledCount,
    totalCount,
    missing,
    label: isComplete ? "Kompletno popunjen" : isStarted ? "U toku (Delimično)" : "Za popunjavanje",
  };
}

export function isDs160Complete(ds160) {
  return getDs160Status(ds160).isComplete;
}

/** ISO datum (2001-05-12) u oblik koji upitnik traži (12.05.2001). Ostalo ostaje kako jeste. */
export function ds160Date(value) {
  const s = String(value || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}
