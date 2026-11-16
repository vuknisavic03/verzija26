import { Suspense, lazy, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import { HomePrograms, HomeSteps, HomePricing, HomeVoices, HomeFaq, HomeOffers, HomeEarnings, HomeDestinations, HomeObjections, StickyApply } from "./components/Home";
import CtaBand from "./components/CtaBand";
import Footer from "./components/Footer";
import navItems from "./data/navItems";
// Direktno iz session modula (ne iz zbirnog index-a) da početni paket ne povuče ceo store.
import {
  getCurrentUser,
  clearCurrentUser,
  syncFromBackend,
  loginCandidate,
  loginAdmin,
  fetchSessionRole,
  logoutSession,
} from "./data/candidateStore/session";

// Sve osim početne se učitava tek kad zatreba — posetilac ne preuzima admin panel i portal.
const ProgramsPage = lazy(() => import("./components/ProgramsPage"));
const Discounts = lazy(() => import("./components/Discounts"));
const Cooperation = lazy(() => import("./components/Cooperation"));
const ExperiencesPage = lazy(() => import("./components/ExperiencesPage"));
const News = lazy(() => import("./components/News"));
const NewsArticle = lazy(() => import("./components/NewsArticle"));
const Contact = lazy(() => import("./components/Contact"));
const Login = lazy(() => import("./components/Login"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const VerifyEmail = lazy(() => import("./components/VerifyEmail"));
const Register = lazy(() => import("./components/Register"));
const OnlinePrijava = lazy(() => import("./components/OnlinePrijava"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ChatWidget = lazy(() => import("./components/ChatWidget"));

const ADMIN_SESSION_KEY = "aa_admin_session";
const PORTAL_PATHS = ["/prijava", "/registracija", "/profil", "/nalog", "/admin"];

const TITLES = {
  "/": "American Adventure — Work & Travel",
  "/programi": "Programi",
  "/akcije": "Akcije i popusti",
  "/popusti": "Akcije i popusti",
  "/saradnja": "Saradnja",
  "/foto-story": "Iskustva učesnika",
  "/iskustva": "Iskustva učesnika",
  "/novosti": "Novosti",
  "/vesti": "Novosti",
  "/kontakt": "Kontakt",
  "/prijava": "Prijava na nalog",
  "/zaboravljena-lozinka": "Zaboravljena lozinka",
  "/nova-lozinka": "Nova lozinka",
  "/potvrda-emaila": "Potvrda emaila",
  "/registracija": "Aktivacija naloga",
  "/prijava-online": "Online prijava",
  "/nalog": "Moj profil",
  "/profil": "Moj profil",
  "/admin": "Admin portal",
};

// Pretraga iz zaglavlja: naziv programa vodi na program, sve ostalo na vesti i vodiče.
const PROGRAM_WORDS = ["work and travel", "work & travel", "internship", "training", "high school", "srednj", "au pair", "h-2b", "australi", "dual", "posao", "poslov", "lifeguard", "spasila"];
const searchTarget = (query) => {
  const q = query.trim().toLowerCase();
  const base = PROGRAM_WORDS.some((w) => q.includes(w)) ? "/programi" : "/novosti";
  return `${base}?search=${encodeURIComponent(query.trim())}`;
};

const newsSlugFor = (path) => /^\/(novosti|vesti)\/.+/.test(path);

const currentHref = () => window.location.pathname + window.location.search + window.location.hash || "/";

// Lokalni podsetnik samo za prvi prikaz (bez treptanja); pravu sesiju uvek potvrđuje server.
function readAdminSession() {
  try {
    return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAdminSession(on) {
  try {
    if (on) localStorage.setItem(ADMIN_SESSION_KEY, "true");
    else localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* privatni režim — sesija važi do osvežavanja */
  }
}

/** Nepostojeća adresa: jasno šta se desilo i kuda dalje. */
function NotFound({ onNavigate }) {
  const go = (href) => (e) => onNavigate(e, href);
  return (
    <section className="bg-brand">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 sm:pb-32 sm:pt-24">
        <p className="font-sign text-lg font-bold text-ink">Greška 404</p>
        <h1 className="font-display mt-4 max-w-4xl text-[clamp(2.6rem,6.4vw,5.4rem)] font-extrabold leading-[0.92] text-ink">
          Ova strana ne postoji
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80">
          Adresa je pogrešno upisana ili je strana premeštena. Kreni sa početne ili pogledaj programe.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="/" onClick={go("/")} className="inline-flex h-13 items-center justify-center rounded-full bg-ink px-7 text-base font-semibold text-white hover:bg-neutral-950">
            Na početnu
          </a>
          <a href="/programi" onClick={go("/programi")} className="inline-flex h-13 items-center justify-center rounded-full border-2 border-ink px-7 text-base font-semibold text-ink hover:bg-ink hover:text-brand">
            Programi
          </a>
        </div>
      </div>
    </section>
  );
}

function PageFallback() {
  return <div className="min-h-[70vh]" aria-busy="true" />;
}

export default function App() {
  const [activeHref, setActiveHref] = useState(() => (typeof window === "undefined" ? "/" : currentHref()));
  const [isAdmin, setIsAdmin] = useState(readAdminSession);
  const [currentCandidate, setCurrentCandidate] = useState(getCurrentUser);
  const [appliedProgram, setAppliedProgram] = useState("");
  const [accountProgram, setAccountProgram] = useState("");

  const loggedIn = isAdmin || Boolean(currentCandidate);
  const portalSynced = useRef(false);


  const navigateTo = (href, { replace = false } = {}) => {
    if (!href) return;
    if (currentHref() !== href) {
      window.history[replace ? "replaceState" : "pushState"]({ href }, "", href);
    }
    setActiveHref(href);
  };

  const handleNavigate = (e, href) => {
    e?.preventDefault?.();
    navigateTo(href);
  };

  // Back / Forward u pregledaču
  useEffect(() => {
    const onPopState = () => setActiveHref(currentHref());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleLogin = async (creds = {}) => {
    const email = (creds.identifier || "").trim().toLowerCase();
    const password = creds.password || "";
    if (!email.includes("@")) {
      return { success: false, error: "Prijavi se email adresom na koju je otvoren nalog." };
    }

    // 1) Kandidat
    const candidate = await loginCandidate(email, password);
    if (candidate.ok) {
      writeAdminSession(false);
      setIsAdmin(false);
      setCurrentCandidate(candidate.candidate || getCurrentUser());
      portalSynced.current = true;
      navigateTo("/profil");
      return { success: true };
    }
    // Zaključan nalog kandidata: ne pokušavaj prijavu agencije, njena poruka bi sakrila pravi razlog.
    if (candidate.locked || candidate.status === 429 || candidate.status === 0) return { success: false, error: candidate.error };
    if (candidate.unverified) return { success: false, error: candidate.error, unverified: true, email };

    // 2) Agencija
    const admin = await loginAdmin(email, password);
    if (admin.ok) {
      writeAdminSession(true);
      clearCurrentUser();
      setCurrentCandidate(null);
      setIsAdmin(true);
      portalSynced.current = false;
      navigateTo("/admin");
      return { success: true };
    }
    return { success: false, error: admin.error || candidate.error };
  };

  // Server je jedini izvor istine o sesiji: istekao kolačić znači odjavu i u pregledaču.
  useEffect(() => {
    if (!isAdmin && !currentCandidate && !PORTAL_PATHS.includes(currentHref().split("?")[0])) return;
    let cancelled = false;
    fetchSessionRole().then(({ reachable, role }) => {
      if (cancelled || !reachable) return;
      if (role === "admin") {
        writeAdminSession(true);
        setIsAdmin(true);
        setCurrentCandidate(null);
      } else if (role === "candidate") {
        writeAdminSession(false);
        setIsAdmin(false);
        setCurrentCandidate((prev) => prev || getCurrentUser() || {});
      } else {
        writeAdminSession(false);
        clearCurrentUser();
        setIsAdmin(false);
        setCurrentCandidate(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisterSubmit = (candidateProfile) => {
    writeAdminSession(false);
    setIsAdmin(false);
    setCurrentCandidate(candidateProfile);
    navigateTo("/profil");
  };

  const handleLogout = async (next = "/prijava") => {
    setIsAdmin(false);
    setCurrentCandidate(null);
    writeAdminSession(false);
    portalSynced.current = false;
    // Posle odjave student se vraća samo prijavom (email + lozinka), bez koda.
    navigateTo(typeof next === "string" ? next : "/prijava");
    await logoutSession();
  };

  // Ruta
  const basePath = activeHref.split("?")[0].split("#")[0];
  const hash = activeHref.includes("#") ? activeHref.split("#")[1] : "";
  const params = new URLSearchParams(activeHref.includes("?") ? activeHref.split("?")[1].split("#")[0] : "");
  const programParam = params.get("program") || params.get("p") || "";
  const searchParam = params.get("search") || "";

  // Skrol: na anker ako postoji, inače na vrh (odmah — animiran skrol preko nove strane samo smeta).
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const timer = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 150);
    return () => clearTimeout(timer);
  }, [basePath, hash]);

  useEffect(() => {
    const title = TITLES[basePath];
    if (newsSlugFor(basePath)) return; // naslov postavlja sama vest
    document.title = basePath === "/" ? TITLES["/"] : title ? `${title} — American Adventure` : "Strana ne postoji — American Adventure";
  }, [basePath]);

  // Stanje portala sa backenda treba samo prijavljenima i stranama naloga — javni posetilac ga ne preuzima.
  const needsPortalState = loggedIn;
  useEffect(() => {
    if (!needsPortalState || portalSynced.current) return;
    portalSynced.current = true;
    syncFromBackend().then((data) => {
      if (data?.candidate) {
        setCurrentCandidate((prev) => (prev ? { ...prev, ...data.candidate } : data.candidate));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPortalState]);

  const isProfile = basePath === "/profil" || basePath === "/nalog";
  const isAdminRoute = basePath === "/admin";
  const isLogin = basePath === "/prijava";
  const newsSlug = basePath.startsWith("/novosti/")
    ? basePath.slice("/novosti/".length)
    : basePath.startsWith("/vesti/")
    ? basePath.slice("/vesti/".length)
    : null;

  // Prijavljen korisnik nema šta da traži na strani za prijavu — vodi ga u njegov portal.
  useEffect(() => {
    if (isLogin && loggedIn) navigateTo(isAdmin ? "/admin" : "/profil", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin, loggedIn, isAdmin]);

  // Admin portal — samo za prijavljenog administratora.
  if (isAdmin && (isAdminRoute || isProfile)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <AdminPanel onLogout={handleLogout} onNavigate={handleNavigate} logoHref="/" />
      </Suspense>
    );
  }

  // Portal kandidata
  if (isProfile && currentCandidate) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Dashboard
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          logoHref="/"
          candidateData={currentCandidate}
          initialProgram={appliedProgram || accountProgram}
          onProgramChange={setAccountProgram}
        />
        <ChatWidget />
      </Suspense>
    );
  }

  const login = (
    <Login onNavigate={handleNavigate} onSubmit={handleLogin} registerHref="/registracija" applyHref="/prijava-online" />
  );

  const renderPage = () => {
    // Zaštićene rute bez sesije → prijava.
    if (isProfile || isAdminRoute || isLogin) return login;
    if (newsSlug) return <NewsArticle slug={newsSlug} onNavigate={handleNavigate} />;

    switch (basePath) {
      case "/programi":
        return (
          <ProgramsPage
            key={`${programParam}|${searchParam}`}
            onNavigate={handleNavigate}
            initialProgramId={programParam || "work-and-travel"}
            initialSearch={searchParam}
          />
        );
      case "/akcije":
      case "/popusti":
        return <Discounts onRegister={() => navigateTo("/prijava-online")} onNavigate={handleNavigate} />;
      case "/saradnja":
        return <Cooperation />;
      case "/foto-story":
      case "/iskustva":
        return <ExperiencesPage onNavigate={handleNavigate} />;
      case "/novosti":
      case "/vesti":
        return <News key={searchParam} initialQuery={searchParam} onNavigate={handleNavigate} />;
      case "/kontakt":
        return <Contact />;
      case "/zaboravljena-lozinka":
        return <ForgotPassword onNavigate={handleNavigate} loginHref="/prijava" />;
      case "/potvrda-emaila":
        return (
          <VerifyEmail
            onNavigate={handleNavigate}
            loginHref="/prijava"
            signedInAs={isAdmin ? "admin" : currentCandidate ? "candidate" : ""}
            onSwitchAccount={handleLogout}
          />
        );
      case "/nova-lozinka":
        return <ResetPassword onNavigate={handleNavigate} loginHref="/prijava" forgotHref="/zaboravljena-lozinka" />;
      case "/registracija":
        return (
          <Register onNavigate={handleNavigate} onSubmit={handleRegisterSubmit} loginHref="/prijava" applyHref="/prijava-online" />
        );
      case "/prijava-online":
        return (
          <OnlinePrijava
            onNavigate={handleNavigate}
            loginHref="/prijava"
            initialProgram={programParam || "work-and-travel"}
            onSubmit={(data) => setAppliedProgram(data.program || "")}
          />
        );
      case "/":
      case "":
        return (
          <>
            <Hero onNavigate={handleNavigate} />
            <HomeOffers onNavigate={handleNavigate} />
            <HomeEarnings onNavigate={handleNavigate} />
            <HomeDestinations onNavigate={handleNavigate} />
            <HomeObjections />
            <HomeSteps />
            <HomePricing onNavigate={handleNavigate} />
            <HomeVoices onNavigate={handleNavigate} />
            <HomePrograms onNavigate={handleNavigate} />
            <HomeFaq onNavigate={handleNavigate} />
            <CtaBand id="zavrsni-poziv" onNavigate={handleNavigate} />
            <StickyApply onNavigate={handleNavigate} />
          </>
        );
      default:
        return <NotFound onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <Header
        navItems={navItems}
        activeHref={activeHref}
        onSearch={(query) => navigateTo(searchTarget(query))}
        onNavigate={handleNavigate}
        onLogin={() => navigateTo("/prijava")}
        onApply={() => navigateTo("/prijava-online?program=work-and-travel")}
        loggedIn={loggedIn}
        appHref={isAdmin ? "/admin" : "/profil"}
        appLabelKey={isAdmin ? "dash.adminBadge" : "auth.myApp"}
        logoHref="/"
      />

      <main>
        <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
      </main>

      <Footer onNavigate={handleNavigate} />

      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </>
  );
}
