import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { findHuesitoPack } from "@/lib/huesito-packs";
import { getHuesitoPackPriceId, getStripe } from "@/lib/stripe";

// Abre la página de pago de Stripe para comprar un pack de huesitos.
// Recibe { pack: "pack100" | "pack300" | "pack1000" } y devuelve { url }.

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[stripe/huesitos] Falta STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const pack = findHuesitoPack(
    body && typeof body === "object" && "pack" in body ? body.pack : null
  );

  if (!pack) {
    return NextResponse.json({ error: "invalid_pack" }, { status: 400 });
  }

  const priceId = getHuesitoPackPriceId(pack.id);
  if (!priceId) {
    console.error(`[stripe/huesitos] Falta el precio de Stripe del pack ${pack.id}`);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Reutilizamos el cliente de Stripe si ya ha pagado antes (PAWS PRO)
  const { data: billing } = await supabase
    .from("billing_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .maybeSingle();

  const origin = new URL(request.url).origin;

  const metadata = {
    kind: "huesitos",
    user_id: user.id,
    pack: pack.id,
    huesitos: String(pack.huesitos),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe actúa como vendedor: cobra y declara los impuestos por nosotros
      managed_payments: { enabled: true },
      client_reference_id: user.id,
      metadata,
      locale: profile?.language === "en" ? "en" : "es",
      success_url: `${origin}/huesitos?status=success`,
      cancel_url: `${origin}/huesitos`,
      ...(billing?.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : user.email
        ? { customer_email: user.email }
        : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/huesitos] Error creando el pago:", error);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
