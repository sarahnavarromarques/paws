"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  category: string | null;
  difficulty: string | null;
  description: string | null;
};

type PetSkillRow = {
  id: number;
  skill_id: number;
  manual_progress: number | null;
  auto_progress: number | null;
  is_goal: boolean;
  updated_at: string | null;
};

type Pet = {
  id: number;
  name: string;
  photo: string | null;
};

const DIFFICULTY_STYLES: Record<string, string> = {
  baja: "bg-green-100 text-green-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-red-100 text-red-800",
};

const CATEGORY_ICONS: Record<string, string> = {
  Posiciones: "🐕",
  Control: "🎯",
  Llamada: "📢",
  Paseo: "🚶",
  "Obediencia FCI": "🏆",
};

export default function PetSkillsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const petId = Number(params.id);

  const [pet, setPet] = useState<Pet | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const [savingSkillId, setSavingSkillId] = useState<number | null>(null);
  const [openInfoId, setOpenInfoId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Cargar mascota (y comprobar que pertenece al usuario)
      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select("id, name, photo")
        .eq("id", petId)
        .eq("user_id", user.id)
        .single();

      if (petError || !petData) {
        router.replace("/pets");
        return;
      }

      setPet(petData);

      // Cargar catálogo de habilidades
      const { data: skillsData } = await supabase
        .from("skills")
        .select("id, name, category, difficulty, description")
        .order("id", { ascending: true });

      setSkills(skillsData ?? []);

      // Cargar progreso de esta mascota
      const { data: petSkillsData } = await supabase
        .from("pet_skills")
        .select(
          "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
        )
        .eq("pet_id", petId);

      setPetSkills(petSkillsData ?? []);

      setLoading(false);
    }

    if (!Number.isNaN(petId)) {
      void loadData();
    }
  }, [petId, router]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    skills.forEach((skill) => {
      if (skill.category) unique.add(skill.category);
    });
    return ["Todas", ...Array.from(unique)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    if (activeCategory === "Todas") return skills;
    return skills.filter((skill) => skill.category === activeCategory);
  }, [skills, activeCategory]);

  function getProgressForSkill(skillId: number): number {
    const petSkill = petSkills.find((ps) => ps.skill_id === skillId);
    return petSkill?.manual_progress ?? 0;
  }

  function isSkillActive(skillId: number): boolean {
    return petSkills.some((ps) => ps.skill_id === skillId);
  }

  function isSkillGoal(skillId: number): boolean {
    return petSkills.some((ps) => ps.skill_id === skillId && ps.is_goal);
  }

  async function handleAddSkill(skillId: number) {
    setSavingSkillId(skillId);

    const { data, error } = await supabase
      .from("pet_skills")
      .insert({
        pet_id: petId,
        skill_id: skillId,
        manual_progress: 0,
        auto_progress: 0,
      })
      .select(
        "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
      )
      .single();

    if (error) {
      console.error("Error añadiendo habilidad:", error);
      setSavingSkillId(null);
      return;
    }

    if (data) {
      setPetSkills((prev) => [...prev, data]);
    }

    setSavingSkillId(null);
  }

  async function handleRemoveSkill(skillId: number) {
    setSavingSkillId(skillId);

    const { error } = await supabase
      .from("pet_skills")
      .delete()
      .eq("pet_id", petId)
      .eq("skill_id", skillId);

    if (error) {
      console.error("Error eliminando habilidad:", error);
      setSavingSkillId(null);
      return;
    }

    setPetSkills((prev) => prev.filter((ps) => ps.skill_id !== skillId));
    setSavingSkillId(null);
  }

  async function handleUpdateProgress(skillId: number, newValue: number) {
    // Actualización optimista en UI
    setPetSkills((prev) =>
      prev.map((ps) =>
        ps.skill_id === skillId
          ? { ...ps, manual_progress: newValue }
          : ps
      )
    );

    const { error } = await supabase
      .from("pet_skills")
      .update({
        manual_progress: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq("pet_id", petId)
      .eq("skill_id", skillId);

    if (error) {
      console.error("Error actualizando progreso:", error);
    }
  }

  async function handleToggleGoal(skillId: number) {
    const currentlyGoal = isSkillGoal(skillId);

    // Actualización optimista: si marcamos este, desmarcamos los demás.
    setPetSkills((prev) =>
      prev.map((ps) => {
        if (ps.skill_id === skillId) {
          return { ...ps, is_goal: !currentlyGoal };
        }
        return { ...ps, is_goal: false };
      })
    );

    setSavingSkillId(skillId);

    if (currentlyGoal) {
      // Desmarcar objetivo
      const { error } = await supabase
        .from("pet_skills")
        .update({ is_goal: false })
        .eq("pet_id", petId)
        .eq("skill_id", skillId);

      if (error) {
        console.error("Error quitando objetivo:", error);
      }
    } else {
      // Quitar objetivo de todas las demás
      const { error: clearError } = await supabase
        .from("pet_skills")
        .update({ is_goal: false })
        .eq("pet_id", petId);

      // Marcar esta como objetivo
      const { error: setError } = await supabase
        .from("pet_skills")
        .update({ is_goal: true })
        .eq("pet_id", petId)
        .eq("skill_id", skillId);

      if (clearError || setError) {
        console.error("Error marcando objetivo:", clearError, setError);
      }
    }

    setSavingSkillId(null);
  }

  const activeSkillsCount = petSkills.length;

  const averageProgress =
    petSkills.length === 0
      ? 0
      : Math.round(
          petSkills.reduce(
            (sum, ps) => sum + (ps.manual_progress ?? 0),
            0
          ) / petSkills.length
        );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">Cargando habilidades...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/pets/${petId}`}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Volver a la mascota
          </Link>
          <Link
            href="/skills"
            className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            📚 Ver biblioteca completa
          </Link>
        </div>

        <header className="mb-8 flex flex-col gap-6 rounded-3xl bg-white p-8 shadow md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {pet?.photo ? (
              <img
                src={pet.photo}
                alt={pet.name}
                className="h-20 w-20 rounded-full border-4 border-slate-100 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
                🐶
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Habilidades de
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight">
                {pet?.name}
              </h1>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="rounded-2xl bg-slate-100 px-6 py-4 text-center">
              <p className="text-3xl font-bold">{activeSkillsCount}</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                activas
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-6 py-4 text-center">
              <p className="text-3xl font-bold">{averageProgress}%</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                media
              </p>
            </div>
          </div>
        </header>

        {/* FILTROS DE CATEGORÍA */}
        {skills.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            {categories.map((category) => {
              const isActive = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={
                    isActive
                      ? "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                      : "rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  }
                >
                  {category !== "Todas" && CATEGORY_ICONS[category]
                    ? `${CATEGORY_ICONS[category]} `
                    : ""}
                  {category}
                </button>
              );
            })}
          </div>
        )}

        {/* LISTA DE HABILIDADES */}
        {skills.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <div className="text-5xl">📚</div>
            <h3 className="mt-4 text-2xl font-bold">
              Todavía no hay habilidades disponibles
            </h3>
            <p className="mt-2 text-slate-500">
              La biblioteca de habilidades no se ha podido cargar. Inténtalo de nuevo más tarde.
            </p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <p className="text-slate-500">
              No hay habilidades en esta categoría.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredSkills.map((skill) => {
              const difficulty = skill.difficulty ?? "baja";
              const difficultyStyle =
                DIFFICULTY_STYLES[difficulty] ??
                "bg-slate-100 text-slate-700";
              const icon = skill.category
                ? CATEGORY_ICONS[skill.category] ?? "🐾"
                : "🐾";
              const isActive = isSkillActive(skill.id);
              const isGoal = isSkillGoal(skill.id);
              const progress = getProgressForSkill(skill.id);
              const isSaving = savingSkillId === skill.id;
              const isInfoOpen = openInfoId === skill.id;

              return (
                <div
                  key={skill.id}
                  className={`flex flex-col rounded-2xl bg-white p-6 shadow transition ${
                    isGoal
                      ? "ring-2 ring-amber-500"
                      : isActive
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <div>
                        <h2 className="text-xl font-bold">{skill.name}</h2>
                        <p className="text-sm text-slate-500">
                          {skill.category ?? "Sin categoría"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {skill.description && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenInfoId(
                              isInfoOpen ? null : skill.id
                            )
                          }
                          aria-label="Más información"
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                            isInfoOpen
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          ℹ
                        </button>
                      )}

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${difficultyStyle}`}
                      >
                        {difficulty}
                      </span>
                    </div>
                  </div>

                  {isInfoOpen && skill.description && (
                    <div className="mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                      {skill.description}
                    </div>
                  )}

                  {isGoal && (
                    <div className="mb-3 rounded-lg bg-amber-500 px-3 py-1 text-center text-sm font-bold text-white">
                      🎯 Objetivo actual
                    </div>
                  )}

                  {isActive ? (
                    <div className="mt-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600">
                          Progreso
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {progress}%
                        </span>
                      </div>

                      <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={progress}
                        onChange={(event) =>
                          handleUpdateProgress(
                            skill.id,
                            Number(event.target.value)
                          )
                        }
                        className="w-full accent-blue-600"
                      />

                      <button
                        type="button"
                        onClick={() => handleToggleGoal(skill.id)}
                        disabled={isSaving}
                        className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                          isGoal
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {isGoal
                          ? "Quitar objetivo"
                          : "🎯 Marcar como objetivo"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        disabled={isSaving}
                        className="mt-2 w-full rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        {isSaving ? "Guardando..." : "Quitar habilidad"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddSkill(skill.id)}
                      disabled={isSaving}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? "Añadiendo..." : "+ Añadir a mi mascota"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}