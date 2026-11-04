"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import BoneIcon from "@/components/BoneIcon";
import InfoSection from "@/components/InfoSection";
import Pawsi from "@/components/Pawsi";
import { HUESITO_PACKS, type HuesitoPackId } from "@/lib/huesito-packs";
import { notifyHuesitosChanged } from "@/lib/huesitos-client";
import { HUESITO_COSTS } from "@/lib/huesitos-shared";
import type { AiFeature } from "@/lib/ai-usage";

// Funciones de IA ordenadas de más barata a más cara
const AI_FEATURES = (Object.keys(HUESITO_COSTS) as AiFeature[]).sort(
  (a, b) => HUESITO_COSTS[a] - HUESITO_COSTS[b]
);

// Tras pagar, Stripe avisa a PAWS en unos segundos: refrescamos el saldo
// varias veces para que la pastilla de huesitos se actualice sola
const REFRESH_TIMES_MS = [2000, 5000, 10000];

// Página para comprar packs de huesitos (compra única, no caducan)
export default function HuesitosShopPage() {
  const t = useTranslations("HuesitoShop");
  const locale = useLocale();

  const [justPaid, setJustPaid] = useState(false);
  const [buying, setBuying] = useState<HuesitoPackId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paid =
      new URLSearchParams(window.location.search).get("status") === "success";
    if (!paid) return;

    setJustPaid(true);
    const timers = REFRESH_TIMES_MS.map((ms) =>
      window.setTimeout(notifyHuesitosChanged, ms)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  async function handleBuy(packId: HuesitoPackId) {
    setBuying(packId);
    setError(null);

    try {
      const response = await fetch("/api/stripe/huesitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: packId }),
      });
      const result: unknown = await response.json().catch(() => null);
      const url =
        result && typeof result === "object" && "url" in result &&
        typeof result.url === "string"
          ? result.url
          : null;

      if (response.status === 401) {
        window.location.href = "/login?next=/huesitos";
        return;
      }

      if (!response.ok || !url) {
        setError(t("errorGeneric"));
        setBuying(null);
        return;
      }

      window.location.href = url;
    } catch {
      setError(t("errorGeneric"));
      setBuying(null);
    }
  }

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
            href="/settings#huesitos"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("back")}
          </Link>
        </div>

        {justPaid && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl bg-green-50 p-5 shadow">
            <Pawsi pose="celebra" size={80} />
            <div>
              <p className="text-lg font-bold text-green-800">{t("successTitle")}</p>
              <p className="text-green-700">{t("successText")}</p>
            </div>
          </div>
        )}

        {/* PACKS */}
        <div className="grid gap-4 md:grid-cols-3">
          {HUESITO_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow ${
                pack.featured ? "ring-2 ring-blue-500" : ""
              }`}
            >
              {pack.featured && (
                <span className="absolute -top-3 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                  {t("featured")}
                </span>
              )}

              <BoneIcon className="h-8 w-14" />
              <p className="mt-3 text-4xl font-extrabold text-[#1e3a5f]">{pack.huesitos}</p>
              <p className="text-slate-500">{t("huesitos")}</p>

              <p className="mt-4 text-2xl font-bold text-slate-800">
                {locale === "en" ? pack.priceEn : pack.priceEs}
              </p>

              <button
                type="button"
                onClick={() => handleBuy(pack.id)}
                disabled={buying !== null}
                className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {buying === pack.id ? t("redirecting") : t("buy")}
              </button>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-center font-semibold text-red-600">{error}</p>}

        <ul className="mx-auto mt-8 max-w-xl space-y-2 text-sm text-slate-600">
          <li>✅ {t("noExpiry")}</li>
          <li>✅ {t("taxIncluded")}</li>
          <li>✅ {t("proTip")}</li>
        </ul>

        {/* TODO SOBRE LOS HUESITOS */}
        <h2 className="mt-12 text-3xl font-extrabold text-[#1e3a5f]">{t("infoTitle")}</h2>

        <div className="mt-6 space-y-4">
          <InfoSection title={t("whatTitle")} items={t.raw("what")} icon="🦴" />

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="text-lg font-bold text-[#1e3a5f]">{t("usesTitle")}</h3>
            <p className="mt-2 text-slate-700">{t("usesIntro")}</p>
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {AI_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start justify-between gap-4 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {t(`features.${feature}.name`)}
                    </p>
                    <p className="text-sm text-slate-600">{t(`features.${feature}.desc`)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                    {t("cost", { count: HUESITO_COSTS[feature] })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">{t("usesExample")}</p>
          </section>

          <InfoSection title={t("whoTitle")} items={t.raw("who")} icon="👤" />
          <InfoSection title={t("expiryTitle")} items={t.raw("expiry")} icon="⏳" />
          <InfoSection title={t("notTitle")} items={t.raw("not")} icon="❌" />
          <InfoSection title={t("emptyTitle")} items={t.raw("empty")} icon="💡" />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          {t.rich("legal", {
            terms: (chunks) => (
              <Link href="/legal/condiciones" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
