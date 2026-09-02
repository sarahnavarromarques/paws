"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Pet = {
  id: number;
  name: string;
};

type Training = {
  id: number;
  title: string;
  date: string | null;
  time: string | null;
  duration: number | null;
  status: string;
  pet_id: number;
  skill_id: number | null;
};

type PetSkillRow = {
  pet_id: number;
  skill_id: number;
  manual_progress: number | null;
  is_goal: boolean;
};

type SkillInfo = {
  id: number;
  name: string;
  category: string | null;
};

type PetSummary = {
  petId: number;
  petName: string;
  skillCount: number;
  averageProgress: number;
  goalName: string | null;
  goalCategory: string | null;
  goalProgress: number | null;
  planTitle: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [petSummaries, setPetSummaries] = useState<PetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name")
        .eq("user_id", user.id)
        .order("id", { ascending: true });

      const { data: trainingsData } = await supabase
        .from("trainings")
        .select(
          "id, title, date, time, duration, status, pet_id, skill_id"
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      const petList = petsData ?? [];
      setPets(petList);

      const normalizedTrainings: Training[] = (
        trainingsData ?? []
      ).map((training) => ({
        id: training.id,
        title: training.title,
        date: training.date,
        time: training.time,
        duration: training.duration,
        status: training.status ?? "",
        pet_id: training.pet_id,
        skill_id: training.skill_id ?? null,
      }));

      setTrainings(normalizedTrainings);

      // --- Resumen por perro (objetivo + progreso + plan) ---

      const petIds = petList.map((p) => p.id);

      let petSkills: PetSkillRow[] = [];
      let skillsInfo: SkillInfo[] = [];

      if (petIds.length > 0) {
        const { data: petSkillsData } = await supabase
          .from("pet_skills")
          .select("pet_id, skill_id, manual_progress, is_goal")
          .in("pet_id", petIds);

        petSkills = (petSkillsData ?? []).map((row) => ({
          pet_id: row.pet_id,
          skill_id: row.skill_id,
          manual_progress: row.manual_progress,
          is_goal: row.is_goal ?? false,
        }));

        const skillIds = Array.from(
          new Set(petSkills.map((ps) => ps.skill_id))
        );

        if (skillIds.length > 0) {
          const { data: skillsData } = await supabase
            .from("skills")
            .select("id, name, category")
            .in("id", skillIds);

          skillsInfo = skillsData ?? [];
        }
      }

      const skillsMap = new Map(
        skillsInfo.map((s) => [s.id, s])
      );

      const summaries: PetSummary[] = petList.map((pet) => {
        const rows = petSkills.filter(
          (ps) => ps.pet_id === pet.id
        );

        const skillCount = rows.length;

        const averageProgress =
          skillCount === 0
            ? 0
            : Math.round(
                rows.reduce(
                  (sum, r) => sum + (r.manual_progress ?? 0),
                  0
                ) / skillCount
              );

        const goalRow = rows.find((r) => r.is_goal) ?? null;
        const goalSkill = goalRow
          ? skillsMap.get(goalRow.skill_id) ?? null
          : null;
        const goalProgress = goalRow
          ? goalRow.manual_progress ?? 0
          : null;

        // Plan (reglas simples, versión corta para el dashboard)
        let planTitle: string;

        if (skillCount === 0) {
          planTitle = "Añade habilidades para empezar";
        } else if (goalRow && goalSkill) {
          if ((goalProgress ?? 0) >= 100) {
            planTitle = "¡Objetivo conseguido! Elige uno nuevo";
          } else {
            planTitle = `Entrena "${goalSkill.name}"`;
          }
        } else {
          const lowest = [...rows].sort(
            (a, b) =>
              (a.manual_progress ?? 0) -
              (b.manual_progress ?? 0)
          )[0];
          const lowestSkill = skillsMap.get(lowest.skill_id);
          planTitle = lowestSkill
            ? `Refuerza "${lowestSkill.name}"`
            : "Marca un objetivo";
        }

        return {
          petId: pet.id,
          petName: pet.name,
          skillCount,
          averageProgress,
          goalName: goalSkill?.name ?? null,
          goalCategory: goalSkill?.category ?? null,
          goalProgress,
          planTitle,
        };
      });

      setPetSummaries(summaries);

      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  const completedTrainings = trainings.filter(
    (training) => training.status === "completed"
  ).length;

  const pendingTrainings = trainings.filter(
    (training) => training.status !== "completed"
  ).length;

  const totalMinutes = trainings.reduce(
    (total, training) =>
      total + (training.duration ?? 0),
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">
            Cargando dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}

        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">
              🐾 PAWS
            </h1>

            <p className="mt-3 text-slate-600">
              Bienvenido
            </p>

            <p className="text-sm text-slate-500">
              {email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </header>

        {/* ESTADÍSTICAS */}

        <section className="mb-10 grid gap-6 md:grid-cols-5">

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold">
              {pets.length}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Mascotas
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold">
              {trainings.length}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Entrenamientos
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold text-green-600">
              {completedTrainings}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Completados
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold text-orange-600">
              {pendingTrainings}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Pendientes
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold">
              {totalMinutes}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Minutos
            </p>
          </div>

        </section>

        {/* TUS PERROS */}

        <section className="mb-10">

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold">
              Tus perros
            </h2>

            <Link
              href="/pets"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              Ver todas →
            </Link>
          </div>

          {petSummaries.length === 0 ? (

            <div className="rounded-2xl bg-white p-8 shadow">
              <p className="text-slate-500">
                Todavía no tienes mascotas.{" "}
                <Link
                  href="/pets"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Añadir una mascota
                </Link>
              </p>
            </div>

          ) : (

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

              {petSummaries.map((summary) => (
                <Link
                  key={summary.petId}
                  href={`/pets/${summary.petId}`}
                  className="flex flex-col rounded-2xl bg-white p-6 shadow transition hover:shadow-lg"
                >

                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-2xl font-bold">
                      🐶 {summary.petName}
                    </h3>

                    {summary.skillCount > 0 && (
                      <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-blue-600">
                        {summary.averageProgress}%
                      </span>
                    )}
                  </div>

                  {/* Objetivo */}
                  {summary.goalName ? (
                    <div className="mb-4 rounded-xl bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                        🎯 Objetivo
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="font-bold text-amber-900">
                          {summary.goalCategory
                            ? `${summary.goalCategory} — `
                            : ""}
                          {summary.goalName}
                        </p>
                        <p className="shrink-0 font-bold text-amber-600">
                          {summary.goalProgress}%
                        </p>
                      </div>

                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-200">
                        <div
                          className="h-full bg-amber-500"
                          style={{
                            width: `${summary.goalProgress ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Sin objetivo marcado
                      </p>
                    </div>
                  )}

                  {/* Plan */}
                  <div className="mt-auto rounded-xl bg-indigo-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                      🧭 Plan
                    </p>
                    <p className="mt-1 font-semibold text-indigo-900">
                      {summary.planTitle}
                    </p>
                  </div>

                </Link>
              ))}

            </div>
          )}
        </section>

        {/* ACCESOS RÁPIDOS */}

        <section className="mb-10">

          <h2 className="mb-6 text-3xl font-bold">
            Accesos rápidos
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

            <Link
              href="/pets"
              className="rounded-2xl bg-white p-8 shadow transition hover:shadow-lg"
            >
              <h2 className="mb-3 text-2xl font-bold">
                🐶 Mascotas
              </h2>

              <p className="text-slate-600">
                Gestiona tus mascotas.
              </p>
            </Link>

            <Link
              href="/calendar"
              className="rounded-2xl bg-white p-8 shadow transition hover:shadow-lg"
            >
              <h2 className="mb-3 text-2xl font-bold">
                📅 Calendario
              </h2>

              <p className="text-slate-600">
                Organiza tus entrenamientos.
              </p>
            </Link>

            <Link
              href="/skills"
              className="rounded-2xl bg-white p-8 shadow transition hover:shadow-lg"
            >
              <h2 className="mb-3 text-2xl font-bold">
                🎯 Habilidades
              </h2>

              <p className="text-slate-600">
                Explora la biblioteca completa.
              </p>
            </Link>

            <Link
              href="/credits"
              className="rounded-2xl bg-white p-8 shadow transition hover:shadow-lg"
            >
              <h2 className="mb-3 text-2xl font-bold">
                📚 Créditos
              </h2>

              <p className="text-slate-600">
                Fuentes y reconocimientos.
              </p>
            </Link>

          </div>
        </section>

        {/* ACTIVIDAD RECIENTE */}

        <section>

          <div className="mb-6 flex items-center justify-between">

            <h2 className="text-3xl font-bold">
              Actividad reciente
            </h2>

            <Link
              href="/calendar"
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              Ver calendario →
            </Link>

          </div>

          <div className="rounded-2xl bg-white p-8 shadow">

            {trainings.length === 0 ? (

              <p className="text-slate-500">
                Todavía no hay entrenamientos registrados.
              </p>

            ) : (

              <div className="space-y-4">

                {trainings
                  .slice(0, 5)
                  .map((training) => {

                    const pet = pets.find(
                      (item) =>
                        item.id ===
                        training.pet_id
                    );

                    const isCompleted =
                      training.status ===
                      "completed";

                    return (
                      <div
                        key={training.id}
                        className="rounded-xl border border-slate-300 bg-white p-5 transition hover:shadow-md"
                      >

                        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                          <div>

                            <h3 className="text-xl font-bold">
                              {training.title}
                            </h3>

                            <p className="mt-1 text-slate-500">
                              🐶{" "}
                              {pet?.name ??
                                "Mascota"}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">

                              <span>
                                📅{" "}
                                {training.date ??
                                  "Sin fecha"}
                              </span>

                              {training.time && (
                                <span>
                                  🕐{" "}
                                  {training.time.substring(
                                    0,
                                    5
                                  )}
                                </span>
                              )}

                              <span>
                                ⏱{" "}
                                {training.duration ??
                                  0}{" "}
                                min
                              </span>

                            </div>

                          </div>

                          <div className="flex flex-col items-start gap-3 md:items-end">

                            <span
                              className={
                                isCompleted
                                  ? "font-bold text-green-600"
                                  : "font-bold text-orange-600"
                              }
                            >
                              {isCompleted
                                ? "✓ Completado"
                                : "Pendiente"}
                            </span>

                            <Link
                              href={`/trainings/${training.id}/edit`}
                              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
                            >
                              ✏️ Editar
                            </Link>

                          </div>

                        </div>

                      </div>
                    );
                  })}

              </div>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}