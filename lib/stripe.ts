import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// PAWS PRO con Stripe. SOLO para usar en el servidor (rutas de API):
// usa claves secretas que nunca deben llegar al navegador.

// Huesitos incluidos cada mes en PAWS PRO (no se acumulan: se renuevan)
export const PRO_MONTHLY_HUESITOS = 300;

// Margen tras el fin del periodo antes de que caduquen los huesitos,
// por si el cobro de la renovación tarda un poco
const HUESITOS_GRACE_DAYS = 2;

// Estados de Stripe en los que el usuario es PRO
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

let stripeClient: Stripe | null = null;

// Cliente de Stripe (null si falta la clave secreta)
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function getProPriceId(): string | null {
  return process.env.STRIPE_PRICE_PRO || null;
}

// Cupón de fundadores que se aplica solo al pagar.
// Si la variable está vacía, en el pago aparece una casilla para
// escribir el código promocional (FUNDADOR50).
export function getFounderCouponId(): string | null {
  return process.env.STRIPE_FOUNDER_COUPON || null;
}

// Cliente de Supabase con permisos de administrador (para el webhook,
// que no tiene sesión de usuario). null si faltan variables.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Fecha de caducidad de los huesitos del mes a partir del fin del periodo
export function huesitosExpiryFrom(periodEndSeconds: number | null): string {
  const base = periodEndSeconds
    ? periodEndSeconds * 1000
    : Date.now() + 31 * 24 * 60 * 60 * 1000;
  return new Date(base + HUESITOS_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// --- Lectura segura de los objetos que envía Stripe ---

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// Un campo de Stripe puede ser un id ("cus_...") o el objeto completo
export function idOf(value: unknown): string | null {
  return asString(value) ?? asString(asObject(value)?.id);
}
