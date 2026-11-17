// front/src/components/dashboard/ProfileView.jsx
// Podaci koji ti ne trebaju svaki dan: program, lični podaci (isti su kao u DS-160) i profil za poslodavce.
// Prikazuje se samo ono što je stvarno upisano — ništa se ne dopunjuje podrazumevanim vrednostima.
import { Panel, DataList, LinkButton } from "./ui";
import { ds160Date } from "../../data/candidateStore";

const PAYMENT_LABEL = {
  now: "U celosti",
  installments: "U tri rate",
  pkz: "PKZ — treća rata iz zarade u SAD",
  later: "Plati kad se vratiš (uz jemca)",
};

const has = (v) => v != null && String(v).trim() !== "";
const pick = (...xs) => xs.find(has);
/** Zadržava samo redove koji imaju vrednost. */
const rows = (list) => list.filter(([, v]) => has(v));
const num = (v) => (has(v) ? <span className="tabular-nums">{v}</span> : null);

export default function ProfileView({ ctx }) {
  const { candidate, setShowDs160Modal, setShowProfileBuilderModal } = ctx;
  const d = candidate.ds160 || {};
  const av = candidate.availability || {};
  const pref = candidate.preferences || {};
  const nameParts = String(candidate.name || "").split(" ");

  const program = rows([
    ["Program", pick(candidate.programName, candidate.packageName)],
    ["Plaćanje", PAYMENT_LABEL[candidate.paymentMethod]],
  ]);

  const personal = rows([
    ["Ime", pick(candidate.firstName, nameParts[0], d.firstName)],
    ["Prezime", pick(candidate.lastName, nameParts.slice(1).join(" "), d.lastNameAndMaiden)],
    ["Pol", pick(candidate.gender, d.gender)],
    ["Datum rođenja", ds160Date(pick(candidate.birthDate, candidate.dateOfBirth, d.dateOfBirth))],
    ["Mesto rođenja", pick(candidate.birthPlace, d.birthPlace)],
    ["JMBG", num(pick(candidate.jmbg, d.jmbg))],
    ["Broj pasoša", num(pick(candidate.passportNumber, d.passportNumber))],
    ["Pasoš važi do", ds160Date(pick(candidate.passportExpiryDate, candidate.passportExpiry, d.passportExpiryDate))],
    ["Broj lične karte", num(candidate.idCardNumber)],
    ["Lična karta važi do", ds160Date(candidate.idCardExpiryDate)],
    ["Telefon", pick(candidate.phone, d.mobilePhone)],
    ["E-mail", pick(candidate.email, d.primaryEmail)],
    ["Adresa", pick(candidate.address, d.homeAddress)],
  ]);

  const employer = rows([
    ["Profil", candidate.profileCompleted ? "Popunjen" : "Nije popunjen"],
    ["Dostupnost za rad", has(av.startDate) && has(av.endDate) ? `${av.startDate} – ${av.endDate}` : null],
    ["Putovanje do", av.travelUntil],
    ["Radno iskustvo", candidate.workExperience?.length ? `${candidate.workExperience.length} pozicija` : null],
    ["Željena pozicija", pref.position],
    ["Željena lokacija", pick(pref.location, pref.locationType)],
    ["Nivo engleskog", pick(candidate.englishLevel, pref.englishLevel)],
    ["Video", candidate.youtubeUrl ? "Sačuvan" : "Nedostaje"],
    [
      "Test engleskog",
      has(pref.testLink) ? (
        <a href={pref.testLink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          Rezultat
        </a>
      ) : null,
    ],
  ]);

  return (
    <div className="space-y-12">
      <Panel title="Lični podaci" aside={<LinkButton onClick={() => setShowDs160Modal(true)}>Izmeni</LinkButton>}>
        <DataList items={personal} />
      </Panel>

      <Panel title="Profil za poslodavce" aside={<LinkButton onClick={() => setShowProfileBuilderModal(true)}>Izmeni</LinkButton>}>
        <DataList items={employer} />
      </Panel>

      {program.length > 0 && (
        <Panel title="Program">
          <DataList items={program} />
        </Panel>
      )}
    </div>
  );
}
