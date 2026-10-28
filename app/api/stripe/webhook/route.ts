import { NextResponse } from "next/server";

import {
  PRO_MONTHLY_HUESITOS,
  asArray,
  asNumber,
  asObject,
  asString,
  createAdminClient,
  getStripe,
  huesitosExpiryFrom,
  idOf,
} from "@/lib/stripe";

// Avisos que Stripe envía a PAWS cuando alguien paga, renueva o cancela.
// Aquí se guarda el estado de PAWS PRO y se dan los huesitos del mes.

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type Stripe = NonNullable<ReturnType<typeof getStripe>>;

// Datos de la suscripción que guardamos en billing_subscriptions
type SubscriptionInfo = {
  id: string;
  customerId: string | null;
  status: string;
  priceId: string | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  userId: string | null;
};

function readSubscription(value: unknown): SubscriptionInfo | null {
  const sub = asObject(value);
  const id = asString(sub?.id);
  if (!sub || !id) return null;

  // El precio y el fin del periodo están en la primera línea de la suscripción
  const firstItem = asObject(asArray(asObject(sub.items)?.data)[0]);

  return {
    id,
    customerId: idOf(sub.customer),
    status: asString(sub.status) ?? "incomplete",
    priceId: idOf(firstItem?.price),
    periodEnd:
      asNumber(firstItem?.current_period_end) ?? asNumber(sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    userId: asString(asObject(sub.metadata)?.user_id),
  };
}

// Busca a qué usuario de PAWS pertenece una suscripción
async function findUserId(
  admin: AdminClient,
  info: { userId: string | null; subscriptionId: string | null; customerId: string | null }
): Promise<string | null> {
  if (info.userId) return info.userId;

  if (info.subscriptionId) {
    const { data } = await admin
      .from("billing_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", info.subscriptionId)
      .maybeSingle();
    if (data) return data.user_id;
  }

  if (info.customerId) {
    const { data } = await admin
      .from("billing_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", info.customerId)
      .maybeSingle();
    if (data) return data.user_id;
  }

  return null;
}

// Guarda el estado actual de la suscripción en Supabase
async function saveSubscription(
  admin: AdminClient,
  userId: string,
  sub: SubscriptionInfo,
  isFounder?: boolean
) {
  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: sub.customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: sub.priceId,
      current_period_end: sub.periodEnd
        ? new Date(sub.periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
      ...(isFounder !== undefined ? { is_founder: isFounder } : {}),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

// Pide a Stripe la suscripción completa y la guarda
async function syncSubscription(
  stripe: Stripe,
  admin: AdminClient,
  subscriptionId: string,
  fallbackUserId: string | null,
  isFounder?: boolean
) {
  const sub = readSubscription(await stripe.subscriptions.retrieve(subscriptionId));
  if (!sub) return;

  const userId = await findUserId(admin, {
    userId: sub.userId ?? fallbackUserId,
    subscriptionId: sub.id,
    customerId: sub.customerId,
  });

  if (!userId) {
    console.warn("[stripe/webhook] Suscripción sin usuario de PAWS:", sub.id);
    return;
  }

  await saveSubscription(admin, userId, sub, isFounder);
}

// 1) Ha terminado el pago en la página de Stripe
async function handleCheckoutCompleted(stripe: Stripe, admin: AdminClient, object: unknown) {
  const session = asObject(object);
  if (!session || asString(session.mode) !== "subscription") return;

  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) return;

  const userId =
    asString(session.client_reference_id) ??
    asString(asObject(session.metadata)?.user_id);

  const discount = asNumber(asObject(session.total_details)?.amount_discount) ?? 0;

  await syncSubscription(stripe, admin, subscriptionId, userId, discount > 0);
}

// 2) Se ha cobrado una factura (primer mes o renovación): huesitos del mes
async function handleInvoicePaid(stripe: Stripe, admin: AdminClient, object: unknown) {
  const invoice = asObject(object);
  if (!invoice) return;

  const details = asObject(asObject(invoice.parent)?.subscription_details);
  const subscriptionId = idOf(details?.subscription) ?? idOf(invoice.subscription);
  if (!subscriptionId) return;

  const userId = await findUserId(admin, {
    userId: asString(asObject(details?.metadata)?.user_id),
    subscriptionId,
    customerId: idOf(invoice.customer),
  });

  if (!userId) {
    console.warn("[stripe/webhook] Factura sin usuario de PAWS:", asString(invoice.id));
    return;
  }

  // Primero guardamos la suscripción y después damos los huesitos
  await syncSubscription(stripe, admin, subscriptionId, userId);

  const firstLine = asObject(asArray(asObject(invoice.lines)?.data)[0]);
  const periodEnd = asNumber(asObject(firstLine?.period)?.end);

  const { error } = await admin.rpc("grant_subscription_huesitos", {
    p_user_id: userId,
    p_amount: PRO_MONTHLY_HUESITOS,
    p_expires: huesitosExpiryFrom(periodEnd),
  });

  if (error) throw error;
}

// 3) La suscripción ha cambiado o se ha cancelado
async function handleSubscriptionChanged(admin: AdminClient, object: unknown) {
  const sub = readSubscription(object);
  if (!sub) return;

  const userId = await findUserId(admin, {
    userId: sub.userId,
    subscriptionId: sub.id,
    customerId: sub.customerId,
  });

  if (!userId) {
    console.warn("[stripe/webhook] Cambio de suscripción sin usuario:", sub.id);
    return;
  }

  await saveSubscription(admin, userId, sub);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !admin || !webhookSecret) {
    console.error("[stripe/webhook] Faltan variables de entorno de Stripe o Supabase");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Comprobar que el aviso viene de verdad de Stripe
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: ReturnType<Stripe["webhooks"]["constructEvent"]>;
  try {
    if (!signature) throw new Error("Falta la firma");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] Firma no válida:", error);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Si Stripe repite un aviso que ya procesamos, no hacemos nada
  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe/webhook] Error guardando el aviso:", insertError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  try {
    const object: unknown = event.data.object;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, admin, object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(stripe, admin, object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(admin, object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[stripe/webhook] Error procesando ${event.type}:`, error);
    // Lo borramos para que Stripe lo reintente y se procese bien
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
