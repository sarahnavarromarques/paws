"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  name_en: string | null;
  category: string | null;
};

type Distraction = "baja" | "media" | "alta";
type Mood = "bajo" | "normal" | "alto";

const CATEGORY_LABELS_EN: Record<string, string> = {
  Posiciones: "Positions",
  Control: "Control",
  Llamada: "Recall",
  Paseo: "Heel",
  "Obediencia FCI": "FCI Obedience",
};

function getCategoryLabel(category: string, locale: string): string {
  if (locale === "en" && CATEGORY_LABELS_EN[category]) {
    return CATEGORY_LABELS_EN[category];
  }
  return category;
}

function getSkillName(skill: Skill, locale: string): string {
  return locale === "en" && skill.name_en ? skill.name_en : skill.name;
}

export default function EditTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("EditTraining");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [petId, setPetId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<string>("");

  // Estado inicial del entrenamiento al cargar (para saber si ya estaba completado)
  const [wasCompleted, setWasCompleted] = useState(false);

  // Respuestas de la sesión (preguntas de la IA)
  const [attempts, setAttempts] = useState("");
  const [successes, setSuccesses] = useState("");
  const [distraction, setDistraction] = useState<Distraction>("media");
  const [mood, setMood] = useState<Mood>("normal");

  // Resultado que devuelve la IA
  const [aiResult, setAiResult] = useState<{
    from: number;
    to: number;
    comentario: string;
    usedFallback: boolean;
  } | null>(null);

  useEffect(() => {
    void loadSkills();
    void loadTraining();
  }, [id]);

  async function loadSkills() {
    const { data } = await supabase
      .from("skills")
      .select("id, name, name_en, category")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (data) {
      setSkills(data);
    }
  }

  async function loadTraining() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", Number(id))
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      router.replace("/dashboard");
      return;
    }

    setPetId(data.pet_id ?? null);
    setTitle(data.title ?? "");
    setDate(data.date ?? "");
    setTime(data.time ?? "");
    setDuration(data.duration !== null ? String(data.duration) : "");
    setStatus(data.status ?? "pending");
    setWasCompleted(data.status === "completed");
    setNotes(data.notes ?? "");
    setSkillId(
      data.skill_id !== null && data.skill_id !== undefined
        ? String(data.skill_id)
        : ""
    );

    setLoading(false);
  }

  // ¿Toca mostrar las preguntas de la sesión?
  // Sí cuando: el usuario pone "Completado" y antes NO lo estaba.
  const showSessionQuestions = status === "completed" && !wasCompleted;

  async function saveTraining() {
    if (!title.trim()) {
      alert(t("alertEnterTitle"));
      return;
    }

    if (!skillId) {
      alert(t("alertSelectSkill"));
      return;
    }

    if (!date) {
      alert(t("alertSelectDate"));
      return;
    }

    const numericDuration = duration ? Number(duration) : null;

    if (
      numericDuration !== null &&
      (!Number.isFinite(numericDuration) || numericDuration < 0)
    ) {
      alert(t("alertInvalidDuration"));
      return;
    }

    // Si estamos completando ahora, validamos las respuestas de la sesión.
    if (showSessionQuestions) {
      const a = Number(attempts);
      const s = Number(successes);

      if (!attempts || !Number.isFinite(a) || a <= 0) {
        alert(t("alertEnterAttempts"));
        return;
      }

      if (!successes || !Number.isFinite(s) || s < 0) {
        alert(t("alertEnterSuccesses"));
        return;
      }

      if (s > a) {
        alert(t("alertSuccessesExceedAttempts"));
        return;
      }
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    // 1) Guardar el entrenamiento
    const { error } = await supabase
      .from("trainings")
      .update({
        title: title.trim(),
        date,
        time: time || null,
        duration: numericDuration,
        status,
        notes: notes.trim() || null,
        skill_id: Number(skillId),
      })
      .eq("id", Number(id))
      .eq("user_id", user.id);

    if (error) {
      setSaving(false);
      console.error("Error guardando entrenamiento:", error);
      alert(t("alertSaveError"));
      return;
    }

    // 2) Si estamos completando, calcular el nuevo progreso con la IA
    if (showSessionQuestions && petId !== null) {
      await updateProgressWithAI(user.id);
      // No salimos de la página: mostramos el resultado de la IA.
      setSaving(false);
      setWasCompleted(true);
      router.refresh();
      return;
    }

    setSaving(false);
    router.back();
    router.refresh();
  }

  async function updateProgressWithAI(userId: string) {
    if (petId === null) return;

    const skillIdNum = Number(skillId);

    // Progreso actual de esta habilidad para este perro
    const { data: petSkillRow } = await supabase
      .from("pet_skills")
      .select("id, auto_progress")
      .eq("pet_id", petId)
      .eq("skill_id", skillIdNum)
      .single();

    const currentProgress = petSkillRow?.auto_progress ?? 0;

    // Datos del perro
    const { data: petRow } = await supabase
      .from("pets")
      .select("name, breed, birth_date")
      .eq("id", petId)
      .single();

    const chosenSkill = skills.find((s) => String(s.id) === skillId);

    let ageText: string | null = null;
    if (petRow?.birth_date) {
      const birth = new Date(`${petRow.birth_date}T00:00:00`);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      if (
        now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() &&
          now.getDate() < birth.getDate())
      ) {
        years--;
      }
      ageText =
        years <= 0
          ? locale === "en"
            ? "less than 1 year"
            : "menos de 1 año"
          : locale === "en"
          ? `${years} years`
          : `${years} años`;
    }

    const numericDuration = duration ? Number(duration) : null;

    // Cálculo local de reserva (por si la IA falla)
    function localFallback(): { newProgress: number; comentario: string } {
      const a = Number(attempts);
      const s = Number(successes);
      const rate = a > 0 ? s / a : 0;

      let delta = 0;
      if (rate >= 0.8) delta = 8;
      else if (rate >= 0.5) delta = 4;
      else if (rate >= 0.3) delta = 1;
      else delta = -2;

      if (distraction === "alta") delta += 2;
      if (mood === "bajo") delta -= 1;

      let np = currentProgress + delta;
      if (np < 0) np = 0;
      if (np > 100) np = 100;

      return {
        newProgress: np,
        comentario: t("localFallbackComment"),
      };
    }

    let newProgress = currentProgress;
    let comentario = "";
    let usedFallback = false;

    try {
      const res = await fetch("/api/session-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: chosenSkill ? getSkillName(chosenSkill, locale) : "",
          category: chosenSkill?.category
            ? getCategoryLabel(chosenSkill.category, locale)
            : null,
          currentProgress,
          petName: petRow?.name ?? "",
          petBreed: petRow?.breed ?? null,
          petAge: ageText,
          duration: numericDuration,
          locale,
          answers: {
            attempts: Number(attempts),
            successes: Number(successes),
            distraction,
            mood,
          },
        }),
      });

      if (!res.ok) throw new Error("bad_response");

      const data = await res.json();

      if (
        !data?.result ||
        typeof data.result.newProgress !== "number"
      ) {
        throw new Error("bad_data");
      }

      newProgress = data.result.newProgress;
      comentario = data.result.comentario ?? "";
    } catch {
      const fb = localFallback();
      newProgress = fb.newProgress;
      comentario = fb.comentario;
      usedFallback = true;
    }

    // Guardar el nuevo progreso en pet_skills
    if (petSkillRow?.id) {
      await supabase
        .from("pet_skills")
        .update({
          auto_progress: newProgress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", petSkillRow.id);
    } else {
      // Si el perro no tenía esta habilidad registrada, la creamos
      await supabase.from("pet_skills").insert({
        pet_id: petId,
        skill_id: skillIdNum,
        auto_progress: newProgress,
        manual_progress: 0,
        is_goal: false,
        updated_at: new Date().toISOString(),
      });
    }

    setAiResult({
      from: currentProgress,
      to: newProgress,
      comentario,
      usedFallback,
    });
  }

  async function deleteTraining() {
    if (!confirm(t("confirmDeleteTraining"))) {
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("trainings")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      console.error("Error eliminando entrenamiento:", error);
      alert(t("alertDeleteFailed"));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-xl">
          <p className="text-slate-500">{t("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">

        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("back")}
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">

          <h1 className="mb-2 text-4xl font-bold">{t("title")}</h1>

          <p className="mb-8 text-slate-500">
            {t("subtitle")}
          </p>

          <div className="grid gap-5 md:grid-cols-2">

            {/* TÍTULO */}
            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold">{t("trainingLabel")}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* HABILIDAD (obligatoria) */}
            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold">
                {t("skillWorkedLabel")}
              </label>
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">{t("selectSkillPlaceholder")}</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.category
                      ? `${getCategoryLabel(skill.category, locale)} — `
                      : ""}
                    {getSkillName(skill, locale)}
                  </option>
                ))}
              </select>
            </div>

            {/* FECHA */}
            <div>
              <label className="mb-2 block font-semibold">{t("dateLabel")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* HORA */}
            <div>
              <label className="mb-2 block font-semibold">{t("timeLabel")}</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* DURACIÓN */}
            <div>
              <label className="mb-2 block font-semibold">{t("durationLabel")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <span className="whitespace-nowrap text-slate-500">{t("minSuffix")}</span>
              </div>
            </div>

            {/* ESTADO */}
            <div>
              <label className="mb-2 block font-semibold">{t("statusLabel")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="pending">{t("pendingOption")}</option>
                <option value="completed">{t("completedOption")}</option>
              </select>
            </div>

            {/* NOTAS */}
            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold">{t("notesLabel")}</label>
              <textarea
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

          </div>

          {/* PREGUNTAS DE LA SESIÓN (solo al completar) */}
          {showSessionQuestions && (
            <div className="mt-8 rounded-2xl border-2 border-teal-300 bg-teal-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                {t("sessionQuestionsLabel")}
              </p>
              <p className="mt-1 mb-5 text-teal-800">
                {t("sessionQuestionsSubtitle")}
              </p>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-semibold">
                    {t("attemptsLabel")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={attempts}
                    onChange={(e) => setAttempts(e.target.value)}
                    disabled={saving}
                    placeholder={t("attemptsPlaceholder")}
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold">
                    {t("successesLabel")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={successes}
                    onChange={(e) => setSuccesses(e.target.value)}
                    disabled={saving}
                    placeholder={t("successesPlaceholder")}
                    className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold">
                    {t("distractionLabel")}
                  </label>
                  <select
                    value={distraction}
                    onChange={(e) =>
                      setDistraction(e.target.value as Distraction)
                    }
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="baja">{t("distractionLow")}</option>
                    <option value="media">{t("distractionMedium")}</option>
                    <option value="alta">{t("distractionHigh")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-semibold">
                    {t("moodLabel")}
                  </label>
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value as Mood)}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="bajo">{t("moodLow")}</option>
                    <option value="normal">{t("moodNormal")}</option>
                    <option value="alto">{t("moodHigh")}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* RESULTADO DE LA IA */}
          {aiResult && (
            <div className="mt-8 rounded-2xl border-2 border-green-300 bg-green-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
                {t("progressUpdatedLabel")}
              </p>
              <p className="mt-2 text-2xl font-bold text-green-800">
                {aiResult.from}% → {aiResult.to}%
              </p>
              {aiResult.comentario && (
                <p className="mt-3 text-green-900">{aiResult.comentario}</p>
              )}
              {aiResult.usedFallback && (
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {t("fallbackNote")}
                </p>
              )}
              <button
                type="button"
                onClick={() => router.back()}
                className="mt-5 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
              >
                {t("backToProfile")}
              </button>
            </div>
          )}

          {/* BOTONES */}
          {!aiResult && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={saveTraining}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? t("savingButton")
                  : showSessionQuestions
                  ? t("completeAndAnalyzeButton")
                  : t("saveChangesButton")}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
              >
                {t("cancelButton")}
              </button>

              <button
                type="button"
                onClick={deleteTraining}
                disabled={saving}
                className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("deleteButton")}
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}