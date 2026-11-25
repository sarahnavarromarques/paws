import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  CUSTOM_PACK_ID,
  customHuesitosPriceCents,
  findHuesitoPack,
  isValidCustomAmount,
} from "@/lib/huesito-packs";
import { getHuesitoPackPriceId, getStripe } from "@/lib/stripe";

// Abre la página de pago de Stripe para comprar huesitos.
// Recibe { pack: "pack100" | "pack300" | "pack1000" }
// o { custom: número de huesitos } (de 50 a 10000) y devuelve { url }.
// El precio de la cantidad personalizada se calcula SIEMPRE aquí, en el
// servidor: el navegador solo dice cuántos huesitos quiere.

type LineItem = {
  price?: string;
  price_data?: {
    currency: string;
    product_data: { name: string; tax_code?: string };
    unit_amount: number;
    tax_behavior?: "inclusive" | "exclusive";
  };
  quantity: number;
};

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
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  const pack = findHuesitoPack(record?.pack);
  const rawCustom = record?.custom;
  const customAmount = isValidCustomAmount(rawCustom) ? rawCustom : null;

  if (!pack && customAmount === null) {
    return NextResponse.json({ error: "invalid_pack" }, { status: 400 });
  }

  // Precio del pack de 100: se usa tal cual para el pack, y para la cantidad
  // personalizada se reutiliza su producto de Stripe (mismo nombre e impuestos)
  const priceId = getHuesitoPackPriceId(pack ? pack.id : "pack100");
  if (!priceId) {
    console.error("[stripe/huesitos] Falta el precio de Stripe de los huesitos");
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
  const isEnglish = profile?.language === "en";
  const huesitos = pack ? pack.huesitos : (customAmount ?? 0);

  const metadata = {
    kind: "huesitos",
    user_id: user.id,
    pack: pack ? pack.id : CUSTOM_PACK_ID,
    huesitos: String(huesitos),
  };

  try {
    let lineItem: LineItem;

    if (pack) {
      lineItem = { price: priceId, quantity: 1 };
    } else {
      const basePrice = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });

      // Código de impuestos del producto de los packs (lo necesita Stripe
      // para calcular el IVA); el nombre es la cantidad real comprada
      const baseProduct = basePrice.product;
      const rawTaxCode =
        typeof baseProduct === "object" && "tax_code" in baseProduct
          ? baseProduct.tax_code
          : null;
      const taxCode =
        typeof rawTaxCode === "string" ? rawTaxCode : rawTaxCode?.id ?? undefined;
      // Mismo tratamiento del IVA que el pack (con o sin IVA incluido)
      const taxBehavior: "inclusive" | "exclusive" | undefined =
        basePrice.tax_behavior === "inclusive"
          ? "inclusive"
          : basePrice.tax_behavior === "exclusive"
          ? "exclusive"
          : undefined;

      lineItem = {
        price_data: {
          currency: basePrice.currency,
          product_data: {
            name: isEnglish ? `${huesitos} bones` : `${huesitos} huesitos`,
            ...(taxCode ? { tax_code: taxCode } : {}),
          },
          unit_amount: customHuesitosPriceCents(huesitos),
          ...(taxBehavior ? { tax_behavior: taxBehavior } : {}),
        },
        quantity: 1,
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [lineItem],
      // Stripe actúa como vendedor: cobra y declara los impuestos por nosotros
      managed_payments: { enabled: true },
      client_reference_id: user.id,
      metadata,
      locale: isEnglish ? "en" : "es",
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