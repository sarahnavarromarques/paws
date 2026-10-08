"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import {
  CHAT_MAX_LENGTH,
  parseStoredGuide,
  type ChatMessage,
  type SessionGuideData,
} from "@/lib/session-guide";

const supabase = createClient();

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
  saved?: unknown;
};

type ChatResponse = {
  messages?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export default function SessionGuide({ trainingId, hasSkill, skillChanged }: Props) {
  const t = useTranslations("SessionGuide");
  const locale = useLocale();
  const currentLocale = locale === "en" ? "en" : "es";

  const [loadingData, setLoadingData] = useState(true);

  const [guide, setGuide] = useState<SessionGuideData | null>(null);
  const [guideLocale, setGuideLocale] = useState<string | null>(null);
  const [guideFallback, setGuideFallback] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideWarning, setGuideWarning] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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

  // Bajar al último mensaje cuando llega uno nuevo
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function handlePrepare() {
    setPreparing(true);
    setGuideError(null);
    setGuideWarning(null);

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

    try {
      const res = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingId, message: question, locale: currentLocale }),
      });

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
      <div className="mt-8 rounded-2xl border-2 border-sky-300 bg-sky-50 p-6">
        <p className="text-slate-500">{t("loading")}</p>
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
            className="shrink-0 rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preparing
              ? t("preparing")
              : guideInOtherLanguage
              ? t("prepareInLanguage")
              : guide
              ? t("regenerate")
              : t("prepare")}
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

        {guideInOtherLanguage && (
          <p className="mt-4 rounded-xl bg-white px-4 py-3 text-slate-700 shadow-sm">
            {t("otherLanguage")}
          </p>
        )}

        {guide && !guideInOtherLanguage && (
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

            {guideFallback && (
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
          {messages.length === 0 ? (
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
          <div ref={chatEndRef} />
        </div>

        {chatError && (
          <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-800">
            {chatError}
          </p>
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
            className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? t("sending") : t("send")}
          </button>
        </div>
      </div>
    </div>
  );
}