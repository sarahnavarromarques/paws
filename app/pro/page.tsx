"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";

const supabase = createClient();

// Estados de Stripe en los que el usuario es PRO
// (igual que ACTIVE_SUBSCRIPTION_STATUSES en lib/stripe.ts, que es solo de servidor)
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

// Tras pagar, Stripe avisa a PAWS en unos segundos: lo comprobamos varias veces
const SUCCESS_CHECKS = 10;
const SUCCESS_CHECK_INTERVAL_MS = 2000;

const FEATURE_KEYS = [
  "featureClients",
  "featureHomework",
  "featureHuesitos",
  "featureClientsFree",
] as const;

type Subscription = Pick<
  Database["public"]["Tables"]["billing_subscriptions"]["Row"],
  "status" | "current_period_end" | "cancel_at_period_end" | "is_founder"
>;

// Página de PAWS PRO: precio, contratar y gestionar la suscripción
export default function ProPage() {
  const t = useTranslations("Pro");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  // Ha usado un enlace de fundador: paga con el 50% para siempre
  const [isFounder, setIsFounder] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async (): Promise<Subscription | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoggedIn(false);
      return null;
    }

    const [{ data }, { data: founderInvite }] = await Promise.all([
      supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, cancel_at_period_end, is_founder")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("founder_invites")
        .select("token")
        .eq("redeemed_by", user.id)
        .maybeSingle(),
    ]);

    setSubscription(data);
    setIsFounder(!!founderInvite);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const paid =
        new URLSearchParams(window.location.search).get("status") === "success";
      if (paid) setJustPaid(true);

      let current = await loadSubscription();
      if (!cancelled) setLoading(false);

      // Si acaba de pagar, esperamos a que llegue el aviso de Stripe
      for (
        let i = 0;
        paid && !cancelled && i < SUCCESS_CHECKS &&
        !(current && ACTIVE_STATUSES.includes(current.status));
        i++
      ) {
        await new Promise((resolve) => setTimeout(resolve, SUCCESS_CHECK_INTERVAL_MS));
        if (!cancelled) current = await loadSubscription();
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [loadSubscription]);

  const isPro = !!subscription && ACTIVE_STATUSES.includes(subscription.status);

  // Ir a la página de pago o al portal de Stripe
  const goToStripe = async (endpoint: "checkout" | "portal") => {
    setRedirecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/stripe/${endpoint}`, { method: "POST" });
      const result: unknown = await response.json().catch(() => null);
      const url =
        result && typeof result === "object" && "url" in result &&
        typeof result.url === "string"
          ? result.url
          : null;

      if (!response.ok || !url) {
        const code =
          result && typeof result === "object" && "error" in result
            ? String(result.error)
            : "";
        setError(code === "already_pro" ? t("errorAlreadyPro") : t("errorGeneric"));
        setRedirecting(false);
        if (code === "already_pro") await loadSubscription();
        return;
      }

      window.location.href = url;
    } catch {
      setError(t("errorGeneric"));
      setRedirecting(false);
    }
  };

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        {/* CABECERA */}
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-700 md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow">
            <PawsiLoading text={t("loading")} variant="card" />
          </div>
        ) : !loggedIn ? (
          <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
            <p className="text-lg text-slate-700">{t("loginFirst")}</p>
            <Link
              href="/login?next=/pro"
              className="mt-5 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              {t("login")}
            </Link>
          </div>
        ) : isPro && subscription ? (
          /* YA ES PRO */
          <div className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow">
            <div className="flex justify-center">
              <Pawsi pose="celebra" size={130} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#1e3a5f]">
              {justPaid ? t("welcomeTitle") : t("activeTitle")}
            </h2>
            <p className="mt-2 text-slate-600">{t("activeText")}</p>

            {subscription.is_founder && (
              <span className="mt-4 rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-800">
                {t("founderBadge")}
              </span>
            )}

            {subscription.status === "past_due" && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700">
                {t("pastDue")}
              </p>
            )}

            {subscription.current_period_end && (
              <p className="mt-4 text-sm text-slate-500">
                {subscription.cancel_at_period_end
                  ? t("endsOn", { date: formatDate(subscription.current_period_end) })
                  : t("renewsOn", { date: formatDate(subscription.current_period_end) })}
              </p>
            )}

            <button
              type="button"
              onClick={() => goToStripe("portal")}
              disabled={redirecting}
              className="mt-6 rounded-xl bg-slate-700 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {redirecting ? t("redirecting") : t("manage")}
            </button>

            {error && <p className="mt-4 font-semibold text-red-600">{error}</p>}
          </div>
        ) : (
          /* TODAVÍA NO ES PRO */
          <div className="rounded-2xl bg-white p-8 shadow">
            {justPaid && (
              <div className="mb-6 rounded-xl bg-blue-50 px-4 py-3 text-center font-semibold text-blue-800">
                {t("processing")}
              </div>
            )}

            <div className="flex flex-col items-center text-center">
              <div className="flex justify-center">
                <Pawsi pose="premio" size={120} />
              </div>

              {isFounder && (
                <span className="mt-4 rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-800">
                  {t("founderOffer")}
                </span>
              )}

              <div className="mt-4 flex items-end justify-center gap-3">
                {isFounder ? (
                  <>
                    <span className="text-2xl font-semibold text-slate-400 line-through">
                      {t("regularPrice")}
                    </span>
                    <span className="text-5xl font-extrabold text-[#1e3a5f]">
                      {t("founderPrice")}
                    </span>
                  </>
                ) : (
                  <span className="text-5xl font-extrabold text-[#1e3a5f]">
                    {t("regularPrice")}
                  </span>
                )}
                <span className="pb-1 text-slate-500">{t("perMonth")}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{t("taxIncluded")}</p>
            </div>

            <ul className="mx-auto mt-8 max-w-md space-y-3">
              {FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 text-lg">✅</span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center">
              <button
                type="button"
                onClick={() => goToStripe("checkout")}
                disabled={redirecting}
                className="w-full max-w-sm rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {redirecting ? t("redirecting") : t("subscribe")}
              </button>
              <p className="mt-3 text-center text-sm text-slate-500">{t("cancelAnytime")}</p>
              {error && <p className="mt-4 font-semibold text-red-600">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
