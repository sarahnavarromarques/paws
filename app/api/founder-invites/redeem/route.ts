import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/stripe";
import { isFounderToken } from "@/lib/founder";

// Canjear un enlace de fundador (cualquier usuario con sesión iniciada).
// GET  ?token=...      → en qué estado está el enlace
// POST { token: ... }  → usarlo y quedar marcado como fundador

type FounderStatus =
  | "not_found" // no existe
  | "available" // se puede usar
  | "yours" // ya lo has usado tú
  | "used" // lo ha usado otra persona
  | "already_founder"; // ya eres fundador con otro enlace

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function getStatus(
  admin: AdminClient,
  token: string,
  userId: string | null
): Promise<FounderStatus> {
  const { data: invite } = await admin
    .from("founder_invites")
    .select("redeemed_by")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return "not_found";
  if (invite.redeemed_by && invite.redeemed_by === userId) return "yours";
  if (invite.redeemed_by) return "used";

  if (userId) {
    const { data: other } = await admin
      .from("founder_invites")
      .select("token")
      .eq("redeemed_by", userId)
      .maybeSingle();
    if (other) return "already_founder";
  }

  return "available";
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!isFounderToken(token)) {
    return NextResponse.json({ status: "not_found", loggedIn: false });
  }

  const userId = await getUserId();
  const status = await getStatus(admin, token, userId);

  return NextResponse.json({ status, loggedIn: userId !== null });
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const token =
    body && typeof body === "object" && "token" in body ? body.token : null;

  if (!isFounderToken(token)) {
    return NextResponse.json({ status: "not_found" });
  }

  const status = await getStatus(admin, token, userId);
  if (status !== "available") {
    return NextResponse.json({ status });
  }

  // Solo se marca si nadie lo ha usado todavía (evita que dos personas
  // lo usen a la vez)
  const { data: updated, error } = await admin
    .from("founder_invites")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("token", token)
    .is("redeemed_by", null)
    .select("token");

  if (error) {
    // 23505: este usuario ya tiene otro enlace canjeado
    if (error.code === "23505") {
      return NextResponse.json({ status: "already_founder" });
    }
    console.error("[founder-invites/redeem] Error canjeando:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ status: "used" });
  }

  return NextResponse.json({ status: "yours" });
}
