"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

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

// Colores fijos por mascota (se asignan por id, así no cambian al añadir mascotas)
const PET_COLORS = [
  "#D4A72C", // amarillo
  "#E0445E", // rojo
  "#3B82F6", // azul
  "#22A06B", // verde
  "#8B5CF6", // morado
  "#F97316", // naranja
  "#14B8A6", // turquesa
  "#EC4899", // rosa
  "#64748B", // gris
];

function getPetColor(petId: number) {
  return PET_COLORS[Math.abs(petId) % PET_COLORS.length];
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Pone en mayúscula solo la primera letra ("septiembre de 2026" → "Septiembre de 2026")
function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function CalendarPage() {
  const router = useRouter();
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-ES";

  const [pets, setPets] = useState<Pet[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    new Date().getDate()
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
        .select("id, pet_id, title, date, time, duration, status, notes")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      setPets((petsData ?? []) as Pet[]);
      setTrainings((trainingsData ?? []) as Training[]);
      setLoading(false);
    }

    void loadCalendar();
  }, [router]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = capitalizeFirst(
    currentDate.toLocaleDateString(dateLocale, {
      month: "long",
      year: "numeric",
    })
  );

  const weekdays = t.raw("weekdays") as string[];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [firstWeekday, daysInMonth]);

  // Entrenamientos agrupados por fecha (más rápido que filtrar en cada celda)
  const trainingsByDate = useMemo(() => {
    const map = new Map<string, Training[]>();

    for (const training of trainings) {
      const list = map.get(training.date) ?? [];
      list.push(training);
      map.set(training.date, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    }

    return map;
  }, [trainings]);

  function getTrainingsForDay(day: number) {
    return trainingsByDate.get(toDateString(year, month, day)) ?? [];
  }

  function getPetName(petId: number) {
    return pets.find((pet) => pet.id === petId)?.name ?? t("defaultPetName");
  }

  function isToday(day: number) {
    const now = new Date();

    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  }

  function changeMonth(offset: number) {
    const newDate = new Date(year, month + offset, 1);
    const now = new Date();

    setCurrentDate(newDate);

    // Si volvemos al mes actual, seleccionamos hoy; si no, el día 1
    if (
      newDate.getFullYear() === now.getFullYear() &&
      newDate.getMonth() === now.getMonth()
    ) {
      setSelectedDay(now.getDate());
    } else {
      setSelectedDay(1);
    }
  }

  function goToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now.getDate());
  }

  function openTraining(trainingId: number) {
    router.push(`/trainings/${trainingId}/edit`);
  }

  const selectedTrainings = getTrainingsForDay(selectedDay);

  const selectedDateLabel = capitalizeFirst(
    new Date(year, month, selectedDay).toLocaleDateString(dateLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  );

  // Solo mostramos en la leyenda las mascotas que tienen algo este mes
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const petsThisMonth = pets.filter((pet) =>
    trainings.some(
      (training) =>
        training.pet_id === pet.id && training.date.startsWith(monthPrefix)
    )
  );

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-10">
      <div className="mx-auto max-w-3xl">
        {/* CABECERA */}

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold md:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-2 text-sm text-slate-600 md:text-base">
              {t("subtitle")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:px-5 md:py-3 md:text-base"
          >
            {t("backToDashboard")}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow md:p-6">
          {/* CONTROLES */}

          <div data-tour="calendar-controls" className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold md:text-3xl">{monthName}</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-lg font-bold hover:bg-slate-300"
                aria-label={t("previousMonth")}
              >
                ←
              </button>

              <button
                type="button"
                onClick={goToday}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t("today")}
              </button>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-lg font-bold hover:bg-slate-300"
                aria-label={t("nextMonth")}
              >
                →
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-lg text-slate-500">
              {t("loading")}
            </div>
          ) : (
            <>
              {/* DÍAS DE LA SEMANA */}

              <div className="grid grid-cols-7 border-b border-slate-200 pb-2">
                {weekdays.map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-xs font-semibold uppercase ${
                      index >= 5 ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>

              {/* CUADRÍCULA DEL MES */}

              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return (
                      <div
                        key={index}
                        className="h-14 border-b border-slate-100 md:h-16"
                      />
                    );
                  }

                  const dayTrainings = getTrainingsForDay(day);
                  const isSelected = day === selectedDay;
                  const today = isToday(day);
                  const isWeekend = index % 7 >= 5;

                  let numberClass = isWeekend
                    ? "text-slate-400"
                    : "text-slate-800";

                  if (today && !isSelected) {
                    numberClass = "text-blue-600 font-extrabold";
                  }

                  if (isSelected) {
                    numberClass = today
                      ? "bg-blue-600 text-white"
                      : "bg-slate-900 text-white";
                  }

                  return (
                    <button
                      type="button"
                      key={index}
                      onClick={() => setSelectedDay(day)}
                      className="flex h-14 flex-col items-center justify-start gap-1 border-b border-slate-100 pt-1 transition hover:bg-slate-50 md:h-16"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${numberClass}`}
                      >
                        {day}
                      </span>

                      {/* BARRITAS DE COLOR */}

                      {dayTrainings.length > 0 && (
                        <span className="flex h-1.5 w-8 gap-px overflow-hidden rounded-full md:w-10">
                          {dayTrainings.slice(0, 4).map((training) => (
                            <span
                              key={training.id}
                              className="h-full flex-1"
                              style={{
                                backgroundColor: getPetColor(training.pet_id),
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* LEYENDA DE MASCOTAS */}

              {petsThisMonth.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {petsThisMonth.map((pet) => (
                    <div
                      key={pet.id}
                      className="flex items-center gap-1.5 text-sm text-slate-600"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: getPetColor(pet.id) }}
                      />
                      {pet.name}
                    </div>
                  ))}
                </div>
              )}

              {/* DETALLE DEL DÍA SELECCIONADO */}

              <div className="mt-6 border-t border-slate-200 pt-4">
                <h3 className="mb-3 text-lg font-bold text-slate-800">
                  {selectedDateLabel}
                </h3>

                {selectedTrainings.length === 0 ? (
                  <div className="py-4 text-center text-2xl text-slate-300">
                    —
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTrainings.map((training) => (
                      <button
                        type="button"
                        key={training.id}
                        onClick={() => openTraining(training.id)}
                        className="flex w-full items-stretch gap-3 rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 hover:shadow-sm"
                      >
                        <span
                          className="w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: getPetColor(training.pet_id),
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900">
                              {training.title ?? t("defaultTrainingTitle")}
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                training.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {training.status === "completed"
                                ? t("completedStatus")
                                : t("pendingStatus")}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                            <span>🐾 {getPetName(training.pet_id)}</span>

                            {training.time && (
                              <span>🕐 {training.time.substring(0, 5)}</span>
                            )}

                            {training.duration !== null && (
                              <span>
                                ⏱️ {training.duration} {t("minSuffix")}
                              </span>
                            )}
                          </div>

                          {training.notes && (
                            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                              {training.notes}
                            </p>
                          )}

                          <div className="mt-1 text-xs text-slate-400">
                            {t("clickToEdit")}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}