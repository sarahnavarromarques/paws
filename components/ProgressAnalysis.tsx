"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import Pawsi from "@/components/Pawsi";
import BoneIcon from "@/components/BoneIcon";
import { createClient } from "@/lib/supabase/client";
import { HUESITO_COSTS } from "@/lib/huesitos-shared";
import { notifyHuesitosChanged } from "@/lib/huesitos-client";

const supabase = createClient();

const COST = HUESITO_COSTS["analyze-progress"];

type Skill = {
  name: string;
  category: string | null;
  progress: number;
  sessionCount: number;
  lastTrainedDays: number | null;
  isGoal: boolean;
};

type Training = {
  title: string | null;
  date: string | null;
  duration: number | null;
  notes: string | null;
};

type Pet = {
  name: string;
  breed: string | null;
  objective: string | null;
  level: string | null;
};

type Analysis = {
  resumen: string;
  patrones: string;
  recomendacion: string;
};

type Props = {
  pet: Pet;
  skills: Skill[];
  trainings: Training[];
  // Si es true y el perro no tiene análisis guardado, analiza al abrir
  autoAnalyze?: boolean;
};

type TFunction = ReturnType<typeof useTranslations>;

// Textos nuevos de los huesitos (español / inglés)
const HUESITO_TEXT = {
  es: {
    savedOn: "Analizado el",
    noHuesitos: "Te has quedado sin huesitos: este es el análisis básico.",
    getMore: "Ver mis huesitos",
  },
  en: {
    savedOn: "Analyzed on",
    noHuesitos: "You've run out of bones: this is the basic analysis.",
    getMore: "See my bones",
  },
};

// Resumen calculado en local. Se usa si la IA falla, no hay clave
// o no quedan huesitos, para que la tarjeta nunca se quede sin respuesta.
function buildLocalAnalysis(
  pet: Pet,
  skills: Skill[],
  trainings: Training[],
  t: TFunction
): Analysis {
  const totalSessions = trainings.length;
  const skillCount = skills.length;

  const avg =
    skillCount === 0
      ? 0
      : Math.round(
          skills.reduce((sum, s) => sum + s.progress, 0) / skillCount
        );

  const goal = skills.find((s) => s.isGoal) ?? null;
  const sorted = [...skills].sort((a, b) => a.progress - b.progress);
  const lowest = sorted[0] ?? null;
  const highest = sorted[sorted.length - 1] ?? null;

  const resumen =
    totalSessions === 0
      ? t("localNoSessions", { name: pet.name })
      : t("localSummary", {
          name: pet.name,
          skillCount,
          avg,
          sessionCount: totalSessions,
        });

  let patrones = "";
  if (highest && lowest && skillCount > 1) {
    patrones = t("localPatternsBoth", {
      highest: highest.name,
      highestProgress: highest.progress,
      lowest: lowest.name,
      lowestProgress: lowest.progress,
    });
  } else if (highest) {
    patrones = t("localPatternsSingle", {
      highest: highest.name,
      highestProgress: highest.progress,
    });
  }

  let recomendacion = "";
  if (goal) {
    recomendacion = t("localRecommendationGoal", {
      goal: goal.name,
      goalProgress: goal.progress,
    });
  } else if (lowest) {
    recomendacion = t("localRecommendationLowest", { lowest: lowest.name });
  } else {
    recomendacion = t("localRecommendationNone");
  }

  return { resumen, patrones, recomendacion };
}

// Comprueba que lo guardado en la base de datos tiene la forma correcta
function parseStoredAnalysis(value: unknown): Analysis | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.resumen !== "string" || !record.resumen) {
    return null;
  }

  return {
    resumen: record.resumen,
    patrones: typeof record.patrones === "string" ? record.patrones : "",
    recomendacion:
      typeof record.recomendacion === "string" ? record.recomendacion : "",
  };
}

// Lee cuántos huesitos se han gastado según la respuesta del servidor
function readSpent(data: unknown): number {
  if (typeof data !== "object" || data === null) return 0;
  const huesitos = (data as { huesitos?: unknown }).huesitos;
  if (typeof huesitos !== "object" || huesitos === null) return 0;
  const spent = (huesitos as { spent?: unknown }).spent;
  return typeof spent === "number" ? spent : 0;
}

export default function ProgressAnalysis({
  pet,
  skills,
  trainings,
  autoAnalyze = false,
}: Props) {
  const t = useTranslations("ProgressAnalysis");
  const locale = useLocale();
  const huesitoText = HUESITO_TEXT[locale === "en" ? "en" : "es"];

  // El perro sale de la dirección de la página: /pets/ID/progress
  const params = useParams<{ id?: string }>();
  const petIdNumber = Number(params?.id);
  const petId = Number.isInteger(petIdNumber) ? petIdNumber : null;

  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(petId !== null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [noHuesitos, setNoHuesitos] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Evita cargar dos veces al abrir (React puede montar el componente dos veces en desarrollo)
  const startedRef = useRef(false);

  const hasData = skills.length > 0 || trainings.length > 0;

  // Guarda el análisis de la IA para mostrarlo gratis la próxima vez
  async function saveAnalysis(result: Analysis): Promise<void> {
    if (petId === null) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const now = new Date().toISOString();

      const { error } = await supabase.from("progress_analyses").upsert(
        {
          pet_id: petId,
          user_id: user.id,
          locale,
          data: result,
          updated_at: now,
        },
        { onConflict: "pet_id" }
      );

      if (error) {
        console.error("Error guardando el análisis:", error.message);
        return;
      }

      setSavedAt(now);
    } catch (err) {
      console.error("Error inesperado guardando el análisis:", err);
    }
  }

  async function handleAnalyze() {
    setLoading(true);
    setUsedFallback(false);
    setNoHuesitos(false);

    if (!hasData) {
      setAnalysis(buildLocalAnalysis(pet, skills, trainings, t));
      setUsedFallback(true);
      setSavedAt(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/analyze-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, skills, trainings, locale }),
      });

      // Sin huesitos: análisis básico con aviso, sin guardarlo
      if (res.status === 402) {
        setAnalysis(buildLocalAnalysis(pet, skills, trainings, t));
        setUsedFallback(true);
        setNoHuesitos(true);
        setSavedAt(null);
        return;
      }

      if (!res.ok) {
        throw new Error("bad_response");
      }

      const data: unknown = await res.json();
      const result = parseStoredAnalysis(
        typeof data === "object" && data !== null
          ? (data as { analysis?: unknown }).analysis
          : null
      );

      if (!result) {
        throw new Error("empty");
      }

      setAnalysis(result);

      // Se han gastado huesitos: la pastilla del saldo se actualiza sola
      if (readSpent(data) > 0) {
        notifyHuesitosChanged();
      }

      await saveAnalysis(result);
    } catch {
      // Si algo falla, usamos el resumen local. La app nunca se rompe.
      setAnalysis(buildLocalAnalysis(pet, skills, trainings, t));
      setUsedFallback(true);
      setSavedAt(null);
    } finally {
      setLoading(false);
    }
  }

  // Al abrir: mostrar el análisis guardado; si no hay, analizar (si autoAnalyze)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function start() {
      if (petId !== null) {
        try {
          const { data } = await supabase
            .from("progress_analyses")
            .select("data, updated_at")
            .eq("pet_id", petId)
            .maybeSingle();

          const stored = data ? parseStoredAnalysis(data.data) : null;

          if (stored && data) {
            setAnalysis(stored);
            setSavedAt(data.updated_at);
            setLoadingSaved(false);
            return;
          }
        } catch (err) {
          console.error("Error cargando el análisis guardado:", err);
        }

        setLoadingSaved(false);
      }

      if (autoAnalyze) {
        await handleAnalyze();
      }
    }

    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = loading || loadingSaved;
  const hasAiAnalysis = analysis !== null && !usedFallback;

  const savedDateText = savedAt
    ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(savedAt))
    : null;

  return (
    // data-tour: el tutorial ilumina esta tarjeta
    <div
      data-tour="analyze-progress"
      className="mb-8 rounded-2xl border-2 border-teal-300 bg-teal-50 p-8 shadow"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
            {t("sectionLabel")}
          </p>
          <p className="mt-2 text-teal-800">
            {t("description", { name: pet.name })}
          </p>
          {savedDateText && !loading && (
            <p className="mt-1 text-xs font-semibold text-teal-600">
              {huesitoText.savedOn} {savedDateText}
            </p>
          )}
        </div>

        <button
          onClick={() => void handleAnalyze()}
          disabled={busy}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            t("analyzing")
          ) : (
            <>
              <span>{hasAiAnalysis ? t("reAnalyze") : t("analyze")}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                {COST}
                <BoneIcon className="h-3 w-6 text-teal-700" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Mientras la IA analiza: Pawsi pensando */}
      {loading && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-white p-6 text-center shadow-sm">
          <Pawsi pose="piensa" size={130} float />
          <p className="font-semibold text-teal-700">{t("analyzing")}</p>
        </div>
      )}

      {!loading && analysis && (
        <div className="mt-6 space-y-5">
          {noHuesitos && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
              <span>{huesitoText.noHuesitos}</span>
              <Link
                href="/settings#huesitos"
                className="underline underline-offset-2 hover:text-amber-700"
              >
                {huesitoText.getMore}
              </Link>
            </div>
          )}

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
              {t("summaryLabel")}
            </p>
            <p className="mt-1 text-slate-700">{analysis.resumen}</p>
          </div>

          {analysis.patrones && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                {t("patternsLabel")}
              </p>
              <p className="mt-1 text-slate-700">{analysis.patrones}</p>
            </div>
          )}

          {analysis.recomendacion && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                {t("nextStepLabel")}
              </p>
              <p className="mt-1 text-slate-700">{analysis.recomendacion}</p>
            </div>
          )}

          {usedFallback && !noHuesitos && (
            <p className="text-xs font-medium text-slate-500">
              {t("fallbackNote")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}