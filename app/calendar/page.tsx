"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Pet = {
  id: number;
  name: string;
};

type Training = {
  id: number;
  pet_id: number;
  title: string | null;
  date: string;
  time: string | null;
  duration: number | null;
  status: string | null;
  notes: string | null;
};

export default function CalendarPage() {
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(
    () => new Date()
  );

  useEffect(() => {
    async function loadCalendar() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      const { data: trainingsData } = await supabase
        .from("trainings")
        .select(
          "id, pet_id, title, date, time, duration, status, notes"
        )
        .eq("user_id", user.id)
        .order("date", {
          ascending: true,
        });

      setPets((petsData ?? []) as Pet[]);
      setTrainings((trainingsData ?? []) as Training[]);
      setLoading(false);
    }

    void loadCalendar();
  }, [router]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString(
    "es-ES",
    {
      month: "long",
      year: "numeric",
    }
  );

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();

  const firstWeekday =
    (firstDay.getDay() + 6) % 7;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push(day);
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [firstWeekday, daysInMonth]);

  function previousMonth() {
    setCurrentDate(
      new Date(year, month - 1, 1)
    );
  }

  function nextMonth() {
    setCurrentDate(
      new Date(year, month + 1, 1)
    );
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function getTrainingsForDay(day: number) {
    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return trainings.filter(
      (training) =>
        training.date === dateString
    );
  }

  function getPetName(petId: number) {
    return (
      pets.find(
        (pet) => pet.id === petId
      )?.name ?? "Mascota"
    );
  }

  function isToday(day: number) {
    const now = new Date();

    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  }

  function openTraining(trainingId: number) {
    router.push(
      `/trainings/${trainingId}/edit`
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">

        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-5xl font-extrabold">
              📅 Calendario
            </h1>

            <p className="mt-3 text-slate-600">
              Organiza y consulta los
              entrenamientos de tus mascotas.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            className="rounded-lg bg-slate-700 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            ← Dashboard
          </button>

        </div>

        <div className="rounded-2xl bg-white p-5 shadow md:p-8">

          {/* CONTROLES */}

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={previousMonth}
                className="rounded-lg bg-slate-200 px-4 py-2 text-xl font-bold hover:bg-slate-300"
              >
                ←
              </button>

              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg bg-slate-200 px-4 py-2 text-xl font-bold hover:bg-slate-300"
              >
                →
              </button>

              <button
                type="button"
                onClick={goToday}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Hoy
              </button>

            </div>

            <h2 className="text-3xl font-bold capitalize">
              {monthName}
            </h2>

          </div>

          {/* CALENDARIO */}

          {loading ? (
            <div className="py-16 text-center text-lg text-slate-500">
              Cargando calendario...
            </div>
          ) : (
            <div className="overflow-x-auto">

              <div className="min-w-[900px]">

                <div className="grid grid-cols-7 border-l border-t border-slate-200">

                  {[
                    "Lunes",
                    "Martes",
                    "Miércoles",
                    "Jueves",
                    "Viernes",
                    "Sábado",
                    "Domingo",
                  ].map((day) => (
                    <div
                      key={day}
                      className="border-b border-r border-slate-200 bg-slate-100 p-3 text-center font-bold text-slate-700"
                    >
                      {day}
                    </div>
                  ))}

                  {calendarDays.map(
                    (day, index) => {
                      const dayTrainings =
                        day === null
                          ? []
                          : getTrainingsForDay(day);

                      return (
                        <div
                          key={index}
                          className="min-h-40 border-b border-r border-slate-200 p-2"
                        >

                          {day !== null && (
                            <>
                              {/* NÚMERO DEL DÍA */}

                              <div
                                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                  isToday(day)
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-700"
                                }`}
                              >
                                {day}
                              </div>

                              {/* ENTRENAMIENTOS */}

                              <div className="space-y-2">

                                {dayTrainings.map(
                                  (training) => (
                                    <button
                                      type="button"
                                      key={training.id}
                                      onClick={() =>
                                        openTraining(
                                          training.id
                                        )
                                      }
                                      className={`w-full rounded-lg p-2 text-left text-xs transition hover:scale-[1.02] hover:shadow-md ${
                                        training.status ===
                                        "completed"
                                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                                          : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                                      }`}
                                    >

                                      <div className="font-bold">
                                        {training.title ??
                                          "Entrenamiento"}
                                      </div>

                                      <div>
                                        🐾{" "}
                                        {getPetName(
                                          training.pet_id
                                        )}
                                      </div>

                                      {training.time && (
                                        <div>
                                          🕐{" "}
                                          {training.time.substring(
                                            0,
                                            5
                                          )}
                                        </div>
                                      )}

                                      {training.duration !==
                                        null && (
                                        <div>
                                          ⏱️{" "}
                                          {
                                            training.duration
                                          }{" "}
                                          min
                                        </div>
                                      )}

                                      <div className="mt-1 font-semibold">
                                        {training.status ===
                                        "completed"
                                          ? "✓ Completado"
                                          : "Pendiente"}
                                      </div>

                                      <div className="mt-1 text-[10px] opacity-60">
                                        Pulsa para editar
                                      </div>

                                    </button>
                                  )
                                )}

                              </div>
                            </>
                          )}

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            </div>
          )}

        </div>
      </div>
    </main>
  );
}