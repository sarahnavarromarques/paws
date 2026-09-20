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
  status: string;
  pet_id: number;
};

type PetSkillRow = {
  pet_id: number;
  skill_id: number;
  auto_progress: number | null;
};

type SkillInfo = {
  id: number;
  name: string;
};

type PetPlan = {
  petId: number;
  petName: string;
  skillCount: number;
  averageProgress: number;
  // Recomendación del día
  todayTrainingId: number | null;
  todayTrainingTitle: string | null;
  reinforceSkillName: string | null;
};

function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [petPlans, setPetPlans] = useState<PetPlan[]>([]);
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
        .select("id, title, date, status, pet_id")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      const petList = petsData ?? [];
      setPets(petList);

      const trainings: Training[] = (trainingsData ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        status: t.status ?? "",
        pet_id: t.pet_id,
      }));

      const pending = trainings.filter(
        (t) => t.status !== "completed"
      );
      setPendingCount(pending.length);

      // --- Habilidades y progreso por perro (auto_progress) ---
      const petIds = petList.map((p) => p.id);

      let petSkills: PetSkillRow[] = [];
      let skillsInfo: SkillInfo[] = [];

      if (petIds.length > 0) {
        const { data: petSkillsData } = await supabase
          .from("pet_skills")
          .select("pet_id, skill_id, auto_progress")
          .in("pet_id", petIds);

        petSkills = (petSkillsData ?? []).map((row) => ({
          pet_id: row.pet_id,
          skill_id: row.skill_id,
          auto_progress: row.auto_progress,
        }));

        const skillIds = Array.from(
          new Set(petSkills.map((ps) => ps.skill_id))
        );

        if (skillIds.length > 0) {
          const { data: skillsData } = await supabase
            .from("skills")
            .select("id, name")
            .in("id", skillIds);

          skillsInfo = skillsData ?? [];
        }
      }

      const skillsMap = new Map(skillsInfo.map((s) => [s.id, s]));
      const today = todayISO();

      const plans: PetPlan[] = petList.map((pet) => {
        const rows = petSkills.filter((ps) => ps.pet_id === pet.id);
        const skillCount = rows.length;

        const averageProgress =
          skillCount === 0
            ? 0
            : Math.round(
                rows.reduce(
                  (sum, r) => sum + (r.auto_progress ?? 0),
                  0
                ) / skillCount
              );

        // 1) ¿Hay un entrenamiento pendiente para HOY?
        const todayTraining =
          pending.find(
            (t) => t.pet_id === pet.id && t.date === today
          ) ?? null;

        // 2) Si no, la habilidad con menor progreso
        let reinforceSkillName: string | null = null;
        if (!todayTraining && skillCount > 0) {
          const lowest = [...rows].sort(
            (a, b) =>
              (a.auto_progress ?? 0) - (b.auto_progress ?? 0)
          )[0];
          reinforceSkillName =
            skillsMap.get(lowest.skill_id)?.name ?? null;
        }

        return {
          petId: pet.id,
          petName: pet.name,
          skillCount,
          averageProgress,
          todayTrainingId: todayTraining?.id ?? null,
          todayTrainingTitle: todayTraining?.title ?? null,
          reinforceSkillName,
        };
      });

      setPetPlans(plans);
      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-500">Cargando...</p>
        </div>
      </main>
    );
  }

  const firstName = email ? email.split("@")[0] : "";

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">

        {/* CABECERA */}
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Hola{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {pets.length}{" "}
              {pets.length === 1 ? "perro" : "perros"}
              {pendingCount > 0
                ? ` · ${pendingCount} pendiente${
                    pendingCount === 1 ? "" : "s"
                  }`
                : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            Cerrar sesión
          </button>
        </header>

        {/* ¿QUÉ ENTRENO HOY? */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            ¿Qué entreno hoy?
          </h2>

          {petPlans.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-slate-500">
                Todavía no tienes perros.{" "}
                <Link
                  href="/pets"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Añadir uno
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {petPlans.map((plan) => {
                // Decide el mensaje y el destino del botón
                let message: string;
                let actionLabel: string;
                let actionHref: string;

                if (plan.skillCount === 0) {
                  message = "Añade habilidades para empezar.";
                  actionLabel = "Ver habilidades";
                  actionHref = `/pets/${plan.petId}/skills`;
                } else if (plan.todayTrainingId) {
                  message = `Tienes pendiente: "${plan.todayTrainingTitle}".`;
                  actionLabel = "Hacer entrenamiento";
                  actionHref = `/trainings/${plan.todayTrainingId}/edit`;
                } else if (plan.reinforceSkillName) {
                  message = `Refuerza "${plan.reinforceSkillName}".`;
                  actionLabel = "Ver habilidades";
                  actionHref = `/pets/${plan.petId}/skills`;
                } else {
                  message = "Todo al día. ¡Buen trabajo!";
                  actionLabel = "Ver perro";
                  actionHref = `/pets/${plan.petId}`;
                }

                return (
                  <div
                    key={plan.petId}
                    className="flex flex-col rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xl font-bold">
                        🐶 {plan.petName}
                      </h3>
                      {plan.skillCount > 0 && (
                        <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-blue-600">
                          {plan.averageProgress}%
                        </span>
                      )}
                    </div>

                    <p className="mb-5 text-slate-600">{message}</p>

                    <Link
                      href={actionHref}
                      className="mt-auto rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
                    >
                      {actionLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ACCESOS */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pets"
              className="rounded-xl bg-white p-4 text-center shadow-sm transition hover:shadow"
            >
              <div className="text-2xl">🐶</div>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Mascotas
              </p>
            </Link>

            <Link
              href="/calendar"
              className="rounded-xl bg-white p-4 text-center shadow-sm transition hover:shadow"
            >
              <div className="text-2xl">📅</div>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Calendario
              </p>
            </Link>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/credits"
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Créditos y fuentes
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}