import { readJsonObject } from "@/lib/homework";

// Acceso a las herramientas de adiestrador (invitar clientes y mandar deberes):
// 30 días de prueba gratis desde que se crea la cuenta, o PAWS PRO activo.
// La regla real está en Supabase (función has_trainer_access).

export const TRIAL_DAYS = 30;

export type TrainerAccess = {
  isPro: boolean;
  hasAccess: boolean;
  trialEndsAt: string | null;
};

// Lee la respuesta de la función get_my_trainer_access
export function readTrainerAccess(value: unknown): TrainerAccess | null {
  const data = readJsonObject(value);
  if (!data) return null;

  return {
    isPro: data.is_pro === true,
    hasAccess: data.has_access === true,
    trialEndsAt: typeof data.trial_ends_at === "string" ? data.trial_ends_at : null,
  };
}

// Días que quedan de prueba (0 si ya ha terminado)
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}
