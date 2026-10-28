import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Abre el portal de Stripe para que el usuario gestione su suscripción
// (cambiar tarjeta, ver facturas, cancelar). Devuelve { url }.

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[stripe/portal] Falta STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("billing_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "no_subscription" }, { status: 404 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${new URL(request.url).origin}/pro`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/portal] Error abriendo el portal:", error);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
