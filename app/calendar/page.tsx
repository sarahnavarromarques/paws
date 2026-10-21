"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";

const supabase = createClient();

type Pet = {
  id: number;
  name: string;
};

type Training = {
  id: number;
  pet_id: number;
  skill_id: number | null;
  title: string | null;
  date: string;
  time: string | null;
  duration: number | null;
  status: string | null;
  notes: string | null;
};

type SkillName = {
  id: number;
  name: string;
  name_en: string | null;
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

// Máximo de resultados que se muestran en el buscador
const MAX_RESULTS = 50;

// Valor de "todos" en los filtros
const ALL = "all";

// Textos nuevos del calendario (español / inglés)
const CAL_TEXT = {
  es: {
    pickMonth: "Elegir mes y año",
    previousYear: "Año anterior",
    nextYear: "Año siguiente",
    close: "Cerrar",
    searchTitle: "🔍 Buscar entrenamientos",
    searchPlaceholder: "Escribe un título, una nota, un perro o una habilidad…",
    petFilter: "Perro",
    skillFilter: "Habilidad",
    allPets: "Todos",
    allSkills: "Todas",
    clear: "Limpiar",
    resultsOne: "1 entrenamiento encontrado",
    resultsMany: "{n} entrenamientos encontrados",
    resultsLimited: "Se muestran los {n} más recientes",
    noResults: "No hay entrenamientos que coincidan.",
    goToDay: "Ir al día",
  },
  en: {
    pickMonth: "Choose month and year",
    previousYear: "Previous year",
    nextYear: "Next year",
    close: "Close",
    searchTitle: "🔍 Search trainings",
    searchPlaceholder: "Type a title, a note, a dog or a skill…",
    petFilter: "Dog",
    skillFilter: "Skill",
    allPets: "All",
    allSkills: "All",
    clear: "Clear",
    resultsOne: "1 training found",
    resultsMany: "{n} trainings found",
    resultsLimited: "Showing the {n} most recent",
    noResults: "No trainings match.",
    goToDay: "Go to day",
  },
};

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

// Minúsculas y sin acentos, para buscar sin importar cómo se escriba
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function CalendarPage() {
  const router = useRouter();
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const lang: "es" | "en" = locale === "en" ? "en" : "es";
  const tx = CAL_TEXT[lang];
  const dateLocale = lang === "en" ? "en-US" : "es-ES";

  const [pets, setPets] = useState<Pet[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [skills, setSkills] = useState<SkillName[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    new Date().getDate()
  );

  // Selector de mes y año
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

  // Buscador y filtros
  const [query, setQuery] = useState("");
  const [petFilter, setPetFilter] = useState<string>(ALL);
  const [skillFilter, setSkillFilter] = useState<string>(ALL);

  // Para bajar al detalle del día al elegir un resultado
  const dayDetailRef = useRef<HTMLDivElement | null>(null);

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
        .select("id, pet_id, skill_id, title, date, time, duration, status, notes")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      const loadedTrainings = (trainingsData ?? []) as Training[];

      // Nombres de las habilidades que aparecen en los entrenamientos
      const skillIds = Array.from(
        new Set(
          loadedTrainings
            .map((training) => training.skill_id)
            .filter((id): id is number => id !== null)
        )
      );

      const { data: skillsData } =
        skillIds.length > 0
          ? await supabase
              .from("skills")
              .select("id, name, name_en")
              .in("id", skillIds)
          : { data: [] };

      setPets((petsData ?? []) as Pet[]);
      setTrainings(loadedTrainings);
      setSkills((skillsData ?? []) as SkillName[]);
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

  // Nombres cortos de los meses (Ene, Feb…) para el selector
  const shortMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        capitalizeFirst(
          new Date(2000, i, 1)
            .toLocaleDateString(dateLocale, { month: "short" })
            .replace(".", "")
        )
      ),
    [dateLocale]
  );

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

  // Meses ("AAAA-MM") que tienen algún entrenamiento, para el puntito del selector
  const monthsWithTrainings = useMemo(
    () => new Set(trainings.map((training) => training.date.slice(0, 7))),
    [trainings]
  );

  const petsById = useMemo(
    () => new Map(pets.map((pet) => [pet.id, pet])),
    [pets]
  );

  const skillsById = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills]
  );

  function getSkillName(skillId: number | null): string {
    if (skillId === null) return "";
    const skill = skillsById.get(skillId);
    if (!skill) return "";
    return lang === "en" && skill.name_en ? skill.name_en : skill.name;
  }

  // Habilidades del filtro, ordenadas por nombre en el idioma actual
  const skillOptions = useMemo(
    () =>
      skills
        .map((skill) => ({
          id: skill.id,
          label: lang === "en" && skill.name_en ? skill.name_en : skill.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [skills, lang]
  );

  // --- Buscador ---

  const isSearching =
    query.trim() !== "" || petFilter !== ALL || skillFilter !== ALL;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];

    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);

    return trainings
      .filter((training) => {
        if (petFilter !== ALL && String(training.pet_id) !== petFilter) {
          return false;
        }

        if (skillFilter !== ALL && String(training.skill_id) !== skillFilter) {
          return false;
        }

        if (words.length === 0) return true;

        // Todo el texto del entrenamiento junto, para buscar en cualquier campo
        const skill = training.skill_id !== null ? skillsById.get(training.skill_id) : undefined;
        const haystack = normalize(
          [
            training.title ?? "",
            training.notes ?? "",
            petsById.get(training.pet_id)?.name ?? "",
            skill?.name ?? "",
            skill?.name_en ?? "",
          ].join(" ")
        );

        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => {
        // Del más reciente al más antiguo
        const keyA = `${a.date} ${a.time ?? "00:00"}`;
        const keyB = `${b.date} ${b.time ?? "00:00"}`;
        return keyB.localeCompare(keyA);
      });
  }, [isSearching, query, petFilter, skillFilter, trainings, petsById, skillsById]);

  function clearSearch() {
    setQuery("");
    setPetFilter(ALL);
    setSkillFilter(ALL);
  }

  // Al pulsar un resultado: ir a ese día del calendario
  function goToDate(dateString: string) {
    const [y, m, d] = dateString.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
    setSelectedDay(d);
    setPickerOpen(false);

    window.setTimeout(() => {
      dayDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function formatResultDate(dateString: string) {
    return capitalizeFirst(
      new Date(`${dateString}T00:00:00`).toLocaleDateString(dateLocale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  }

  // --- Calendario ---

  function getTrainingsForDay(day: number) {
    return trainingsByDate.get(toDateString(year, month, day)) ?? [];
  }

  function getPetName(petId: number) {
    return petsById.get(petId)?.name ?? t("defaultPetName");
  }

  function isToday(day: number) {
    const now = new Date();

    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  }

  // Ir a un mes concreto (selecciona hoy si es el mes actual; si no, el día 1)
  function goToMonth(targetYear: number, targetMonth: number) {
    const newDate = new Date(targetYear, targetMonth, 1);
    const now = new Date();

    setCurrentDate(newDate);

    if (
      newDate.getFullYear() === now.getFullYear() &&
      newDate.getMonth() === now.getMonth()
    ) {
      setSelectedDay(now.getDate());
    } else {
      setSelectedDay(1);
    }
  }

  function changeMonth(offset: number) {
    const target = new Date(year, month + offset, 1);
    goToMonth(target.getFullYear(), target.getMonth());
  }

  function goToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now.getDate());
    setPickerOpen(false);
  }

  function togglePicker() {
    if (!pickerOpen) setPickerYear(year);
    setPickerOpen((open) => !open);
  }

  function pickMonth(targetMonth: number) {
    goToMonth(pickerYear, targetMonth);
    setPickerOpen(false);
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

  const shownResults = searchResults.slice(0, MAX_RESULTS);

  return (
    <main data-tour-section="calendar" className="min-h-screen bg-slate-100 p-4 md:p-10">
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

        {/* BUSCADOR CON FILTROS */}

        {!loading && trainings.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow md:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">{tx.searchTitle}</h2>
              {isSearching && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {tx.clear}
                </button>
              )}
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx.searchPlaceholder}
              className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-600">
                {tx.petFilter}
                <select
                  value={petFilter}
                  onChange={(e) => setPetFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 font-normal text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value={ALL}>{tx.allPets}</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={String(pet.id)}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-600">
                {tx.skillFilter}
                <select
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 font-normal text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value={ALL}>{tx.allSkills}</option>
                  {skillOptions.map((skill) => (
                    <option key={skill.id} value={String(skill.id)}>
                      {skill.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* RESULTADOS */}

            {isSearching && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                {searchResults.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <Pawsi pose="triste" size={80} />
                    <p className="text-sm text-slate-500">{tx.noResults}</p>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-sm font-semibold text-slate-500">
                      {searchResults.length === 1
                        ? tx.resultsOne
                        : tx.resultsMany.replace("{n}", String(searchResults.length))}
                      {searchResults.length > MAX_RESULTS &&
                        ` · ${tx.resultsLimited.replace("{n}", String(MAX_RESULTS))}`}
                    </p>

                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {shownResults.map((training) => {
                        const skillName = getSkillName(training.skill_id);
                        return (
                          <button
                            type="button"
                            key={training.id}
                            onClick={() => goToDate(training.date)}
                            className="flex w-full items-stretch gap-3 rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                          >
                            <span
                              className="w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: getPetColor(training.pet_id) }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-slate-900">
                                  {training.title ?? t("defaultTrainingTitle")}
                                </p>
                                <span className="shrink-0 text-xs font-semibold text-blue-600">
                                  {tx.goToDay} →
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                <span>📅 {formatResultDate(training.date)}</span>
                                <span>🐾 {getPetName(training.pet_id)}</span>
                                {skillName && <span>🎯 {skillName}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow md:p-6">
          {/* CONTROLES */}

          <div data-tour="calendar-controls" className="relative mb-4 flex items-center justify-between gap-3">
            {/* Al pulsar el mes se abre el selector de mes y año */}
            <button
              type="button"
              onClick={togglePicker}
              aria-expanded={pickerOpen}
              aria-label={tx.pickMonth}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-2xl font-bold transition hover:bg-slate-100 md:text-3xl"
            >
              {monthName}
              <span
                className={`text-base text-slate-400 transition-transform ${
                  pickerOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

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

            {/* SELECTOR DE MES Y AÑO */}

            {pickerOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y - 1)}
                    aria-label={tx.previousYear}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-lg font-bold hover:bg-slate-200"
                  >
                    ‹
                  </button>
                  <span className="text-xl font-bold text-slate-800">{pickerYear}</span>
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y + 1)}
                    aria-label={tx.nextYear}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-lg font-bold hover:bg-slate-200"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {shortMonths.map((label, monthIndex) => {
                    const key = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
                    const hasTrainings = monthsWithTrainings.has(key);
                    const isCurrent = pickerYear === year && monthIndex === month;

                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => pickMonth(monthIndex)}
                        className={`relative flex flex-col items-center rounded-xl px-2 py-3 text-sm font-semibold transition ${
                          isCurrent
                            ? "bg-slate-900 text-white"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {label}
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full ${
                            hasTrainings
                              ? isCurrent
                                ? "bg-white"
                                : "bg-blue-500"
                              : "bg-transparent"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  {tx.close}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <PawsiLoading text={t("loading")} variant="card" />
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

              <div data-tour="calendar-grid" className="grid grid-cols-7">
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

              <div ref={dayDetailRef} className="mt-6 scroll-mt-20 border-t border-slate-200 pt-4">
                <h3 className="mb-3 text-lg font-bold text-slate-800">
                  {selectedDateLabel}
                </h3>

                {selectedTrainings.length === 0 ? (
                  // Día sin entrenamientos: Pawsi descansando
                  <div className="flex justify-center py-2">
                    <Pawsi pose="espera" size={80} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTrainings.map((training) => {
                      const skillName = getSkillName(training.skill_id);
                      return (
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

                              {skillName && <span>🎯 {skillName}</span>}

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
                      );
                    })}
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