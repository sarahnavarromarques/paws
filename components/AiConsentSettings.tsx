"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Feedback = { type: "success" | "error"; text: string } | null;

const TEXTS = {
  es: {
    title: "Inteligencia artificial",
    description:
      "Las funciones de IA (cuestionario, sesión guiada y su chat, progreso, análisis, orden recomendado y nombres de grupos) envían a Anthropic los datos necesarios de tu perro y sus entrenamientos. Nunca se envían tu correo, tu contraseña ni tus datos de pago.",
    toggleLabel: "Usar inteligencia artificial",
    on: "Activada",
    off: "Desactivada",
    since: (date: string) => `Permiso dado el ${date}.`,
    offHint: "Sin permiso, PAWS usa versiones sencillas sin IA cuando las hay.",
    enabled: "Inteligencia artificial activada.",
    disabled: "Inteligencia artificial desactivada. No se enviará nada a la IA.",
    error: "No se pudo guardar. Inténtalo de nuevo.",
    privacy: "Más información en la Política de privacidad",
  },
  en: {
    title: "Artificial intelligence",
    description:
      "AI features (questionnaire, guided session and its chat, progress, analysis, recommended order and group names) send Anthropic the data they need about your dog and its trainings. Your email, password and payment details are never sent.",
    toggleLabel: "Use artificial intelligence",
    on: "On",
    off: "Off",
    since: (date: string) => `Permission given on ${date}.`,
    offHint: "Without permission, PAWS uses simple versions without AI where available.",
    enabled: "Artificial intelligence turned on.",
    disabled: "Artificial intelligence turned off. Nothing will be sent to the AI.",
    error: "Couldn't save. Please try again.",
    privacy: "More information in the Privacy policy",
  },
} as const;

// Tarjeta de Ajustes para dar o retirar el permiso de usar la IA
export default function AiConsentSettings() {
  const locale = useLocale();
  const isEn = locale === "en";
  const t = isEn ? TEXTS.en : TEXTS.es;

  const [loading, setLoading] = useState(true);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("ai_consent_at")
        .eq("id", user.id)
        .maybeSingle();

      setConsentAt(data?.ai_consent_at ?? null);
      setLoading(false);
    }

    void load();
  }, []);

  const enabled = consentAt !== null;

  async function handleToggle() {
    if (saving) return;

    const next = !enabled;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/ai-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });

      if (!res.ok) {
        throw new Error("save_failed");
      }

      setConsentAt(next ? new Date().toISOString() : null);
      setFeedback({ type: "success", text: next ? t.enabled : t.disabled });
    } catch {
      setFeedback({ type: "error", text: t.error });
    } finally {
      setSaving(false);
    }
  }

  const sinceText = consentAt
    ? t.since(
        new Date(consentAt).toLocaleDateString(isEn ? "en-GB" : "es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      )
    : t.offHint;

  return (
    <section data-tour="settings-ai" className="mb-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
      <h2 className="mb-2 text-xl font-bold">🤖 {t.title}</h2>
      <p className="mb-4 text-sm text-slate-500">{t.description}</p>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
        <div>
          <p className="font-semibold text-slate-800">{t.toggleLabel}</p>
          <p className="mt-1 text-xs text-slate-500">
            {loading ? "..." : sinceText}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t.toggleLabel}
          onClick={() => void handleToggle()}
          disabled={loading || saving}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span className="sr-only">{enabled ? t.on : t.off}</span>
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <Link
        href="/legal/privacidad"
        className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
      >
        {t.privacy}
      </Link>

      {feedback && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            feedback.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </section>
  );
}