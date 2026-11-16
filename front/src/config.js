// config.js — podešavanja koja zavise od okruženja (Vite env promenljive).

/**
 * Prototip (demo) režim — podrazumevano ISKLJUČEN.
 *
 * Uključuje se samo za lokalne prezentacije sa `VITE_DEMO_MODE=true`. U demo režimu online
 * prijava ostaje sačuvana lokalno i kada backend nije dostupan, a javna strana programa
 * prikazuje probni katalog poslova. Prijava (admin i kandidat) uvek ide preko backenda.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
