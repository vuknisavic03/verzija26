import { useState } from "react";
import { calculateProfileScore } from "../data/candidateStore";
import { Button, cx } from "./ui";
import Sheet, { SheetSteps, SheetSection, SheetFooter, FormField, Chip, Hint, fieldInputCls as inp } from "./dashboard/Sheet";

export default function ProfileBuilderModal({ candidate, isOpen = true, onClose, onSave }) {
  if (!isOpen || !candidate) return null;
  return <ProfileBuilder candidate={candidate} onClose={onClose} onSave={onSave} />;
}

function ProfileBuilder({ candidate, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("personal");

  const [f, setF] = useState({
    firstName: candidate.firstName || candidate.name?.split(" ")[0] || "",
    lastName: candidate.lastName || candidate.name?.split(" ").slice(1).join(" ") || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    faculty: candidate.faculty || "",
    studyCity: candidate.studyCity || "Beograd",
    studyYear: candidate.studyYear || "YEAR_2",
    studyMajor: candidate.studyMajor || "",
    gpa: candidate.gpa || "",
    englishLevel: candidate.englishLevel || candidate.preferences?.englishLevel || "B2",
    // Dostupnost
    startDate: candidate.availability?.startDate || "2026-05-25",
    endDate: candidate.availability?.endDate || "2026-09-25",
    travelUntil: candidate.availability?.travelUntil || "2026-10-20",
    availabilityNotes: candidate.availability?.notes || "",
    // Radno iskustvo
    workExperience: Array.isArray(candidate.workExperience) ? candidate.workExperience : [],
    // Veštine
    skills: Array.isArray(candidate.skills) ? candidate.skills : [],
    // Preferencije
    position: candidate.preferences?.position || "",
    jobType: candidate.preferences?.jobType || "",
    location: candidate.preferences?.location || "",
    locationType: candidate.preferences?.locationType || "",
    preferredStates: Array.isArray(candidate.preferences?.preferredStates) ? candidate.preferences.preferredStates : [],
    housingPreference: candidate.preferences?.housingPreference || "Smeštaj obezbeđen od poslodavca",
    travelingWith: candidate.preferences?.travelingWith || "Samostalno",
    // Video
    youtubeUrl: candidate.youtubeUrl || candidate.videoUrl || "",
    cvFileName: candidate.cvFileName || "CV_Biografija.pdf",
  });

  const [newExp, setNewExp] = useState({
    position: "",
    employer: "",
    city: "",
    period: "",
    duties: "",
  });
  const [showAddExp, setShowAddExp] = useState(false);
  const [customSkill, setCustomSkill] = useState("");

  const upd = (key) => (e) => {
    setF((prev) => ({ ...prev, [key]: e.target.value }));
  };

  // Proračun skora
  const candidatePreview = {
    ...candidate,
    ...f,
    availability: { startDate: f.startDate, endDate: f.endDate, travelUntil: f.travelUntil },
    preferences: {
      ...candidate.preferences,
      position: f.position,
      location: f.location,
      locationType: f.locationType,
      jobType: f.jobType,
      preferredStates: f.preferredStates,
      housingPreference: f.housingPreference,
      travelingWith: f.travelingWith,
      englishLevel: f.englishLevel,
    },
  };
  const profileScore = calculateProfileScore(candidatePreview);

  const handleAddExperience = (e) => {
    e.preventDefault();
    if (!newExp.position.trim() || !newExp.employer.trim()) return;
    const expItem = {
      ...newExp,
      id: `exp-${Date.now()}`,
    };
    setF((prev) => ({
      ...prev,
      workExperience: [...prev.workExperience, expItem],
    }));
    setNewExp({ position: "", employer: "", city: "", period: "", duties: "" });
    setShowAddExp(false);
  };

  const handleRemoveExperience = (id) => {
    setF((prev) => ({
      ...prev,
      workExperience: prev.workExperience.filter((x) => x.id !== id),
    }));
  };

  const handleToggleSkill = (skill) => {
    setF((prev) => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
      };
    });
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    if (!customSkill.trim() || f.skills.includes(customSkill.trim())) return;
    setF((prev) => ({
      ...prev,
      skills: [...prev.skills, customSkill.trim()],
    }));
    setCustomSkill("");
  };

  const handleToggleState = (st) => {
    setF((prev) => {
      const exists = prev.preferredStates.includes(st);
      return {
        ...prev,
        preferredStates: exists
          ? prev.preferredStates.filter((s) => s !== st)
          : [...prev.preferredStates, st],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Enter u polju ili "Dalje" vodi na sledeći korak; čuva se tek na poslednjem.
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx < TABS.length - 1) {
      setActiveTab(TABS[idx + 1].id);
      return;
    }
    const payload = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      name: `${f.firstName.trim()} ${f.lastName.trim()}`,
      phone: f.phone.trim(),
      faculty: f.faculty.trim(),
      studyCity: f.studyCity.trim(),
      studyYear: f.studyYear,
      studyMajor: f.studyMajor.trim(),
      gpa: f.gpa.trim(),
      englishLevel: f.englishLevel,
      availability: {
        startDate: f.startDate,
        endDate: f.endDate,
        travelUntil: f.travelUntil,
        notes: f.availabilityNotes,
      },
      workExperience: f.workExperience,
      skills: f.skills,
      preferences: {
        ...candidate.preferences,
        position: f.position,
        location: f.location,
        locationType: f.locationType,
        jobType: f.jobType,
        preferredStates: f.preferredStates,
        housingPreference: f.housingPreference,
        travelingWith: f.travelingWith,
        englishLevel: f.englishLevel,
      },
      youtubeUrl: f.youtubeUrl.trim(),
      videoUrl: f.youtubeUrl.trim(),
      cvFileName: f.cvFileName,
      profileCompleted: profileScore >= 80,
      profileCompletionScore: profileScore,
    };
    onSave(payload);
    onClose();
  };

  // Pomoćni YouTube embed parser
  const getEmbedUrl = (url) => {
    if (!url) return null;
    try {
      if (url.includes("youtu.be/")) {
        const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (url.includes("youtube.com/watch")) {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.includes("loom.com/share/")) {
        const id = url.split("loom.com/share/")[1]?.split("?")[0];
        return `https://www.loom.com/embed/${id}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const TABS = [
    { id: "personal", label: "O tebi" },
    { id: "availability", label: "Datumi" },
    { id: "experience", label: "Iskustvo" },
    { id: "preferences", label: "Posao" },
    { id: "video", label: "Video" },
  ];

  const POPULAR_SKILLS = [
    "Customer Service & Komunikacija sa gostima",
    "Rad na kasi (POS)",
    "Spasilac na vodi (Crveni Krst)",
    "Pružanje prve pomoći i CPR",
    "Usluživanje hrane i pića (Food & Beverage)",
    "Priprema hrane i higijena (Food Prep)",
    "Održavanje soba (Housekeeping)",
    "Timski rad u dinamičnom okruženju",
    "Brzo učenje i fleksibilnost",
    "Tečan engleski jezik",
  ];

  const US_STATES = [
    "Massachusetts",
    "Maryland",
    "California",
    "Alaska",
    "Montana",
    "Maine",
    "New Jersey",
    "Colorado",
    "South Carolina",
    "Texas",
    "Wisconsin",
  ];

  const embedVideoUrl = getEmbedUrl(f.youtubeUrl);
  const stepIndex = TABS.findIndex((t) => t.id === activeTab);
  const isLast = stepIndex === TABS.length - 1;

  return (
    <Sheet
      onClose={onClose}
      size="lg"
      as="form"
      onSubmit={handleSubmit}
      title="Profil za poslodavce"
      subtitle="Po ovome te poslodavci biraju za intervju."
      aside={
        <span className="text-[13px] text-ink-3">
          Popunjeno <span className="font-semibold tabular-nums text-ink">{profileScore}%</span>
        </span>
      }
      nav={<SheetSteps steps={TABS} active={activeTab} onChange={setActiveTab} />}
      footer={
        <SheetFooter
          left={
            <Button variant="ghost" size="sm" onClick={() => window.print()} className="max-sm:hidden">
              Štampaj CV
            </Button>
          }
        >
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => setActiveTab(TABS[stepIndex - 1].id)}>
              Nazad
            </Button>
          )}
          <Button type="submit" variant={isLast ? "primary" : "dark"}>
            {isLast ? "Sačuvaj profil" : "Dalje"}
          </Button>
        </SheetFooter>
      }
    >
      {/* 1. Lični podaci i fakultet */}
      {activeTab === "personal" && (
        <div className="space-y-8">
          <SheetSection title="O tebi">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ime">
                <input type="text" required autoComplete="given-name" value={f.firstName} onChange={upd("firstName")} className={inp} />
              </FormField>
              <FormField label="Prezime">
                <input type="text" required autoComplete="family-name" value={f.lastName} onChange={upd("lastName")} className={inp} />
              </FormField>
              <FormField label="E-mail">
                <input type="email" required autoComplete="email" value={f.email} onChange={upd("email")} className={inp} />
              </FormField>
              <FormField label="Telefon (WhatsApp)">
                <input type="tel" required autoComplete="tel" value={f.phone} onChange={upd("phone")} className={inp} />
              </FormField>
            </div>
          </SheetSection>

          <SheetSection title="Studije">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Fakultet" className="sm:col-span-2">
                <input type="text" required value={f.faculty} onChange={upd("faculty")} placeholder="Fakultet organizacionih nauka" className={inp} />
              </FormField>
              <FormField label="Grad">
                <input type="text" required value={f.studyCity} onChange={upd("studyCity")} className={inp} />
              </FormField>
              <FormField label="Smer">
                <input type="text" value={f.studyMajor} onChange={upd("studyMajor")} placeholder="Menadžment" className={inp} />
              </FormField>
              <FormField label="Godina">
                <select value={f.studyYear} onChange={upd("studyYear")} className={inp}>
                  <option value="YEAR_1">1. godina</option>
                  <option value="YEAR_2">2. godina</option>
                  <option value="YEAR_3">3. godina</option>
                  <option value="YEAR_4">4. godina</option>
                  <option value="MASTER">Master</option>
                </select>
              </FormField>
              <FormField label="Engleski">
                <select value={f.englishLevel} onChange={upd("englishLevel")} className={inp}>
                  <option value="B1">B1 — srednji</option>
                  <option value="B2">B2 — viši srednji</option>
                  <option value="C1">C1 — napredni</option>
                  <option value="C2">C2 — tečan</option>
                </select>
              </FormField>
            </div>
          </SheetSection>
        </div>
      )}

      {/* 2. Datumi */}
      {activeTab === "availability" && (
        <div className="space-y-6">
          <Hint>Datumi moraju da se uklope u letnji raspust — najranije 20. maj, najkasnije 1. oktobar.</Hint>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Počinjem da radim" hint="Prvi dan kod poslodavca">
              <input type="date" required value={f.startDate} onChange={upd("startDate")} className={inp} />
            </FormField>
            <FormField label="Poslednji dan rada">
              <input type="date" required value={f.endDate} onChange={upd("endDate")} className={inp} />
            </FormField>
            <FormField label="Vraćam se kući" hint="Do 30 dana posle rada za putovanje">
              <input type="date" required value={f.travelUntil} onChange={upd("travelUntil")} className={inp} />
            </FormField>
          </div>
          <FormField label="Napomena (nije obavezno)">
            <textarea
              rows={3}
              value={f.availabilityNotes}
              onChange={upd("availabilityNotes")}
              placeholder="npr. Junske ispite polažem u predroku, do 20. maja."
              className={inp}
            />
          </FormField>
        </div>
      )}

      {/* 3. Iskustvo i veštine */}
      {activeTab === "experience" && (
        <div className="space-y-8">
          <SheetSection title="Radno iskustvo" hint="Poslovi, prakse, sezonski rad — piši na engleskom.">
            {f.workExperience.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {f.workExperience.map((exp) => (
                  <li key={exp.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-ink">{exp.position}</p>
                      <p className="text-[13px] text-ink-3">
                        {[exp.employer, exp.city, exp.period].filter(Boolean).join(" · ")}
                      </p>
                      {exp.duties && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{exp.duties}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExperience(exp.id)}
                      aria-label={`Ukloni ${exp.position}`}
                      className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-red-600"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showAddExp ? (
              <div className="space-y-4 rounded-xl border border-line-strong p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Pozicija">
                    <input type="text" placeholder="Waiter, Lifeguard…" value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} className={inp} />
                  </FormField>
                  <FormField label="Poslodavac">
                    <input type="text" placeholder="Hotel Hyatt" value={newExp.employer} onChange={(e) => setNewExp({ ...newExp, employer: e.target.value })} className={inp} />
                  </FormField>
                  <FormField label="Grad">
                    <input type="text" placeholder="Beograd, Srbija" value={newExp.city} onChange={(e) => setNewExp({ ...newExp, city: e.target.value })} className={inp} />
                  </FormField>
                  <FormField label="Period">
                    <input type="text" placeholder="Jun – Sep 2024" value={newExp.period} onChange={(e) => setNewExp({ ...newExp, period: e.target.value })} className={inp} />
                  </FormField>
                </div>
                <FormField label="Šta si radio">
                  <textarea
                    rows={2}
                    placeholder="Taking orders, handling payments, talking to international guests…"
                    value={newExp.duties}
                    onChange={(e) => setNewExp({ ...newExp, duties: e.target.value })}
                    className={inp}
                  />
                </FormField>
                <div className="flex justify-end gap-2.5">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddExp(false)}>
                    Otkaži
                  </Button>
                  <Button variant="dark" size="sm" onClick={handleAddExperience} disabled={!newExp.position.trim() || !newExp.employer.trim()}>
                    Dodaj
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddExp(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-3.5 text-sm font-medium text-ink hover:border-ink/40 hover:bg-surface"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                {f.workExperience.length ? "Dodaj još jedan posao" : "Dodaj posao"}
              </button>
            )}
          </SheetSection>

          <SheetSection title="Veštine" hint="Izaberi ono što stvarno znaš.">
            <div className="flex flex-wrap gap-2">
              {[...POPULAR_SKILLS, ...f.skills.filter((sk) => !POPULAR_SKILLS.includes(sk))].map((sk) => (
                <Chip key={sk} selected={f.skills.includes(sk)} onClick={() => handleToggleSkill(sk)}>
                  {sk}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Druga veština"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomSkill(e)}
                className={cx(inp, "flex-1")}
              />
              <Button variant="outline" onClick={handleAddCustomSkill} disabled={!customSkill.trim()}>
                Dodaj
              </Button>
            </div>
          </SheetSection>
        </div>
      )}

      {/* 4. Posao i lokacija */}
      {activeTab === "preferences" && (
        <div className="space-y-8">
          <SheetSection title="Kakav posao tražiš" hint="Po ovome ti biramo ponude.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Vrsta posla">
                <select value={f.jobType} onChange={upd("jobType")} className={inp}>
                  <option value="">Svejedno</option>
                  <option value="Food & Beverage / Lifeguard">Restorani i ugostiteljstvo</option>
                  <option value="Hotelijerstvo & Housekeeping">Hotelijerstvo i housekeeping</option>
                  <option value="Spasilac na bazenu (Lifeguard)">Spasilac (lifeguard)</option>
                  <option value="Zabavni parkovi & Atrakcije">Zabavni parkovi i atrakcije</option>
                  <option value="Maloprodaja / Retail & Trgovina">Prodavnice (retail)</option>
                </select>
              </FormField>
              <FormField label="Vrsta mesta">
                <select value={f.locationType} onChange={upd("locationType")} className={inp}>
                  <option value="">Svejedno</option>
                  <option value="Morska obala & Plaže">More i plaže</option>
                  <option value="Nacionalni parkovi i planinska jezera">Nacionalni parkovi i planine</option>
                  <option value="Poznata turistička ostrva">Ostrva</option>
                  <option value="Gradske i univerzitetske sredine">Grad</option>
                </select>
              </FormField>
            </div>
          </SheetSection>

          <SheetSection title="Države" hint="Jedna ili više, nije obavezno.">
            <div className="flex flex-wrap gap-2">
              {US_STATES.map((st) => (
                <Chip key={st} selected={f.preferredStates.includes(st)} onClick={() => handleToggleState(st)}>
                  {st}
                </Chip>
              ))}
            </div>
          </SheetSection>

          <SheetSection title="Smeštaj i društvo">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Smeštaj">
                <select value={f.housingPreference} onChange={upd("housingPreference")} className={inp}>
                  <option value="Smeštaj obezbeđen od poslodavca">Obezbeđuje poslodavac</option>
                  <option value="Asistirani smeštaj od strane sponzora">Pomaže sponzor</option>
                  <option value="Sopstveni smeštaj">Imam svoj smeštaj</option>
                </select>
              </FormField>
              <FormField label="Putujem sa" hint="Ostavi „Samostalno“ ako ideš sam.">
                <input type="text" value={f.travelingWith} onChange={upd("travelingWith")} placeholder="Ime i prezime" className={inp} />
              </FormField>
            </div>
          </SheetSection>
        </div>
      )}

      {/* 5. Video */}
      {activeTab === "video" && (
        <div className="space-y-6">
          <FormField label="Link do videa" hint="YouTube (može „Unlisted“), Loom ili Vimeo. 60–90 sekundi, na engleskom.">
            <input
              type="url"
              required
              inputMode="url"
              value={f.youtubeUrl}
              onChange={upd("youtubeUrl")}
              placeholder="https://youtu.be/…"
              className={inp}
            />
          </FormField>

          {embedVideoUrl ? (
            <iframe
              src={embedVideoUrl}
              title="Video predstavljanje"
              className="aspect-video w-full max-w-lg rounded-xl border border-line bg-ink"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : null}

          <SheetSection title="Šta da kažeš za 60 sekundi">
            <ol className="divide-y divide-line rounded-xl border border-line">
              {[
                ["0:00", "Ko si: ime, grad, fakultet, hobi."],
                ["0:15", "Zašto SAD i Work and Travel."],
                ["0:35", "Gde si radio i zašto si pouzdan."],
                ["0:50", "Pozdrav sa osmehom — „Looking forward to meeting you!“"],
              ].map(([t, x]) => (
                <li key={t} className="flex gap-4 px-4 py-3 text-sm">
                  <span className="w-10 shrink-0 font-medium tabular-nums text-ink-3">{t}</span>
                  <span className="text-ink-2">{x}</span>
                </li>
              ))}
            </ol>
          </SheetSection>
        </div>
      )}
    </Sheet>
  );
}
