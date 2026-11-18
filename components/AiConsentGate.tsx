"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AI_CONSENT_DECLINED_HEADER,
  AI_CONSENT_REQUIRED,
  AI_CONSENT_ROUTES,
} from "@/lib/ai-consent-shared";

// Si el usuario dice "No, gracias", durante este tiempo no se le vuelve a
// preguntar (por ejemplo, el orden recomendado que se calcula justo después
// del cuestionario).
const DECLINE_MEMORY_MS = 60_000;

type Decision = "accepted" | "declined";

const TEXTS = {
  es: {
    title: "Antes de usar la inteligencia artificial",
    p1: "Para darte esta respuesta, PAWS envía a Anthropic (la empresa que crea la IA Claude) solo los datos necesarios: por ejemplo, la raza, edad y objetivos de tu perro, sus habilidades y progreso, sus entrenamientos y lo que escribes en el chat.",
    p2: "Nunca se envían tu correo, tu contraseña ni tus datos de pago. Anthropic no usa estos datos para entrenar su IA.",
    p3: "Si no aceptas, puedes seguir usando PAWS: las funciones de IA quedarán desactivadas y algunas usarán una versión sencilla sin IA. Puedes cambiarlo cuando quieras en Ajustes.",
    privacy: "Más información en la Política de privacidad",
    accept: "Aceptar y continuar",
    decline: "No, gracias",
    saving: "Guardando…",
    error: "No se pudo guardar tu respuesta. Inténtalo de nuevo.",
  },
  en: {
    title: "Before using artificial intelligence",
    p1: "To give you this answer, PAWS sends Anthropic (the company behind the Claude AI) only the data it needs: for example, your dog's breed, age and goals, its skills and progress, its trainings and what you type in the chat.",
    p2: "Your email, password and payment details are never sent. Anthropic does not use this data to train its AI.",
    p3: "If you don't accept, you can keep using PAWS: AI features will be turned off and some will use a simple version without AI. You can change this at any time in Settings.",
    privacy: "More information in the Privacy policy",
    accept: "Accept and continue",
    decline: "No, thanks",
    saving: "Saving…",
    error: "Your answer could not be saved. Please try again.",
  },
} as const;

function getPathname(input: RequestInfo | URL): string | null {
  try {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function isConsentRoute(pathname: string | null): boolean {
  return pathname !== null && (AI_CONSENT_ROUTES as readonly string[]).includes(pathname);
}

async function isConsentRequired(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;

  try {
    const data = await response.clone().json();
    return data?.error === AI_CONSENT_REQUIRED;
  } catch {
    return false;
  }
}

// Repite la petición avisando de que el usuario ha rechazado la IA.
function withDeclinedHeader(
  input: RequestInfo | URL,
  init?: RequestInit
): [RequestInfo | URL, RequestInit | undefined] {
  if (input instanceof Request) {
    const headers = new Headers(init?.headers ?? input.headers);
    headers.set(AI_CONSENT_DECLINED_HEADER, "1");
    return [new Request(input, { ...init, headers }), undefined];
  }

  const headers = new Headers(init?.headers);
  headers.set(AI_CONSENT_DECLINED_HEADER, "1");
  return [input, { ...init, headers }];
}

/**
 * Vigila las peticiones a las rutas de IA. Si una responde que falta el
 * permiso, muestra la ventana y, según la respuesta del usuario, repite la
 * petición (con permiso) o la repite avisando del rechazo (versión sin IA).
 * Así ningún botón de IA necesita cambios.
 */
export default function AiConsentGate() {
  const locale = useLocale();
  const t = locale === "en" ? TEXTS.en : TEXTS.es;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const resolverRef = useRef<((decision: Decision) => void) | null>(null);
  const pendingRef = useRef<Promise<Decision> | null>(null);
  const declinedAtRef = useRef(0);

  // Si varias peticiones piden permiso a la vez, se muestra una sola ventana.
  const askForConsent = useCallback((): Promise<Decision> => {
    if (pendingRef.current) return pendingRef.current;

    const promise = new Promise<Decision>((resolve) => {
      resolverRef.current = resolve;
      setError(false);
      setSaving(false);
      setOpen(true);
    });

    pendingRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;

    const patchedFetch: typeof window.fetch = async (input, init) => {
      if (!isConsentRoute(getPathname(input))) {
        return originalFetch(input, init);
      }

      // Copia de la petición por si hay que repetirla
      const retryInput = input instanceof Request ? input.clone() : input;

      const response = await originalFetch(input, init);

      if (!(await isConsentRequired(response))) {
        return response;
      }

      const recentlyDeclined = Date.now() - declinedAtRef.current < DECLINE_MEMORY_MS;
      const decision: Decision = recentlyDeclined ? "declined" : await askForConsent();

      if (decision === "accepted") {
        return originalFetch(retryInput, init);
      }

      const [declinedInput, declinedInit] = withDeclinedHeader(retryInput, init);
      return originalFetch(declinedInput, declinedInit);
    };

    window.fetch = patchedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [askForConsent]);

  function finish(decision: Decision) {
    setOpen(false);
    setSaving(false);

    if (decision === "declined") {
      declinedAtRef.current = Date.now();
    }

    resolverRef.current?.(decision);
    resolverRef.current = null;
    pendingRef.current = null;
  }

  async function handleAccept() {
    setSaving(true);
    setError(false);

    try {
      const res = await fetch("/api/ai-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });

      if (!res.ok) {
        throw new Error("save_failed");
      }

      finish("accepted");
    } catch {
      setSaving(false);
      setError(true);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="ai-consent-title" className="text-xl font-extrabold text-[#1e3a5f]">
          🤖 {t.title}
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">{t.p1}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.p2}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.p3}</p>

        <Link
          href="/legal/privacidad"
          target="_blank"
          className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
        >
          {t.privacy}
        </Link>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{t.error}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleAccept}
            disabled={saving}
            className="rounded-xl bg-[#1e3a5f] px-4 py-3 text-sm font-bold text-white hover:bg-[#16304f] disabled:opacity-60"
          >
            {saving ? t.saving : t.accept}
          </button>
          <button
            type="button"
            onClick={() => finish("declined")}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t.decline}
          </button>
        </div>
      </div>
    </div>
  );
}