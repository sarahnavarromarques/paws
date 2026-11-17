import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistBody = {
  email?: unknown;
  locale?: unknown;
  website?: unknown;
};

export async function POST(request: Request) {
  let body: WaitlistBody;

  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  // Campo trampa invisible: si viene relleno, es un robot. Respondemos "ok" sin guardar nada.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ status: "ok" });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const locale = body.locale === "en" ? "en" : "es";

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // No hace falta escribir cookies en esta ruta.
          }
        },
      },
    }
  );

  const { error } = await supabase.from("waitlist").insert({ email, locale });

  if (error) {
    // 23505 = el correo ya estaba en la lista.
    if (error.code === "23505") {
      return NextResponse.json({ status: "already" });
    }

    console.error("[waitlist] Error al guardar el correo:", error.message);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}