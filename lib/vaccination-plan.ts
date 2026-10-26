// Plan de vacunación sugerido (orientativo) y utilidades de fechas.
// Este archivo no accede a la base de datos: solo calcula.

export type VaccineKey =
  | "polyvalent"
  | "leptospirosis"
  | "rabies"
  | "leishmania"
  | "kennel_cough"
  | "parainfluenza"
  | "coronavirus"
  | "lyme"
  | "babesiosis"
  | "herpesvirus";

export type DoseLabel = "dose1" | "dose2" | "dose3" | "booster";

export type VaccinationStatus = "pending" | "done";

export type DueStatus = "done" | "overdue" | "soon" | "upcoming" | "no_date";

export type PlannedDose = {
  vaccineKey: VaccineKey;
  doseLabel: DoseLabel;
  dueDate: string | null;
};

// Vacunas que entran automáticamente en el plan sugerido
export const PLAN_VACCINE_KEYS: VaccineKey[] = [
  "polyvalent",
  "leptospirosis",
  "rabies",
  "leishmania",
];

// Vacunas opcionales (se añaden con un botón)
export const OPTIONAL_VACCINE_KEYS: VaccineKey[] = [
  "kennel_cough",
  "parainfluenza",
  "coronavirus",
  "lyme",
  "babesiosis",
  "herpesvirus",
];

// Todas las vacunas que PAWS conoce
export const ALL_VACCINE_KEYS: VaccineKey[] = [
  ...PLAN_VACCINE_KEYS,
  ...OPTIONAL_VACCINE_KEYS,
];

// Cada cuántos meses toca el refuerzo de cada vacuna.
// null = no se crea refuerzo automático (p. ej. herpesvirus: en cada gestación).
export const BOOSTER_INTERVAL_MONTHS: Record<VaccineKey, number | null> = {
  polyvalent: 36,
  leptospirosis: 12,
  rabies: 12,
  leishmania: 12,
  kennel_cough: 12,
  parainfluenza: 12,
  coronavirus: 12,
  lyme: 12,
  babesiosis: 6,
  herpesvirus: null,
};

// A partir de esta edad se considera adulto (no se genera plan de cachorro)
export const ADULT_AGE_MONTHS = 12;

// Días de antelación para avisar de una dosis próxima
export const SOON_DAYS = 30;

// Plan de cachorro: semanas de vida en las que toca cada dosis
const PUPPY_SCHEDULE: {
  vaccineKey: VaccineKey;
  doseLabel: DoseLabel;
  weeks: number;
}[] = [
  { vaccineKey: "polyvalent", doseLabel: "dose1", weeks: 8 },
  { vaccineKey: "polyvalent", doseLabel: "dose2", weeks: 12 },
  { vaccineKey: "polyvalent", doseLabel: "dose3", weeks: 16 },
  { vaccineKey: "polyvalent", doseLabel: "booster", weeks: 52 },
  { vaccineKey: "leptospirosis", doseLabel: "dose1", weeks: 8 },
  { vaccineKey: "leptospirosis", doseLabel: "dose2", weeks: 12 },
  { vaccineKey: "rabies", doseLabel: "dose1", weeks: 12 },
  { vaccineKey: "leishmania", doseLabel: "dose1", weeks: 26 },
];

export function isVaccineKey(value: unknown): value is VaccineKey {
  return (
    typeof value === "string" &&
    (ALL_VACCINE_KEYS as string[]).includes(value)
  );
}

export function isDoseLabel(value: unknown): value is DoseLabel {
  return (
    value === "dose1" ||
    value === "dose2" ||
    value === "dose3" ||
    value === "booster"
  );
}

// --- Fechas (siempre en formato AAAA-MM-DD, sin horas) ---

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string | null {
  const date = parseIsoDate(isoDate);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addMonths(isoDate: string, months: number): string | null {
  const date = parseIsoDate(isoDate);
  if (!date) return null;

  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  // Si el mes de destino es más corto (p. ej. 31 → febrero), se usa su último día
  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();

  date.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return toIsoDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;

  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function ageInMonths(
  birthDate: string | null,
  today: string = todayIso()
): number | null {
  const birth = parseIsoDate(birthDate);
  const now = parseIsoDate(today);
  if (!birth || !now) return null;

  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birth.getUTCMonth());

  if (now.getUTCDate() < birth.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

// --- Plan sugerido ---

// Cachorro con fecha de nacimiento → plan completo con fechas.
// Adulto o sin fecha de nacimiento → un refuerzo sin fecha por vacuna
// (el usuario pone la fecha de su cartilla).
export function buildSuggestedPlan(
  birthDate: string | null,
  today: string = todayIso()
): PlannedDose[] {
  const age = ageInMonths(birthDate, today);

  if (!birthDate || age === null || age >= ADULT_AGE_MONTHS) {
    return PLAN_VACCINE_KEYS.map((vaccineKey) => ({
      vaccineKey,
      doseLabel: "booster" as const,
      dueDate: null,
    }));
  }

  return PUPPY_SCHEDULE.map((item) => ({
    vaccineKey: item.vaccineKey,
    doseLabel: item.doseLabel,
    dueDate: addDays(birthDate, item.weeks * 7),
  }));
}

// Fecha del siguiente refuerzo a partir del día en que se puso la vacuna.
// Devuelve null si esa vacuna no tiene refuerzo automático.
export function nextBoosterDate(
  vaccineKey: VaccineKey,
  givenDate: string
): string | null {
  const interval = BOOSTER_INTERVAL_MONTHS[vaccineKey];
  if (interval === null) return null;

  return addMonths(givenDate, interval);
}

// Estado de una dosis para los avisos y los colores
export function getDueStatus(
  status: string,
  dueDate: string | null,
  today: string = todayIso()
): DueStatus {
  if (status === "done") return "done";
  if (!dueDate) return "no_date";

  const diff = daysBetween(today, dueDate);
  if (diff === null) return "no_date";
  if (diff < 0) return "overdue";
  if (diff <= SOON_DAYS) return "soon";
  return "upcoming";
}