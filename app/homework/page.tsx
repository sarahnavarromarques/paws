"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";
import {
  getWeekProgress,
  type HomeworkAssignment,
  type HomeworkLog,
} from "@/lib/homework";

const supabase = createClient();

// Días de historial que se cargan para cada deber
const HISTORY_DAYS = 30;

type OwnerLink = {
  linkId: string;
  petId: number;
  petName: string;
  petPhoto: string | null;
  trainerId: string;
  trainerName: string;
};

type Draft = {
  attempts: number;
  successes: number;
};

// Pantalla del dueño: los deberes que le manda su adiestrador
// y el registro rápido ("Hecho" + aciertos)
export default function HomeworkPage() {
  const t = useTranslations("Homework");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [links, setLinks] = useState<OwnerLink[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [logs, setLogs] = useState<HomeworkLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // Deberes con el historial desplegado
  const [openHistory, setOpenHistory] = useState<Set<string>>(() => new Set());

  async function load() {
    setLoading(true);
    setLoadError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // Vínculos como dueño (con el nombre del adiestrador) y quién es cada adiestrador
    const [namesRes, rowsRes] = await Promise.all([
      supabase.rpc("get_my_trainer_links"),
      supabase
        .from("pet_trainers")
        .select("id, pet_id, trainer_id")
        .eq("owner_id", user.id),
    ]);

    if (namesRes.error || rowsRes.error) {
      console.error("Error cargando adiestradores:", namesRes.error ?? rowsRes.error);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const namesById = new Map(
      (namesRes.data ?? [])
        .filter((row) => row.role === "owner")
        .map((row) => [row.link_id, row])
    );

    const ownerLinks: OwnerLink[] = (rowsRes.data ?? []).flatMap((row) => {
      const named = namesById.get(row.id);
      if (!named) return [];
      return [
        {
          linkId: row.id,
          petId: row.pet_id,
          petName: named.pet_name,
          petPhoto: named.pet_photo,
          trainerId: row.trainer_id,
          trainerName: named.other_name,
        },
      ];
    });

    let activeAssignments: HomeworkAssignment[] = [];
    let weekLogs: HomeworkLog[] = [];

    if (ownerLinks.length > 0) {
      const petIds = Array.from(new Set(ownerLinks.map((l) => l.petId)));

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("homework_assignments")
        .select(
          "id, pet_id, trainer_id, skill_id, title, instructions, attempts_per_session, sessions_per_week, active, created_at"
        )
        .in("pet_id", petIds)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (assignmentsError) {
        console.error("Error cargando deberes:", assignmentsError);
        setLoadError(true);
        setLoading(false);
        return;
      }

      // Solo los deberes de adiestradores con los que sigue conectado
      activeAssignments = (assignmentsData ?? []).filter((a) =>
        ownerLinks.some((l) => l.petId === a.pet_id && l.trainerId === a.trainer_id)
      );

      if (activeAssignments.length > 0) {
        // Registros de los últimos días (la semana actual se calcula a partir de ellos)
        const since = new Date();
        since.setDate(since.getDate() - HISTORY_DAYS);

        const { data: logsData } = await supabase
          .from("homework_logs")
          .select("id, assignment_id, pet_id, attempts, successes, logged_at")
          .eq("user_id", user.id)
          .in(
            "assignment_id",
            activeAssignments.map((a) => a.id)
          )
          .gte("logged_at", since.toISOString())
          .order("logged_at", { ascending: false });

        weekLogs = logsData ?? [];
      }
    }

    // Valores iniciales del registro rápido: todos los intentos pedidos
    const initialDrafts: Record<string, Draft> = {};
    for (const a of activeAssignments) {
      initialDrafts[a.id] = {
        attempts: a.attempts_per_session,
        successes: a.attempts_per_session,
      };
    }

    setLinks(ownerLinks);
    setAssignments(activeAssignments);
    setLogs(weekLogs);
    setDrafts(initialDrafts);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agrupados por perro y adiestrador
  const groups = useMemo(
    () =>
      links.map((link) => ({
        link,
        assignments: assignments.filter(
          (a) => a.pet_id === link.petId && a.trainer_id === link.trainerId
        ),
      })),
    [links, assignments]
  );

  function toggleHistory(assignmentId: string) {
    setOpenHistory((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
      } else {
        next.add(assignmentId);
      }
      return next;
    });
  }

  const formatLogDate = (iso: string): string =>
    new Date(iso).toLocaleString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  function updateDraft(assignmentId: string, change: Partial<Draft>) {
    setDrafts((prev) => {
      const current = prev[assignmentId] ?? { attempts: 1, successes: 0 };
      const attempts = Math.min(100, Math.max(1, change.attempts ?? current.attempts));
      const successes = Math.min(
        attempts,
        Math.max(0, change.successes ?? current.successes)
      );
      return { ...prev, [assignmentId]: { attempts, successes } };
    });
  }

  async function handleDone(assignment: HomeworkAssignment) {
    const draft = drafts[assignment.id];
    if (!draft) return;

    setSavingId(assignment.id);
    setErrorId(null);

    const { data, error } = await supabase
      .from("homework_logs")
      .insert({
        assignment_id: assignment.id,
        pet_id: assignment.pet_id,
        attempts: draft.attempts,
        successes: draft.successes,
      })
      .select("id, assignment_id, pet_id, attempts, successes, logged_at")
      .single();

    setSavingId(null);

    if (error || !data) {
      console.error("Error apuntando el deber:", error);
      setErrorId(assignment.id);
      return;
    }

    setLogs((prev) => [data, ...prev]);
    setSavedId(assignment.id);
    window.setTimeout(() => setSavedId(null), 2000);
  }

  async function handleUndo(assignment: HomeworkAssignment) {
    const last = logs.find((log) => log.assignment_id === assignment.id);
    if (!last) return;

    const { error } = await supabase.from("homework_logs").delete().eq("id", last.id);

    if (error) {
      console.error("Error deshaciendo el registro:", error);
      return;
    }

    setLogs((prev) => prev.filter((log) => log.id !== last.id));
  }

  async function handleLeave(link: OwnerLink) {
    if (
      !window.confirm(
        t("confirmLeave", { name: link.trainerName, pet: link.petName })
      )
    ) {
      return;
    }

    const { error } = await supabase.from("pet_trainers").delete().eq("id", link.linkId);

    if (error) {
      console.error("Error dejando de compartir:", error);
      return;
    }

    setLinks((prev) => prev.filter((l) => l.linkId !== link.linkId));
  }

  function renderStepper(
    label: string,
    value: number,
    onChange: (value: number) => void
  ) {
    return (
      <div className="flex flex-col items-center">
        <span className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(value - 1)}
            className="h-10 w-10 rounded-full bg-slate-200 text-xl font-bold text-slate-700 transition hover:bg-slate-300"
            aria-label={`${label} -1`}
          >
            −
          </button>
          <span className="w-8 text-center text-2xl font-bold text-slate-800">{value}</span>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="h-10 w-10 rounded-full bg-slate-200 text-xl font-bold text-slate-700 transition hover:bg-slate-300"
            aria-label={`${label} +1`}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-700 md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow">
            <PawsiLoading text={t("loading")} variant="card" />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl bg-white p-6 text-center font-semibold text-red-600 shadow">
            {t("errorLoad")}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
            <Pawsi pose="espera" size={120} float />
            <p className="mt-4 text-slate-600">{t("noTrainer")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ link, assignments: petAssignments }) => (
              <section key={link.linkId} className="rounded-2xl bg-white p-6 shadow">
                {/* PERRO Y ADIESTRADOR */}

                <div className="mb-5 flex items-center gap-4">
                  {link.petPhoto ? (
                    <Image
                      src={link.petPhoto}
                      alt={link.petName}
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-full border-4 border-blue-500 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 text-3xl">
                      🐶
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-[#1e3a5f]">
                      {link.petName}
                    </h2>
                    <p className="truncate text-sm text-slate-500">
                      {t("trainer", { name: link.trainerName })}
                    </p>
                  </div>
                </div>

                {petAssignments.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-slate-600">
                    {t("noHomework", { trainer: link.trainerName, pet: link.petName })}
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {petAssignments.map((assignment) => {
                      const progress = getWeekProgress(assignment, logs);
                      const draft = drafts[assignment.id] ?? {
                        attempts: assignment.attempts_per_session,
                        successes: assignment.attempts_per_session,
                      };
                      const weekDone = progress.done >= progress.target;
                      const hasLogThisWeek = progress.done > 0;
                      const history = logs.filter(
                        (log) => log.assignment_id === assignment.id
                      );
                      const historyOpen = openHistory.has(assignment.id);

                      return (
                        <li
                          key={assignment.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-slate-800">
                                {assignment.title}
                              </h3>
                              <p className="text-sm text-slate-500">
                                {t("target", {
                                  attempts: assignment.attempts_per_session,
                                  sessions: assignment.sessions_per_week,
                                })}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                weekDone
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {t("sessionsThisWeek", {
                                done: progress.done,
                                target: progress.target,
                              })}
                            </span>
                          </div>

                          {assignment.instructions && (
                            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                              {assignment.instructions}
                            </p>
                          )}

                          {assignment.skill_id !== null && (
                            <Link
                              href={`/skills?pet=${assignment.pet_id}&skill=${assignment.skill_id}`}
                              className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline"
                            >
                              {t("howToTeach")}
                            </Link>
                          )}

                          {weekDone && (
                            <p className="mt-3 font-semibold text-green-700">
                              {t("weekCompleted")}
                            </p>
                          )}

                          {/* REGISTRO RÁPIDO */}

                          <div className="mt-4 flex flex-wrap items-end justify-center gap-6 sm:justify-start">
                            {renderStepper(t("attemptsLabel"), draft.attempts, (value) =>
                              updateDraft(assignment.id, { attempts: value })
                            )}
                            {renderStepper(t("successesLabel"), draft.successes, (value) =>
                              updateDraft(assignment.id, { successes: value })
                            )}

                            <button
                              type="button"
                              onClick={() => handleDone(assignment)}
                              disabled={savingId === assignment.id}
                              className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                            >
                              {savingId === assignment.id
                                ? t("saving")
                                : savedId === assignment.id
                                ? t("saved")
                                : t("done")}
                            </button>
                          </div>

                          {errorId === assignment.id && (
                            <p className="mt-2 text-sm font-semibold text-red-600">
                              {t("errorSave")}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-4">
                            {history.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleHistory(assignment.id)}
                                aria-expanded={historyOpen}
                                className="text-sm font-semibold text-blue-600 hover:underline"
                              >
                                {historyOpen
                                  ? t("historyHide")
                                  : t("historyShow", { count: history.length })}
                              </button>
                            )}

                            {hasLogThisWeek && (
                              <button
                                type="button"
                                onClick={() => handleUndo(assignment)}
                                className="text-sm font-semibold text-slate-500 hover:underline"
                              >
                                {t("undo")}
                              </button>
                            )}
                          </div>

                          {/* HISTORIAL */}

                          {historyOpen && history.length > 0 && (
                            <div className="mt-3 rounded-xl bg-white p-3">
                              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                {t("historyTitle", { days: HISTORY_DAYS })}
                              </p>
                              <ul className="divide-y divide-slate-100">
                                {history.map((log) => {
                                  const rate = Math.round(
                                    (log.successes / log.attempts) * 100
                                  );
                                  return (
                                    <li
                                      key={log.id}
                                      className="flex items-center justify-between gap-3 py-2 text-sm"
                                    >
                                      <span className="text-slate-600">
                                        {formatLogDate(log.logged_at)}
                                      </span>
                                      <span className="font-semibold text-slate-800">
                                        {t("historyLine", {
                                          successes: log.successes,
                                          attempts: log.attempts,
                                          rate,
                                        })}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-5 text-right">
                  <button
                    type="button"
                    onClick={() => handleLeave(link)}
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    {t("leave", { pet: link.petName, name: link.trainerName })}
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}