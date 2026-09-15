"use client";

import { useState } from "react";

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
};

// Resumen calculado en local. Se usa si la IA falla o no hay clave,
// para que la tarjeta nunca se quede sin respuesta.
function buildLocalAnalysis(
  pet: Pet,
  skills: Skill[],
  trainings: Training[]
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
      ? `${pet.name} todavía no tiene sesiones completadas. Registra algunas para poder analizar su progreso.`
      : `${pet.name} tiene ${skillCount} ${
          skillCount === 1 ? "habilidad" : "habilidades"
        } en seguimiento, con un progreso medio del ${avg}%. Se han completado ${totalSessions} ${
          totalSessions === 1 ? "sesión" : "sesiones"
        }.`;

  let patrones = "";
  if (highest && lowest && skillCount > 1) {
    patrones = `La habilidad más avanzada es "${highest.name}" (${highest.progress}%) y la que menos progreso tiene es "${lowest.name}" (${lowest.progress}%).`;
  } else if (highest) {
    patrones = `La habilidad en seguimiento es "${highest.name}" (${highest.progress}%).`;
  }

  let recomendacion = "";
  if (goal) {
    recomendacion = `Prioriza el objetivo actual, "${goal.name}" (${goal.progress}%).`;
  } else if (lowest) {
    recomendacion = `Refuerza "${lowest.name}", que es la habilidad con menos progreso.`;
  } else {
    recomendacion =
      "Añade habilidades y registra sesiones para recibir recomendaciones.";
  }

  return { resumen, patrones, recomendacion };
}

export default function ProgressAnalysis({ pet, skills, trainings }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const hasData = skills.length > 0 || trainings.length > 0;

  async function handleAnalyze() {
    setLoading(true);
    setUsedFallback(false);

    if (!hasData) {
      setAnalysis(buildLocalAnalysis(pet, skills, trainings));
      setUsedFallback(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/analyze-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, skills, trainings }),
      });

      if (!res.ok) {
        throw new Error("bad_response");
      }

      const data = await res.json();

      if (!data?.analysis?.resumen) {
        throw new Error("empty");
      }

      setAnalysis({
        resumen: data.analysis.resumen ?? "",
        patrones: data.analysis.patrones ?? "",
        recomendacion: data.analysis.recomendacion ?? "",
      });
    } catch {
      // Si algo falla, usamos el resumen local. La app nunca se rompe.
      setAnalysis(buildLocalAnalysis(pet, skills, trainings));
      setUsedFallback(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 rounded-2xl border-2 border-teal-300 bg-teal-50 p-8 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
            ✨ Análisis de progreso con IA
          </p>
          <p className="mt-1 text-2xl font-bold text-teal-900">
            {pet.name}
          </p>
          <p className="mt-1 text-teal-800">
            La IA lee el historial de {pet.name} y te da una lectura de su
            progreso y el siguiente paso.
          </p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="shrink-0 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Analizando..."
            : analysis
            ? "Volver a analizar"
            : "Analizar progreso"}
        </button>
      </div>

      {analysis && (
        <div className="mt-6 space-y-5">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
              Resumen
            </p>
            <p className="mt-1 text-slate-700">{analysis.resumen}</p>
          </div>

          {analysis.patrones && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                Patrones detectados
              </p>
              <p className="mt-1 text-slate-700">{analysis.patrones}</p>
            </div>
          )}

          {analysis.recomendacion && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                Siguiente paso
              </p>
              <p className="mt-1 text-slate-700">{analysis.recomendacion}</p>
            </div>
          )}

          {usedFallback && (
            <p className="text-xs font-medium text-slate-500">
              Resumen básico generado sin conexión con la IA.
            </p>
          )}
        </div>
      )}
    </div>
  );
}