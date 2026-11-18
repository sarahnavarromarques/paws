import { NextResponse } from "next/server";

import type { createClient } from "./supabase/server";
import { AI_CONSENT_REQUIRED } from "./ai-consent-shared";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * ¿Ha aceptado el usuario que sus datos se envíen a la IA?
 * Si no se puede leer, se trata como "no" (nunca se envía nada sin permiso).
 */
export async function hasAiConsent(
  supabase: ServerSupabase,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("ai_consent_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ai-consent] No se pudo leer el consentimiento:", error.message);
    return false;
  }

  return Boolean(data?.ai_consent_at);
}

/**
 * Respuesta que da una ruta de IA cuando falta el permiso.
 * El navegador la detecta y muestra la ventana de consentimiento.
 */
export function aiConsentRequiredResponse() {
  return NextResponse.json({ error: AI_CONSENT_REQUIRED }, { status: 403 });
}