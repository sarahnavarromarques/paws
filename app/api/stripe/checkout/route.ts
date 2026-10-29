import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  getFounderCouponId,
  getProPriceId,
  getStripe,
} from "@/lib/stripe";

// Abre la página de pago de Stripe para suscribirse a PAWS PRO.
// Devuelve { url } y el navegador va a esa dirección.

type Stripe = NonNullable<ReturnType<typeof getStripe>>;
type CheckoutParams = NonNullable<
  Parameters<Stripe["checkout"]["sessions"]["create"]>[0]
>;

export async function POST(request: Request) {
  const stripe = getStripe();
  const priceId = getProPriceId();

  if (!stripe || !priceId) {
    console.error("[stripe/checkout] Faltan STRIPE_SECRET_KEY o STRIPE_PRICE_PRO");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  // ¿Ya es PRO? Entonces no se cobra otra vez
  const { data: current } = await supabase
    .from("billing_subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (current && ACTIVE_SUBSCRIPTION_STATUSES.includes(current.status)) {
    return NextResponse.json({ error: "already_pro" }, { status: 409 });
  }

  // Idioma de la página de pago
  const { data: profile } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .maybeSingle();
  const locale = profile?.language === "en" ? "en" : "es";

  const origin = new URL(request.url).origin;

  const baseParams: CheckoutParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Stripe actúa como vendedor: cobra y declara los impuestos por nosotros
    managed_payments: { enabled: true },
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    locale,
    success_url: `${origin}/pro?status=success`,
    cancel_url: `${origin}/pro`,
    ...(current?.stripe_customer_id
      ? { customer: current.stripe_customer_id }
      : user.email
      ? { customer_email: user.email }
      : {}),
  };

  // ¿Ha usado un enlace de fundador? Entonces tiene el 50% para siempre
  const { data: founderInvite } = await supabase
    .from("founder_invites")
    .select("token")
    .eq("redeemed_by", user.id)
    .maybeSingle();

  const founderCoupon = founderInvite ? getFounderCouponId() : null;

  if (founderInvite && !founderCoupon) {
    console.error("[stripe/checkout] Falta STRIPE_FOUNDER_COUPON para un fundador");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create(
      founderCoupon
        ? { ...baseParams, discounts: [{ coupon: founderCoupon }] }
        : baseParams
    );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] Error creando el pago:", error);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
