"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import Pawsi from "@/components/Pawsi";
import {
  buildHistoryHref,
  type HistoryQuery,
  type HistoryStatus,
} from "@/lib/history-filters";

type HistoryTraining = {
  id: number;
  title: string | null;
  date: string | null;
  time: string | null;
  duration: number | null;
  notes: string | null;
  status: string | null;
  skill_id: number | null;
};

type SkillOption = {
  id: number;
  name: string;
};

type Props = {
  petId: number;
  trainings: HistoryTraining[];
  skillOptions: SkillOption[];
  initialQuery: HistoryQuery;
};

const STATUSES: HistoryStatus[] = ["all", "completed", "pending"];

// Historial de un perro con sus filtros.
// Los entrenamientos se cargan una sola vez y los filtros se aplican al momento
// en el navegador (sin volver a cargar la página).
export default function PetHistoryList({
  petId,
  trainings,
  skillOptions,
  initialQuery,
}: Props) {
  const t = useTranslations("PetHistory");
  const tProfile = useTranslations("PetProfile");

  const [query, setQuery] = useState<HistoryQuery>(initialQuery);

  const skillNames = useMemo(
    () => new Map(skillOptions.map((option) => [option.id, option.name])),
    [skillOptions]
  );

  // Cambia los filtros y actualiza la dirección SIN recargar la página
  // (así al recargar o volver atrás se mantienen los filtros)
  function apply(changes: Partial<HistoryQuery>) {
    const next = { ...query, ...changes };
    setQuery(next);

    try {
      window.history.replaceState(null, "", buildHistoryHref(petId, next));
    } catch {
      // Si el navegador no deja cambiar la dirección, el filtro funciona igual
    }
  }

  const selectedSkillId = query.skill ? Number(query.skill) : null;

  const filtered = useMemo(
    () =>
      trainings.filter((training) => {
        if (query.status === "completed" && training.status !== "completed") {
          return false;
        }
        if (query.status === "pending" && training.status === "completed") {
          return false;
        }
        if (selectedSkillId !== null && training.skill_id !== selectedSkillId) {
          return false;
        }
        if (query.from && (!training.date || training.date < query.from)) {
          return false;
        }
        if (query.to && (!training.date || training.date > query.to)) {
          return false;
        }
        return true;
      }),
    [trainings, query, selectedSkillId]
  );

  const hasExtraFilters =
    query.skill !== "" || query.from !== "" || query.to !== "";

  const statusLabel: Record<HistoryStatus, string> = {
    all: t("filterAll"),
    completed: t("filterCompleted"),
    pending: t("filterPending"),
  };

  const emptyText = hasExtraFilters
    ? t("emptyFiltered")
    : query.status === "completed"
    ? t("emptyCompleted")
    : query.status === "pending"
    ? t("emptyPending")
    : t("emptyAll");

  return (
    <>
      {/* ESTADO: TODOS / COMPLETADOS / PENDIENTES */}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => {
            const isActive = status === query.status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => apply({ status })}
                aria-pressed={isActive}
                className={
                  isActive
                    ? "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                    : "rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                }
              >
                {statusLabel[status]}
              </button>
            );
          })}
        </div>

        <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
          {t("count", { count: filtered.length })}
        </span>
      </div>

      {/* HABILIDAD Y FECHAS */}

      <div className="mb-6 rounded-2xl bg-white p-5 shadow">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">
              {t("skillLabel")}
            </span>
            <select
              value={query.skill}
              onChange={(e) => apply({ skill: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">{t("allSkills")}</option>
              {skillOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">
              {t("dateFrom")}
            </span>
            <input
              type="date"
              value={query.from}
              max={query.to || undefined}
              onChange={(e) => apply({ from: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">
              {t("dateTo")}
            </span>
            <input
              type="date"
              value={query.to}
              min={query.from || undefined}
              onChange={(e) => apply({ to: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        {hasExtraFilters && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => apply({ skill: "", from: "", to: "" })}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              ✕ {t("clearFilters")}
            </button>
          </div>
        )}
      </div>

      {/* LISTA DE ENTRENAMIENTOS */}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
          <Pawsi pose="espera" size={110} />
          <p className="mt-4 text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((training) => {
            const isCompleted = training.status === "completed";
            const skillName =
              training.skill_id !== null
                ? skillNames.get(training.skill_id) ?? null
                : null;

            return (
              <div key={training.id} className="rounded-2xl bg-white p-5 shadow">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">
                      {training.title ?? tProfile("trainingDefaultTitle")}
                    </h2>

                    {skillName && (
                      <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        🎯 {skillName}
                      </span>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-600">
                      <span>📅 {training.date ?? tProfile("noDate")}</span>
                      <span>
                        🕒{" "}
                        {training.time ? training.time.substring(0, 5) : "--:--"}
                      </span>
                      <span>⏱ {training.duration ?? "-"} min</span>
                    </div>

                    <p className="mt-2">
                      {tProfile("statusLabel")}{" "}
                      <span
                        className={
                          isCompleted
                            ? "font-bold text-green-600"
                            : "font-bold text-orange-600"
                        }
                      >
                        {isCompleted
                          ? tProfile("completedStatus")
                          : tProfile("pendingStatus")}
                      </span>
                    </p>

                    {training.notes && (
                      <p className="mt-2 text-slate-600">{training.notes}</p>
                    )}
                  </div>

                  <Link
                    href={`/trainings/${training.id}/edit`}
                    className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600"
                  >
                    {tProfile("editLink")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}