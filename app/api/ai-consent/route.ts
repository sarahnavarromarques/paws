import { NextResponse } from "next/server";

import { getAiUser } from "@/lib/ai-usage";

export const runtime = "nodejs";

// Guarda o retira el permiso del usuario para usar la IA.
// consent: true  -> guarda la fecha de hoy
// consent: false -> lo deja vacío (sin permiso)
export async function POST(request: Request) {
  const aiUser = await getAiUser();

  if (!aiUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { supabase, userId } = aiUser;

  let body: { consent?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const consent = body.consent === true;

  const { error } = await supabase
    .from("profiles")
    .update({ ai_consent_at: consent ? new Date().toISOString() : null })
    .eq("id", userId);

  if (error) {
    console.error("[ai-consent] No se pudo guardar el permiso:", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consent });
}