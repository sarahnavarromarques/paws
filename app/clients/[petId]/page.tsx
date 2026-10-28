"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import PawsiLoading from "@/components/PawsiLoading";
import {
  getWeekProgress,
  type HomeworkAssignment,
  type HomeworkLog,
} from "@/lib/homework";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  name_en: string | null;
};

type PetSkill = {
  skill_id: number;
  auto_progress: number | null;
};

type PetInfo = {
  id: number;
  name: string;
  photo: string | null;
  breed: string | null;
};

const ASSIGNMENT_COLUMNS =
  "id, pet_id, trainer_id, skill_id, title, instructions, attempts_per_session, sessions_per_week, active, created_at";

// Pantalla del adiestrador para un perro de un cliente:
// sus habilidades y los deberes que le manda
export default function ClientDogPage() {
  const t = useTranslations("ClientDetail");
  const locale = useLocale();
  const isEnglish = locale === "en";
  const router = useRouter();
  const params = useParams<{ petId: string }>();
  const petId = Number(params.petId);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [pet, setPet] = useState<PetInfo | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkill[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [logs, setLogs] = useState<HomeworkLog[]>([]);

  // Formulario de deber nuevo
  const [skillId, setSkillId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [attempts, setAttempts] = useState(5);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const skillName = (skill: Skill | undefined): string => {
    if (!skill) return "";
    return isEnglish && skill.name_en ? skill.name_en : skill.name;
  };

  const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !Number.isFinite(petId)) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    // ¿Este perro está vinculado a este adiestrador?
    const { data: linksData } = await supabase.rpc("get_my_trainer_links");
    const link = (linksData ?? []).find(
      (row) => row.pet_id === petId && row.role === "trainer"
    );

    if (!link) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    setOwnerName(link.other_name);

    const [petRes, petSkillsRes, skillsRes, assignmentsRes] = await Promise.all([
      supabase
        .from("pets")
        .select("id, name, photo, breed")
        .eq("id", petId)
        .maybeSingle(),
      supabase
        .from("pet_skills")
        .select("skill_id, auto_progress")
        .eq("pet_id", petId),
      supabase.from("skills").select("id, name, name_en"),
      supabase
        .from("homework_assignments")
        .select(ASSIGNMENT_COLUMNS)
        .eq("pet_id", petId)
        .eq("trainer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (petRes.error || !petRes.data) {
      setNotAllowed(true);
      setLoading(false);
      return;
    }

    const petAssignments: HomeworkAssignment[] = assignmentsRes.data ?? [];

    // Registros de los últimos 30 días
    let recentLogs: HomeworkLog[] = [];
    if (petAssignments.length > 0) {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data: logsData } = await supabase
        .from("homework_logs")
        .select("id, assignment_id, pet_id, attempts, successes, logged_at")
        .in(
          "assignment_id",
          petAssignments.map((a) => a.id)
        )
        .gte("logged_at", since.toISOString())
        .order("logged_at", { ascending: false });

      recentLogs = logsData ?? [];
    }

    setPet(petRes.data);
    setPetSkills(petSkillsRes.data ?? []);
    setSkills(skillsRes.data ?? []);
    setAssignments(petAssignments);
    setLogs(recentLogs);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const skillsById = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills]
  );

  // Habilidades del perro, de más a menos avanzada
  const dogSkills = useMemo(
    () =>
      petSkills
        .map((ps) => ({
          id: ps.skill_id,
          name: skillName(skillsById.get(ps.skill_id)),
          progress: ps.auto_progress ?? 0,
        }))
        .filter((s) => s.name)
        .sort((a, b) => b.progress - a.progress),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [petSkills, skillsById, isEnglish]
  );

  // Opciones del desplegable: primero las del perro, luego el resto
  const skillOptions = useMemo(() => {
    const dogSkillIds = new Set(petSkills.map((ps) => ps.skill_id));
    return [...skills].sort((a, b) => {
      const aDog = dogSkillIds.has(a.id) ? 0 : 1;
      const bDog = dogSkillIds.has(b.id) ? 0 : 1;
      if (aDog !== bDog) return aDog - bDog;
      return skillName(a).localeCompare(skillName(b), locale);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, petSkills, isEnglish, locale]);

  function handleSkillChange(value: string) {
    // Si el título estaba vacío o era el de la habilidad anterior, se rellena solo
    const previous = skillName(skillsById.get(Number(skillId)));
    if (!title.trim() || title === previous) {
      setTitle(skillName(skillsById.get(Number(value))));
    }
    setSkillId(value);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId || !pet) return;

    const finalTitle = title.trim() || skillName(skillsById.get(Number(skillId)));
    if (!finalTitle) {
      setFormError(t("errorTitle"));
      return;
    }

    setSaving(true);
    setFormError(null);

    const { data, error } = await supabase
      .from("homework_assignments")
      .insert({
        pet_id: pet.id,
        trainer_id: userId,
        skill_id: skillId ? Number(skillId) : null,
        title: finalTitle.slice(0, 120),
        instructions: instructions.trim() ? instructions.trim().slice(0, 2000) : null,
        attempts_per_session: Math.min(50, Math.max(1, attempts)),
        sessions_per_week: Math.min(14, Math.max(1, sessionsPerWeek)),
      })
      .select(ASSIGNMENT_COLUMNS)
      .single();

    setSaving(false);

    if (error || !data) {
      console.error("Error creando deber:", error);
      setFormError(t("errorSave"));
      return;
    }

    setAssignments((prev) => [data, ...prev]);
    setSkillId("");
    setTitle("");
    setInstructions("");
  }

  async function handleToggleActive(assignment: HomeworkAssignment) {
    const { error } = await supabase
      .from("homework_assignments")
      .update({ active: !assignment.active })
      .eq("id", assignment.id);

    if (error) {
      console.error("Error cambiando el deber:", error);
      return;
    }

    setAssignments((prev) =>
      prev.map((a) => (a.id === assignment.id ? { ...a, active: !a.active } : a))
    );
  }

  async function handleDelete(assignment: HomeworkAssignment) {
    if (!window.confirm(t("confirmDelete"))) return;

    const { error } = await supabase
      .from("homework_assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      console.error("Error borrando el deber:", error);
      return;
    }

    setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
    setLogs((prev) => prev.filter((l) => l.assignment_id !== assignment.id));
  }

  async function handleRemoveClient() {
    if (!pet || !userId) return;
    if (!window.confirm(t("confirmRemove", { pet: pet.name }))) return;

    const { error } = await supabase
      .from("pet_trainers")
      .delete()
      .eq("pet_id", pet.id)
      .eq("trainer_id", userId);

    if (error) {
      console.error("Error quitando el cliente:", error);
      return;
    }

    router.push("/clients");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4 shadow">
          <PawsiLoading text={t("loading")} variant="card" />
        </div>
      </main>
    );
  }

  if (notAllowed || !pet) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <Link href="/clients" className="font-semibold text-blue-600 hover:underline">
            {t("back")}
          </Link>
          <div className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-600 shadow">
            {t("notFound")}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/clients" className="font-semibold text-blue-600 hover:underline">
          {t("back")}
        </Link>

        {/* CABECERA DEL PERRO */}

        <section className="flex items-center gap-5 rounded-2xl bg-white p-6 shadow">
          {pet.photo ? (
            <Image
              src={pet.photo}
              alt={pet.name}
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-full border-4 border-blue-500 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-200 text-5xl">
              🐶
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-4xl font-extrabold text-blue-700">{pet.name}</h1>
            <p className="mt-1 text-slate-600">{t("owner", { name: ownerName })}</p>
          </div>
        </section>

        {/* DEBERES */}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#1e3a5f]">{t("homeworkTitle")}</h2>

          {assignments.length === 0 ? (
            <p className="text-slate-500">{t("noHomework")}</p>
          ) : (
            <ul className="space-y-4">
              {assignments.map((assignment) => {
                const progress = getWeekProgress(assignment, logs);
                const ownLogs = logs
                  .filter((l) => l.assignment_id === assignment.id)
                  .slice(0, 5);

                return (
                  <li
                    key={assignment.id}
                    className={`rounded-xl border p-4 ${
                      assignment.active
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 bg-white opacity-70"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          assignment.active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {assignment.active ? t("active") : t("paused")}
                      </span>
                    </div>

                    {assignment.instructions && (
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                        {assignment.instructions}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                        {t("sessionsThisWeek", {
                          done: progress.done,
                          target: progress.target,
                        })}
                      </span>
                      {progress.successRate !== null && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {t("successRate", { rate: progress.successRate })}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                        {progress.lastLoggedAt
                          ? t("lastLog", { date: formatDate(progress.lastLoggedAt) })
                          : t("noLogsYet")}
                      </span>
                    </div>

                    {ownLogs.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          {t("recentTitle")}
                        </p>
                        <ul className="mt-1 space-y-1 text-sm text-slate-600">
                          {ownLogs.map((log) => (
                            <li key={log.id}>
                              {formatDate(log.logged_at)} ·{" "}
                              {t("logLine", {
                                successes: log.successes,
                                attempts: log.attempts,
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(assignment)}
                        className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                      >
                        {assignment.active ? t("pause") : t("resume")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(assignment)}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* DEBER NUEVO */}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#1e3a5f]">{t("newHomework")}</h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">{t("skill")}</span>
              <select
                value={skillId}
                onChange={(e) => handleSkillChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
              >
                <option value="">{t("noSkillOption")}</option>
                {skillOptions.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skillName(skill)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">{t("titleLabel")}</span>
              <input
                type="text"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">{t("attempts")}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={attempts}
                  onChange={(e) => setAttempts(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">
                  {t("sessionsPerWeek")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-slate-900"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">{t("instructions")}</span>
              <textarea
                value={instructions}
                maxLength={2000}
                rows={3}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t("instructionsPlaceholder")}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400"
              />
            </label>

            {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </form>
        </section>

        {/* HABILIDADES DEL PERRO */}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#1e3a5f]">{t("skillsTitle")}</h2>

          {dogSkills.length === 0 ? (
            <p className="text-slate-500">{t("noSkills")}</p>
          ) : (
            <ul className="space-y-3">
              {dogSkills.map((skill) => (
                <li key={skill.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold text-slate-700">{skill.name}</span>
                    <span className="text-slate-500">{skill.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.min(100, Math.max(0, skill.progress))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="text-center">
          <button
            type="button"
            onClick={handleRemoveClient}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            {t("removeClient")}
          </button>
        </div>
      </div>
    </main>
  );
}