import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/stripe";
import { isAdminEmail, isFounderToken } from "@/lib/founder";

// Gestión de enlaces de fundador. SOLO para administradores de PAWS
// (correos de la variable PAWS_ADMIN_EMAILS).

const MAX_LABEL_LENGTH = 80;

async function getAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "not_logged_in" }, { status: 401 }) };
  }
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[founder-invites] Falta SUPABASE_SERVICE_ROLE_KEY");
    return { error: NextResponse.json({ error: "not_configured" }, { status: 500 }) };
  }

  return { admin };
}

// Lista de enlaces, con el correo de quien los ha usado
export async function GET() {
  const { admin, error } = await getAdmin();
  if (!admin) return error;

  const { data, error: listError } = await admin
    .from("founder_invites")
    .select("token, label, created_at, redeemed_by, redeemed_at")
    .order("created_at", { ascending: false });

  if (listError) {
    console.error("[founder-invites] Error listando:", listError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const rows = data ?? [];

  // Correos de quienes han usado un enlace
  const emails = new Map<string, string>();
  const redeemedIds = rows.flatMap((row) => (row.redeemed_by ? [row.redeemed_by] : []));

  await Promise.all(
    redeemedIds.map(async (id) => {
      const { data: userData } = await admin.auth.admin.getUserById(id);
      if (userData.user?.email) emails.set(id, userData.user.email);
    })
  );

  return NextResponse.json({
    invites: rows.map((row) => ({
      token: row.token,
      label: row.label,
      createdAt: row.created_at,
      redeemedAt: row.redeemed_at,
      redeemedEmail: row.redeemed_by ? emails.get(row.redeemed_by) ?? null : null,
    })),
  });
}

// Crear un enlace nuevo: { label: "Nombre del adiestrador" }
export async function POST(request: Request) {
  const { admin, error } = await getAdmin();
  if (!admin) return error;

  const body: unknown = await request.json().catch(() => null);
  const rawLabel =
    body && typeof body === "object" && "label" in body && typeof body.label === "string"
      ? body.label
      : "";
  const label = rawLabel.trim().slice(0, MAX_LABEL_LENGTH);

  const { data, error: insertError } = await admin
    .from("founder_invites")
    .insert({ label })
    .select("token")
    .single();

  if (insertError || !data) {
    console.error("[founder-invites] Error creando:", insertError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ token: data.token });
}

// Borrar un enlace que todavía no se ha usado: ?token=...
export async function DELETE(request: Request) {
  const { admin, error } = await getAdmin();
  if (!admin) return error;

  const token = new URL(request.url).searchParams.get("token");
  if (!isFounderToken(token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const { error: deleteError } = await admin
    .from("founder_invites")
    .delete()
    .eq("token", token)
    .is("redeemed_by", null);

  if (deleteError) {
    console.error("[founder-invites] Error borrando:", deleteError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
