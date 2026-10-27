"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";
import BoneIcon from "@/components/BoneIcon";
import { HUESITO_COSTS } from "@/lib/huesitos-shared";
import { notifyHuesitosChanged } from "@/lib/huesitos-client";
import {
  CHAT_MAX_LENGTH,
  parseStoredGuide,
  type ChatMessage,
  type SessionGuideData,
} from "@/lib/session-guide";

const supabase = createClient();

const GUIDE_COST = HUESITO_COSTS["session-guide"];
const CHAT_COST = HUESITO_COSTS["session-chat"];

// Textos de los huesitos (español / inglés)
const HUESITO_TEXT = {
  es: {
    guideNoHuesitos:
      "Te has quedado sin huesitos: esta es la guía básica, preparada sin IA.",
    chatNoHuesitos:
      "Te has quedado sin huesitos: el chat necesita 1 huesito por pregunta. Tu pregunta sigue escrita abajo.",
    getMore: "Ver mis huesitos",
  },
  en: {
    guideNoHuesitos:
      "You've run out of bones: this is the basic guide, prepared without AI.",
    chatNoHuesitos:
      "You've run out of bones: the chat needs 1 bone per question. Your question is still written below.",
    getMore: "See my bones",
  },
};

type Props = {
  trainingId: number;
  // Hay una habilidad guardada en el entrenamiento
  hasSkill: boolean;
  // La habilidad del formulario es distinta de la guardada
  skillChanged: boolean;
};

type GuideResponse = {
  guide?: unknown;
  locale?: unknown;
  usedFallback?: unknown;
  noHuesitos?: unknown;
  huesitos?: unknown;
  saved?: unknown;
};

type ChatResponse = {
  messages?: unknown;
  huesitos?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Cuántos huesitos se han gastado según la respuesta del servidor
function readSpent(huesitos: unknown): number {
  if (!isRecord(huesitos)) return 0;
  return typeof huesitos.spent === "number" ? huesitos.spent : 0;
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: ChatMessage[] = [];

  for (const item of value) {
    if (
      isRecord(item) &&
      typeof item.id === "number" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    ) {
      result.push({
        id: item.id,
        role: item.role,
        content: item.content,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
      });
    }
  }

  return result;
}

// Coste pequeño dentro de un botón: "· 2 🦴"
function ButtonCost({ cost, boneClassName }: { cost: number; boneClassName: string }) {
  return (
    <>
      <span aria-hidden="true">·</span>
      <span className="flex items-center gap-1">
        {cost}
        <BoneIcon className={`h-3 w-6 ${boneClassName}`} />
      </span>
    </>
  );
}

export default function SessionGuide({ trainingId, hasSkill, skillChanged }: Props) {
  const t = useTranslations("SessionGuide");
  const locale = useLocale();
  const currentLocale = locale === "en" ? "en" : "es";
  const huesitoText = HUESITO_TEXT[currentLocale];

  const [loadingData, setLoadingData] = useState(true);

  const [guide, setGuide] = useState<SessionGuideData | null>(null);
  const [guideLocale, setGuideLocale] = useState<string | null>(null);
  const [guideFallback, setGuideFallback] = useState(false);
  const [guideNoHuesitos, setGuideNoHuesitos] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideWarning, setGuideWarning] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatNoHuesitos, setChatNoHuesitos] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const canPrepare = hasSkill && !skillChanged;
  const guideInOtherLanguage =
    guide !== null && guideLocale !== null && guideLocale !== currentLocale;

  // --- Cargar la guía y el chat guardados ---
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: guideRow } = await supabase
        .from("training_guides")
        .select("data, locale, used_fallback")
        .eq("training_id", trainingId)
        .maybeSingle();

      const { data: messageRows } = await supabase
        .from("training_chat_messages")
        .select("id, role, content, created_at")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: true });

      if (cancelled) {
        return;
      }

      if (guideRow) {
        setGuide(parseStoredGuide(guideRow.data));
        setGuideLocale(guideRow.locale);
        setGuideFallback(guideRow.used_fallback);
      }

      setMessages(
        parseMessages(
          (messageRows ?? []).map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
          }))
        )
      );

      setLoadingData(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  // Bajar al último mensaje cuando llega uno nuevo (o cuando Pawsi empieza a "escribir")
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  async function handlePrepare() {
    setPreparing(true);
    setGuideError(null);
    setGuideWarning(null);
    setGuideNoHuesitos(false);

    try {
      const res = await fetch("/api/session-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingId, locale: currentLocale }),
      });

      if (!res.ok) {
        throw new Error("bad_response");
      }

      const data: GuideResponse = await res.json();
      const parsed = parseStoredGuide(data.guide);

      if (!parsed) {
        throw new Error("empty");
      }

      setGuide(parsed);
      setGuideLocale(typeof data.locale === "string" ? data.locale : currentLocale);
      setGuideFallback(data.usedFallback === true);
      setGuideNoHuesitos(data.noHuesitos === true);

      // Se han gastado huesitos: la pastilla del saldo se actualiza sola
      if (readSpent(data.huesitos) > 0) {
        notifyHuesitosChanged();
      }

      if (data.saved === false) {
        setGuideWarning(t("errorNotSaved"));
      }
    } catch {
      setGuideError(t("errorPrepare"));
    } finally {
      setPreparing(false);
    }
  }

  async function handleSend() {
    const question = input.trim();

    if (!question || sending) {
      return;
    }

    if (question.length > CHAT_MAX_LENGTH) {
      setChatError(t("tooLong", { max: CHAT_MAX_LENGTH }));
      return;
    }

    setSending(true);
    setChatError(null);
    setChatNoHuesitos(false);

    try {
      const res = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingId, message: question, locale: currentLocale }),
      });

      // Sin huesitos: aviso claro; la pregunta se queda en la caja
      if (res.status === 402) {
        setChatNoHuesitos(true);
        return;
      }

      if (!res.ok) {
        throw new Error("bad_response");
      }

      const data: ChatResponse = await res.json();
      const newMessages = parseMessages(data.messages);

      if (newMessages.length === 0) {
        throw new Error("empty");
      }

      setMessages((prev) => [...prev, ...newMessages]);
      setInput("");

      // Se han gastado huesitos: la pastilla del saldo se actualiza sola
      if (readSpent(data.huesitos) > 0) {
        notifyHuesitosChanged();
      }
    } catch {
      // El texto se queda en la caja para poder reintentar
      setChatError(t("errorChat"));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Mayúsculas + Enter hace salto de línea
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  if (loadingData) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4">
        <PawsiLoading text={t("loading")} variant="card" />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* GUÍA DE LA SESIÓN */}
      <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
              {t("sectionLabel")}
            </p>
            <p className="mt-1 text-sky-900">{t("description")}</p>
          </div>

          <button
            type="button"
            onClick={handlePrepare}
            disabled={!canPrepare || preparing}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preparing ? (
              t("preparing")
            ) : (
              <>
                <span>
                  {guideInOtherLanguage
                    ? t("prepareInLanguage")
                    : guide
                    ? t("regenerate")
                    : t("prepare")}
                </span>
                <ButtonCost cost={GUIDE_COST} boneClassName="text-sky-700" />
              </>
            )}
          </button>
        </div>

        {!hasSkill && (
          <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
            {t("needSkill")}
          </p>
        )}

        {hasSkill && skillChanged && (
          <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
            {t("saveSkillFirst")}
          </p>
        )}

        {guideError && (
          <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-800">
            {guideError}
          </p>
        )}

        {guideWarning && (
          <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
            {guideWarning}
          </p>
        )}

        {guideNoHuesitos && !preparing && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
            <span>{huesitoText.guideNoHuesitos}</span>
            <Link
              href="/settings#huesitos"
              className="underline underline-offset-2 hover:text-amber-700"
            >
              {huesitoText.getMore}
            </Link>
          </div>
        )}

        {/* Mientras la IA prepara la sesión: Pawsi pensando */}
        {preparing && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl bg-white p-6 text-center shadow-sm">
            <Pawsi pose="piensa" size={130} float />
            <p className="font-semibold text-sky-700">{t("preparing")}</p>
          </div>
        )}

        {!preparing && guideInOtherLanguage && (
          <p className="mt-4 rounded-xl bg-white px-4 py-3 text-slate-700 shadow-sm">
            {t("otherLanguage")}
          </p>
        )}

        {!preparing && guide && !guideInOtherLanguage && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
                {t("objectiveLabel")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-800">{guide.objective}</p>
            </div>

            {guide.warmup && (
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
                  {t("warmupLabel")}
                </p>
                <p className="mt-1 text-slate-700">{guide.warmup}</p>
              </div>
            )}

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
                {t("stepsLabel")}
              </p>
              <ol className="mt-3 space-y-3">
                {guide.steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {step.title}
                        {step.reps && (
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-sm font-semibold text-sky-800">
                            {step.reps}
                          </span>
                        )}
                      </p>
                      {step.detail && (
                        <p className="mt-1 text-slate-600">{step.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {(guide.levelUp || guide.levelDown) && (
              <div className="grid gap-4 md:grid-cols-2">
                {guide.levelUp && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
                      {t("levelUpLabel")}
                    </p>
                    <p className="mt-1 text-slate-700">{guide.levelUp}</p>
                  </div>
                )}
                {guide.levelDown && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
                      {t("levelDownLabel")}
                    </p>
                    <p className="mt-1 text-slate-700">{guide.levelDown}</p>
                  </div>
                )}
              </div>
            )}

            {guide.finish && (
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
                  {t("finishLabel")}
                </p>
                <p className="mt-1 text-slate-700">{guide.finish}</p>
              </div>
            )}

            {guideFallback && !guideNoHuesitos && (
              <p className="text-xs font-medium text-slate-500">{t("fallbackNote")}</p>
            )}
          </div>
        )}
      </div>

      {/* CHAT DE DUDAS */}
      <div className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-700">
          {t("chatTitle")}
        </p>

        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
          {messages.length === 0 && !sending ? (
            <p className="text-violet-900">{t("chatEmpty")}</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-semibold ${
                      message.role === "user" ? "text-violet-100" : "text-violet-700"
                    }`}
                  >
                    {message.role === "user" ? t("you") : t("assistant")}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}

          {/* Mientras la IA responde: Pawsi pensando en un bocadillo */}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <Pawsi pose="piensa" size={52} float />
                <p className="font-semibold text-violet-700">{t("sending")}</p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {chatError && (
          <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-800">
            {chatError}
          </p>
        )}

        {chatNoHuesitos && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
            <span>{huesitoText.chatNoHuesitos}</span>
            <Link
              href="/settings#huesitos"
              className="underline underline-offset-2 hover:text-amber-700"
            >
              {huesitoText.getMore}
            </Link>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={CHAT_MAX_LENGTH}
            disabled={sending || !hasSkill}
            placeholder={t("chatPlaceholder")}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !input.trim() || !hasSkill}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              t("sending")
            ) : (
              <>
                <span>{t("send")}</span>
                <ButtonCost cost={CHAT_COST} boneClassName="text-violet-700" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}