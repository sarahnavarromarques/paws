"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import BoneIcon from "@/components/BoneIcon";
import InfoSection from "@/components/InfoSection";
import Pawsi from "@/components/Pawsi";
import {
  CUSTOM_HUESITOS_MAX,
  CUSTOM_HUESITOS_MIN,
  HUESITO_PACKS,
  customHuesitosPriceCents,
  formatEuros,
  type HuesitoPackId,
} from "@/lib/huesito-packs";
import { notifyHuesitosChanged } from "@/lib/huesitos-client";
import { HUESITO_COSTS } from "@/lib/huesitos-shared";
import type { AiFeature } from "@/lib/ai-usage";

// Funciones de IA ordenadas de más barata a más cara
const AI_FEATURES = (Object.keys(HUESITO_COSTS) as AiFeature[]).sort(
  (a, b) => HUESITO_COSTS[a] - HUESITO_COSTS[b]
);

// Textos de la cantidad personalizada (español / inglés)
const CUSTOM_TEXT = {
  es: {
    title: "Elige cuántos huesitos",
    subtitle: "Cuantos más compras, más barato sale cada huesito.",
    label: "Número de huesitos",
    limits: `Entre ${CUSTOM_HUESITOS_MIN} y ${CUSTOM_HUESITOS_MAX}.`,
    outOfRange: `Elige una cantidad entre ${CUSTOM_HUESITOS_MIN} y ${CUSTOM_HUESITOS_MAX}.`,
    total: "Total",
    buy: "Comprar",
  },
  en: {
    title: "Choose how many bones",
    subtitle: "The more you buy, the cheaper each bone.",
    label: "Number of bones",
    limits: `Between ${CUSTOM_HUESITOS_MIN} and ${CUSTOM_HUESITOS_MAX}.`,
    outOfRange: `Choose an amount between ${CUSTOM_HUESITOS_MIN} and ${CUSTOM_HUESITOS_MAX}.`,
    total: "Total",
    buy: "Buy",
  },
};

// Cantidad que aparece al principio en la caja
const CUSTOM_DEFAULT = 200;

// Tras pagar, Stripe avisa a PAWS en unos segundos: refrescamos el saldo
// varias veces para que la pastilla de huesitos se actualice sola
const REFRESH_TIMES_MS = [2000, 5000, 10000];

// Página para comprar packs de huesitos (compra única, no caducan)
export default function HuesitosShopPage() {
  const t = useTranslations("HuesitoShop");
  const locale = useLocale();
  const customText = CUSTOM_TEXT[locale === "en" ? "en" : "es"];

  const [justPaid, setJustPaid] = useState(false);
  const [buying, setBuying] = useState<HuesitoPackId | "custom" | null>(null);
  // Lo que hay escrito en la caja de cantidad personalizada
  const [customInput, setCustomInput] = useState(String(CUSTOM_DEFAULT));

  const customAmount = Number(customInput);
  const customValid =
    Number.isInteger(customAmount) &&
    customAmount >= CUSTOM_HUESITOS_MIN &&
    customAmount <= CUSTOM_HUESITOS_MAX;
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

  // Compra de un pack o de una cantidad personalizada
  async function handleBuy(choice: HuesitoPackId | "custom") {
    if (choice === "custom" && !customValid) return;

    setBuying(choice);
    setError(null);

    try {
      const response = await fetch("/api/stripe/huesitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          choice === "custom" ? { custom: customAmount } : { pack: choice }
        ),
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
        {/* CABECERA (para volver se usa la flecha de la barra superior) */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-blue-700 md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>
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

        {/* CANTIDAD PERSONALIZADA */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-[#1e3a5f]">{customText.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{customText.subtitle}</p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="customHuesitos"
                className="mb-2 block text-sm font-semibold text-slate-600"
              >
                {customText.label}
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                <BoneIcon className="h-4 w-8 shrink-0" />
                <input
                  id="customHuesitos"
                  type="number"
                  inputMode="numeric"
                  min={CUSTOM_HUESITOS_MIN}
                  max={CUSTOM_HUESITOS_MAX}
                  step={1}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value.replace(/\D/g, ""))}
                  disabled={buying !== null}
                  className="w-full bg-transparent py-3 text-lg font-bold text-slate-900 outline-none"
                />
              </div>
              <p
                className={`mt-1 text-xs ${
                  customValid || customInput === "" ? "text-slate-400" : "font-semibold text-red-600"
                }`}
              >
                {customValid || customInput === "" ? customText.limits : customText.outOfRange}
              </p>
            </div>

            <div className="text-center sm:w-40">
              <p className="text-sm text-slate-500">{customText.total}</p>
              <p className="text-3xl font-extrabold text-slate-800">
                {customValid
                  ? formatEuros(customHuesitosPriceCents(customAmount), locale)
                  : "—"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleBuy("custom")}
              disabled={buying !== null || !customValid}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-40"
            >
              {buying === "custom" ? t("redirecting") : customText.buy}
            </button>
          </div>
        </section>

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