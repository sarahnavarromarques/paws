"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import {
  isMastered,
  parseStoredOrder,
  resolveNextSkillId,
  type TrainingOrderData,
} from "@/lib/training-order";

export type TrainingOrderGroupView = {
  groupId: number;
  name: string;
  skills: {
    skillId: number;
    name: string;
    progress: number;
  }[];
};

export type TrainingOrderFallback = {
  title: string;
  body: string;
  cta: string;
  href: string;
};

type Props = {
  petId: number;
  petName: string;
  groups: TrainingOrderGroupView[];
  initialOrder: TrainingOrderData | null;
  initialUpdatedAt: string | null;
  initialUsedFallback: boolean;
  fallback: TrainingOrderFallback;
};

type DisplaySkill = {
  skillId: number;
  name: string;
  progress: number;
  reason: string;
};

type DisplayGroup = {
  groupId: number;
  name: string;
  reason: string;
  skills: DisplaySkill[];
};

type ApiResponse = {
  order?: unknown;
  updatedAt?: unknown;
  usedFallback?: unknown;
  saved?: unknown;
};

// Claves "grupo" y "grupo:habilidad" para saber si los grupos cambiaron desde el cálculo
function buildKeys(
  groups: { groupId: number; skillIds: number[] }[]
): Set<string> {
  const keys = new Set<string>();

  for (const group of groups) {
    keys.add(`g${group.groupId}`);
    for (const skillId of group.skillIds) {
      keys.add(`${group.groupId}:${skillId}`);
    }
  }

  return keys;
}

export default function TrainingOrder({
  petId,
  petName,
  groups,
  initialOrder,
  initialUpdatedAt,
  initialUsedFallback,
  fallback,
}: Props) {
  const t = useTranslations("TrainingOrder");
  const locale = useLocale();
  const isEn = locale === "en";

  const [order, setOrder] = useState<TrainingOrderData | null>(initialOrder);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [usedFallback, setUsedFallback] = useState(initialUsedFallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const hasGroups = groups.length > 0;

  const currentGroups = useMemo(
    () =>
      groups.map((group) => ({
        groupId: group.groupId,
        skillIds: group.skills.map((skill) => skill.skillId),
      })),
    [groups]
  );

  const progressById = useMemo(() => {
    const map = new Map<number, number>();
    for (const group of groups) {
      for (const skill of group.skills) {
        map.set(skill.skillId, skill.progress);
      }
    }
    return map;
  }, [groups]);

  // Orden guardado + datos actuales (nombres y progreso de hoy).
  // Se ignoran grupos o habilidades que ya no existen.
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    if (!order) {
      return [];
    }

    const groupsById = new Map(groups.map((group) => [group.groupId, group]));
    const result: DisplayGroup[] = [];

    for (const orderGroup of order.groups) {
      const current = groupsById.get(orderGroup.groupId);

      if (!current) {
        continue;
      }

      const currentSkills = new Map(
        current.skills.map((skill) => [skill.skillId, skill])
      );

      const skills: DisplaySkill[] = [];

      for (const orderSkill of orderGroup.skills) {
        const skill = currentSkills.get(orderSkill.skillId);

        if (!skill) {
          continue;
        }

        skills.push({
          skillId: skill.skillId,
          name: skill.name,
          progress: skill.progress,
          reason: isEn ? orderSkill.reasonEn : orderSkill.reasonEs,
        });
      }

      result.push({
        groupId: current.groupId,
        name: current.name,
        reason: isEn ? orderGroup.reasonEn : orderGroup.reasonEs,
        skills,
      });
    }

    return result;
  }, [order, groups, isEn]);

  const isOutdated = useMemo(() => {
    if (!order) {
      return false;
    }

    const currentKeys = buildKeys(currentGroups);

    const savedKeys = buildKeys(
      order.groups.map((group) => ({
        groupId: group.groupId,
        skillIds: group.skills.map((skill) => skill.skillId),
      }))
    );

    if (currentKeys.size !== savedKeys.size) {
      return true;
    }

    return Array.from(currentKeys).some((key) => !savedKeys.has(key));
  }, [order, currentGroups]);

  // Misma regla que el panel (lib/training-order.ts)
  const nextSkill = useMemo<DisplaySkill | null>(() => {
    if (!order) {
      return null;
    }

    const nextId = resolveNextSkillId(order, currentGroups, progressById);

    if (nextId === null) {
      return null;
    }

    return (
      displayGroups
        .flatMap((group) => group.skills)
        .find((skill) => skill.skillId === nextId) ?? null
    );
  }, [order, currentGroups, progressById, displayGroups]);

  const summary = order ? (isEn ? order.summaryEn : order.summaryEs) : "";

  const formattedDate = updatedAt
    ? new Intl.DateTimeFormat(isEn ? "en-GB" : "es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(updatedAt))
    : null;

  function skillHref(skillId: number): string {
    return `/pets/${petId}/skills?skill=${skillId}`;
  }

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const res = await fetch("/api/training-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId }),
      });

      if (!res.ok) {
        throw new Error("bad_response");
      }

      const data: ApiResponse = await res.json();
      const parsed = parseStoredOrder(data.order);

      if (!parsed) {
        throw new Error("empty");
      }

      setOrder(parsed);
      setUpdatedAt(
        typeof data.updatedAt === "string"
          ? data.updatedAt
          : new Date().toISOString()
      );
      setUsedFallback(data.usedFallback === true);

      if (data.saved === false) {
        setWarning(t("errorNotSaved"));
      }
    } catch {
      setError(t("errorCalculate"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-8 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            {t("sectionLabel")}
          </p>
          <p className="mt-2 text-indigo-800">
            {t("description", { name: petName })}
          </p>
        </div>

        {hasGroups ? (
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? t("calculating")
              : order
              ? t("recalculate")
              : t("calculate")}
          </button>
        ) : (
          <Link
            href={`/pets/${petId}/groups`}
            className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            {t("createGroupsCta")}
          </Link>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-100 px-5 py-3 font-semibold text-red-800">
          {error}
        </div>
      )}

      {warning && (
        <div className="mt-4 rounded-xl bg-amber-100 px-5 py-3 font-semibold text-amber-900">
          {warning}
        </div>
      )}

      {/* SIN GRUPOS */}
      {!hasGroups && (
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xl font-bold text-indigo-900">
            {t("noGroupsTitle")}
          </p>
          <p className="mt-1 text-slate-700">
            {t("noGroupsBody", { name: petName })}
          </p>
        </div>
      )}

      {/* CON GRUPOS, SIN CALCULAR: sugerencia básica */}
      {hasGroups && !order && (
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{t("notCalculatedHint")}</p>
          <p className="mt-2 text-xl font-bold text-indigo-900">
            {fallback.title}
          </p>
          <p className="mt-1 text-slate-700">{fallback.body}</p>
          <Link
            href={fallback.href}
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {fallback.cta}
          </Link>
        </div>
      )}

      {/* ORDEN CALCULADO */}
      {hasGroups && order && (
        <div className="mt-6 space-y-5">
          {isOutdated && (
            <div className="rounded-xl bg-amber-100 px-5 py-3 font-semibold text-amber-900">
              {t("outdatedNote")}
            </div>
          )}

          {nextSkill && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
                {t("nextLabel")}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-indigo-900">
                    {nextSkill.name}{" "}
                    <span className="text-base font-semibold text-indigo-600">
                      · {nextSkill.progress}%
                    </span>
                  </p>
                  {nextSkill.reason && (
                    <p className="mt-1 text-slate-700">{nextSkill.reason}</p>
                  )}
                </div>
                <Link
                  href={skillHref(nextSkill.skillId)}
                  className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {t("viewSkill")}
                </Link>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
                {t("summaryLabel")}
              </p>
              <p className="mt-1 text-slate-700">{summary}</p>
            </div>
          )}

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              {t("orderLabel")}
            </p>

            <ol className="mt-3 space-y-4">
              {displayGroups.map((group, groupIndex) => (
                <li
                  key={group.groupId}
                  className="rounded-xl border border-indigo-100 p-4"
                >
                  <p className="font-bold text-indigo-900">
                    {groupIndex + 1}. {group.name}
                  </p>
                  {group.reason && (
                    <p className="mt-1 text-sm text-slate-600">
                      {group.reason}
                    </p>
                  )}

                  {group.skills.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {t("noSkillsInGroup")}
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {group.skills.map((skill, skillIndex) => {
                        const mastered = isMastered(skill.progress);
                        const isNext = nextSkill?.skillId === skill.skillId;

                        return (
                          <li
                            key={skill.skillId}
                            className={`rounded-lg px-3 py-2 ${
                              isNext ? "bg-indigo-100" : "bg-slate-50"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Link
                                href={skillHref(skill.skillId)}
                                className="font-semibold text-slate-800 hover:underline"
                              >
                                {groupIndex + 1}.{skillIndex + 1} {skill.name}
                              </Link>
                              <span className="text-sm font-bold text-indigo-600">
                                {mastered ? `✓ ${t("masteredTag")} · ` : ""}
                                {skill.progress}%
                              </span>
                            </div>
                            {skill.reason && (
                              <p className="mt-1 text-sm text-slate-600">
                                {skill.reason}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {formattedDate && (
            <p
              suppressHydrationWarning
              className="text-xs font-medium text-slate-500"
            >
              {t("updatedAt", { date: formattedDate })}
              {usedFallback ? ` · ${t("fallbackNote")}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}