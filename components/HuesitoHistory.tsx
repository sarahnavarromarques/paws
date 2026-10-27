"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import BoneIcon from "@/components/BoneIcon";
import { createClient } from "@/lib/supabase/client";
import type { AiFeature } from "@/lib/ai-usage";
import {
  HUESITO_COSTS,
  toHuesitoWallet,
  type HuesitoWallet,
} from "@/lib/huesitos-shared";
import { HUESITOS_CHANGED_EVENT } from "@/lib/huesitos-client";

// Movimientos que se cargan cada vez (al abrir y con "Cargar más").
const PAGE_SIZE = 50;

type Language = "es" | "en";

type Transaction = {
  id: number;
  amount: number;
  kind: string;
  feature: string | null;
  created_at: string;
};

type Texts = {
  title: string;
  balanceLabel: string;
  unlimited: string;
  explanation: string;
  buyButton: string;
  soon: string;
  pricesTitle: string;
  historyTitle: string;
  historyButton: string;
  historyHint: string;
  loadMore: string;
  loadingMore: string;
  loadMoreError: string;
  close: string;
  empty: string;
  included: string;
  loading: string;
  error: string;
  kinds: Record<string, string>;
  features: Record<AiFeature, string>;
};

const TEXTS: Record<Language, Texts> = {
  es: {
    title: "Huesitos",
    balanceLabel: "Tu saldo",
    unlimited: "Ilimitados",
    explanation:
      "Los huesitos se usan para las funciones de IA. Si te quedas sin ellos, PAWS sigue funcionando con su versión básica (salvo el chat de la sesión).",
    buyButton: "Comprar huesitos",
    soon: "Próximamente",
    pricesTitle: "Cuánto cuesta cada función",
    historyTitle: "Movimientos",
    historyButton: "Ver movimientos",
    historyHint: "Del más reciente al más antiguo",
    loadMore: "Cargar más",
    loadingMore: "Cargando...",
    loadMoreError: "No se pudieron cargar más movimientos. Inténtalo de nuevo.",
    close: "Cerrar",
    empty: "Todavía no hay movimientos.",
    included: "Incluido",
    loading: "Cargando...",
    error: "No se pudo cargar tu saldo. Inténtalo de nuevo más tarde.",
    kinds: {
      welcome: "Regalo de bienvenida",
      purchase: "Compra de huesitos",
      subscription: "Huesitos de PAWS PRO",
      expire: "Huesitos caducados",
      refund: "Devolución",
      adjustment: "Ajuste",
    },
    features: {
      "group-name": "Nombre de grupo",
      "session-progress": "Progreso de una sesión",
      "session-chat": "Pregunta en el chat",
      "analyze-progress": "Análisis de progreso",
      "session-guide": "Preparar sesión",
      "training-order": "Orden recomendado",
      "pet-questionnaire": "Cuestionario inicial",
    },
  },
  en: {
    title: "Bones",
    balanceLabel: "Your balance",
    unlimited: "Unlimited",
    explanation:
      "Bones are used for AI features. If you run out, PAWS keeps working with its basic version (except the session chat).",
    buyButton: "Buy bones",
    soon: "Coming soon",
    pricesTitle: "What each feature costs",
    historyTitle: "Activity",
    historyButton: "View activity",
    historyHint: "Newest first",
    loadMore: "Load more",
    loadingMore: "Loading...",
    loadMoreError: "Couldn't load more activity. Please try again.",
    close: "Close",
    empty: "No activity yet.",
    included: "Included",
    loading: "Loading...",
    error: "Couldn't load your balance. Please try again later.",
    kinds: {
      welcome: "Welcome gift",
      purchase: "Bones purchase",
      subscription: "PAWS PRO bones",
      expire: "Expired bones",
      refund: "Refund",
      adjustment: "Adjustment",
    },
    features: {
      "group-name": "Group name",
      "session-progress": "Session progress",
      "session-chat": "Chat question",
      "analyze-progress": "Progress analysis",
      "session-guide": "Session prep",
      "training-order": "Recommended order",
      "pet-questionnaire": "Initial questionnaire",
    },
  },
};

function isAiFeature(value: string | null): value is AiFeature {
  return value !== null && value in HUESITO_COSTS;
}

export default function HuesitoHistory() {
  const locale = useLocale();
  const language: Language = locale === "en" ? "en" : "es";
  const text = TEXTS[language];

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<HuesitoWallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrolledRef = useRef(false);

  const hasMore = transactions.length < totalCount;

  // Carga el saldo y la primera página de movimientos
  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFailed(true);
        return;
      }

      setUserId(user.id);

      const [walletResult, historyResult] = await Promise.all([
        supabase
          .from("huesito_wallets")
          .select("purchased_balance, subscription_balance, subscription_expires_at, unlimited")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("huesito_transactions")
          .select("id, amount, kind, feature, created_at", { count: "exact" })
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(0, PAGE_SIZE - 1),
      ]);

      if (walletResult.error || !walletResult.data) {
        setFailed(true);
        return;
      }

      const firstPage = historyResult.data ?? [];

      setWallet(toHuesitoWallet(walletResult.data));
      setTransactions(firstPage);
      setTotalCount(historyResult.count ?? firstPage.length);
      setLoadMoreFailed(false);
      setFailed(false);
    } catch (err) {
      console.error("[HuesitoHistory] Error cargando huesitos:", err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga los siguientes movimientos ("Cargar más")
  async function handleLoadMore() {
    if (!userId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const supabase = createClient();
      const from = transactions.length;

      const { data, error } = await supabase
        .from("huesito_transactions")
        .select("id, amount, kind, feature, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("[HuesitoHistory] Error cargando más:", error.message);
        setLoadMoreFailed(true);
        return;
      }

      const nextPage = data ?? [];

      // Evita duplicados si entre medias se añadió algún movimiento nuevo
      setTransactions((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextPage.filter((item) => !seen.has(item.id))];
      });

      // Si llega una página incompleta, ya no hay más
      if (nextPage.length < PAGE_SIZE) {
        setTotalCount(from + nextPage.length);
      }
    } catch (err) {
      console.error("[HuesitoHistory] Error inesperado cargando más:", err);
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadData();

    function handleChange() {
      void loadData();
    }

    window.addEventListener(HUESITOS_CHANGED_EVENT, handleChange);

    return () => {
      window.removeEventListener(HUESITOS_CHANGED_EVENT, handleChange);
    };
  }, [loadData]);

  // Si se llega desde la pastilla del saldo (#huesitos), bajar hasta aquí.
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    if (window.location.hash !== "#huesitos") return;

    scrolledRef.current = true;
    requestAnimationFrame(() => {
      document
        .getElementById("huesitos")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading]);

  // Cerrar la ventana de movimientos con la tecla Escape
  useEffect(() => {
    if (!historyOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setHistoryOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [historyOpen]);

  const dateFormatter = new Intl.DateTimeFormat(
    language === "en" ? "en-GB" : "es-ES",
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  const priceList = (Object.keys(HUESITO_COSTS) as AiFeature[]).sort(
    (a, b) => HUESITO_COSTS[a] - HUESITO_COSTS[b]
  );

  function describe(transaction: Transaction): string {
    if (transaction.kind === "spend" && isAiFeature(transaction.feature)) {
      return text.features[transaction.feature];
    }
    return text.kinds[transaction.kind] ?? transaction.kind;
  }

  return (
    <section
      id="huesitos"
      data-tour="settings-huesitos"
      className="mb-6 scroll-mt-24 rounded-2xl bg-white p-6 shadow-sm md:p-8"
    >
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <BoneIcon className="h-5 w-9 text-[#1e3a5f]" />
        {text.title}
      </h2>

      {loading ? (
        <p className="text-sm text-slate-500">{text.loading}</p>
      ) : failed || !wallet ? (
        <div className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          {text.error}
        </div>
      ) : (
        <>
          {/* Saldo */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-[#1e3a5f]/10 bg-slate-50 px-5 py-4">
            <span className="text-sm font-semibold text-slate-500">
              {text.balanceLabel}
            </span>
            <span className="flex items-center gap-2 text-3xl font-extrabold text-[#1e3a5f]">
              <BoneIcon className="h-5 w-9" />
              {wallet.unlimited ? text.unlimited : wallet.balance}
            </span>
          </div>

          <p className="mb-4 text-sm text-slate-500">{text.explanation}</p>

          {/* Comprar (llegará con las apps) */}
          <button
            type="button"
            disabled
            className="mb-6 w-full cursor-not-allowed rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-400"
          >
            {text.buyButton} · {text.soon}
          </button>

          {/* Precios */}
          <h3 className="mb-3 font-bold text-slate-800">{text.pricesTitle}</h3>
          <ul className="mb-6 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {priceList.map((feature) => (
              <li
                key={feature}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-slate-600">{text.features[feature]}</span>
                <span className="flex items-center gap-1.5 font-bold text-[#1e3a5f]">
                  {HUESITO_COSTS[feature]}
                  <BoneIcon className="h-3 w-6" />
                </span>
              </li>
            ))}
          </ul>

          {/* Botón de movimientos */}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span>{text.historyButton}</span>
            <span className="flex items-center gap-2 text-sm text-slate-400">
              {totalCount}
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </button>
        </>
      )}

      {/* VENTANA DE MOVIMIENTOS */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={text.historyTitle}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {text.historyTitle}
                </h3>
                <p className="text-xs text-slate-400">{text.historyHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={text.close}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Lista (se desplaza dentro de la ventana) */}
            <div className="overflow-y-auto overscroll-contain px-6 py-2">
              {transactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {text.empty}
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {transactions.map((transaction) => (
                      <li
                        key={transaction.id}
                        className="flex items-center justify-between gap-3 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700">
                            {describe(transaction)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {dateFormatter.format(new Date(transaction.created_at))}
                          </p>
                        </div>
                        {transaction.amount === 0 ? (
                          <span className="shrink-0 text-xs font-semibold text-slate-400">
                            {text.included}
                          </span>
                        ) : (
                          <span
                            className={`flex shrink-0 items-center gap-1.5 font-bold ${
                              transaction.amount > 0
                                ? "text-green-600"
                                : "text-slate-700"
                            }`}
                          >
                            {transaction.amount > 0
                              ? `+${transaction.amount}`
                              : `−${Math.abs(transaction.amount)}`}
                            <BoneIcon className="h-3 w-6" />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Cargar más */}
                  {hasMore && (
                    <div className="py-4">
                      <button
                        type="button"
                        onClick={() => void handleLoadMore()}
                        disabled={loadingMore}
                        className="w-full rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        {loadingMore ? text.loadingMore : text.loadMore}
                      </button>
                      {loadMoreFailed && (
                        <p className="mt-2 text-center text-xs font-semibold text-amber-700">
                          {text.loadMoreError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}