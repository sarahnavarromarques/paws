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
  duration: number | null;
  status: string;
  pet_id: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
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
        .select("id, title, date, duration, status, pet_id")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      setPets(petsData ?? []);
      setTrainings(trainingsData ?? []);
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
    (total, training) => total + (training.duration ?? 0),
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">Cargando dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
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
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </header>

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
            <p className="text-5xl font-bold">
              {completedTrainings}
            </p>

            <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Completados
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-5xl font-bold">
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

        <section className="mb-10">
          <h2 className="mb-6 text-3xl font-bold">
            Accesos rápidos
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
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

            <div className="rounded-2xl bg-white p-8 opacity-60 shadow">
              <h2 className="mb-3 text-2xl font-bold">
                🤖 IA
              </h2>

              <p className="text-slate-600">
                Próximamente.
              </p>
            </div>
          </div>
        </section>
                <section>
          <h2 className="mb-6 text-3xl font-bold">
            Actividad reciente
          </h2>

          <div className="rounded-2xl bg-white p-8 shadow">
            {trainings.length === 0 ? (
              <p className="text-slate-500">
                Todavía no hay entrenamientos registrados.
              </p>
            ) : (
              <div className="space-y-4">
                {trainings.slice(0, 5).map((training) => {
                  const pet = pets.find(
                    (item) => item.id === training.pet_id
                  );

                  return (
                    <Link
                      key={training.id}
                      href={`/pets/${training.pet_id}`}
                      className="block rounded-xl border p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold">
                            {training.title}
                          </h3>

                          <p className="text-slate-500">
                            🐶 {pet?.name ?? "Mascota"}
                          </p>

                          <p className="text-sm text-slate-500">
                            📅 {training.date ?? "Sin fecha"}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="font-semibold">
                            ⏱ {training.duration ?? 0} min
                          </p>

                          <p
                            className={
                              training.status === "completed"
                                ? "font-bold text-green-600"
                                : "font-bold text-orange-600"
                            }
                          >
                            {training.status === "completed"
                              ? "✓ Completado"
                              : "Pendiente"}
                          </p>
                        </div>
                      </div>
                    </Link>
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