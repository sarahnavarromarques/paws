// Desparasitaciones: tipos, iconos e intervalos sugeridos (orientativos).
// Comparten tabla con las vacunas (pet_vaccinations, category = "deworming").
// Este archivo no accede a la base de datos: solo calcula.

import { addMonths, isVaccineKey } from "@/lib/vaccination-plan";

export type HealthCategory = "vaccine" | "deworming";

export type DewormingKey =
  | "internal"
  | "pipette"
  | "collar"
  | "flea_tablet"
  | "heartworm";

export const DEWORMING_KEYS: DewormingKey[] = [
  "internal",
  "pipette",
  "collar",
  "flea_tablet",
  "heartworm",
];

// Meses hasta la siguiente dosis que PAWS propone (el usuario puede cambiarlo)
export const DEWORMING_DEFAULT_INTERVAL: Record<DewormingKey, number> = {
  internal: 3,
  pipette: 1,
  collar: 6,
  flea_tablet: 1,
  heartworm: 1,
};

// Opciones del selector "Repetir cada…" (en meses)
export const INTERVAL_OPTIONS: number[] = [1, 2, 3, 4, 6, 8, 12];

// Icono de cada tipo: interna 🪱, externa 🛡️, filaria ❤️
export const DEWORMING_ICONS: Record<DewormingKey, string> = {
  internal: "🪱",
  pipette: "🛡️",
  collar: "🛡️",
  flea_tablet: "🛡️",
  heartworm: "❤️",
};

export const VACCINE_ICON = "💉";

export function isHealthCategory(value: unknown): value is HealthCategory {
  return value === "vaccine" || value === "deworming";
}

export function isDewormingKey(value: unknown): value is DewormingKey {
  return (
    typeof value === "string" &&
    (DEWORMING_KEYS as string[]).includes(value)
  );
}

// Icono para mostrar un registro de salud (vacuna o desparasitación)
export function healthIcon(category: string, key: string | null): string {
  if (category === "deworming") {
    return isDewormingKey(key) ? DEWORMING_ICONS[key] : "🛡️";
  }
  return VACCINE_ICON;
}

// ¿La clave corresponde a algo que PAWS conoce (vacuna o desparasitación)?
export function isKnownHealthKey(category: string, key: string | null): boolean {
  return category === "deworming" ? isDewormingKey(key) : isVaccineKey(key);
}

// Fecha de la siguiente dosis a partir del día en que se puso
export function nextDewormingDate(
  givenDate: string,
  intervalMonths: number | null
): string | null {
  if (!intervalMonths || intervalMonths < 1) return null;
  return addMonths(givenDate, intervalMonths);
}