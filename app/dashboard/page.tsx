"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import { isMastered } from "@/lib/training-order";

const supabase = createClient();

// ---------------------------------------------------------------------------
// Textos nuevos del panel (español / inglés)
// ---------------------------------------------------------------------------

type DashText = {
  todayNone: string;
  todayOne: string;
  todayMany: string;
  streak: string;
  weekTitle: string;
  weekTrainings: string;
  weekMinutes: string;
  mastered: string;
  nextTitle: string;
  nextNone: string;
  nextNoneCta: string;
  start: string;
  today: string;
  tomorrow: string;
  overdueTag: string;
  noDateTag: string;
  sectionsTitle: string;
  petsNone: string;
  petsOne: string;
  petsMany: string;
  calendarNext: string;
  calendarOverdue: string;
  calendarNoDate: string;
  calendarNone: string;
  pending: string;
  clickerTitle: string;
  clickerDetail: string;
  settingsDetail: string;
};

const DASH_TEXT: Record<"es" | "en", DashText> = {
  es: {
    todayNone: "Hoy no tienes entrenamientos.",
    todayOne: "Hoy tienes 1 entrenamiento.",
    todayMany: "Hoy tienes {n} entrenamientos.",
    streak: "Llevas {n} días seguidos entrenando 🔥",
    weekTitle: "Tu semana",
    weekTrainings: "Entrenamientos",
    weekMinutes: "Minutos",
    mastered: "Habilidades dominadas",
    nextTitle: "Próximo entrenamiento",
    nextNone: "No tienes entrenamientos programados.",
    nextNoneCta: "Planificar uno",
    start: "Empezar",
    today: "Hoy",
    tomorrow: "Mañana",
    overdueTag: "Atrasado",
    noDateTag: "Sin fecha",
    sectionsTitle: "Accesos",
    petsNone: "Añade tu primer perro",
    petsOne: "1 perro",
    petsMany: "{n} perros",
    calendarNext: "Próximo: {n}",
    calendarOverdue: "Atrasado: {n}",
    calendarNoDate: "Pendiente sin fecha",
    calendarNone: "Nada programado",
    pending: "{n} pendientes",
    clickerTitle: "Clicker",
    clickerDetail: "Marca el momento exacto con un clic",
    settingsDetail: "Perfil, idioma y calendario del móvil",
  },
  en: {
    todayNone: "No trainings today.",
    todayOne: "You have 1 training today.",
    todayMany: "You have {n} trainings today.",
    streak: "{n} days training in a row 🔥",
    weekTitle: "Your week",
    weekTrainings: "Trainings",
    weekMinutes: "Minutes",
    mastered: "Skills mastered",
    nextTitle: "Next training",
    nextNone: "You have no trainings scheduled.",
    nextNoneCta: "Plan one",
    start: "Start",
    today: "Today",
    tomorrow: "Tomorrow",
    overdueTag: "Overdue",
    noDateTag: "No date",
    sectionsTitle: "Shortcuts",
    petsNone: "Add your first dog",
    petsOne: "1 dog",
    petsMany: "{n} dogs",
    calendarNext: "Next: {n}",
    calendarOverdue: "Overdue: {n}",
    calendarNoDate: "Pending with no date",
    calendarNone: "Nothing scheduled",
    pending: "{n} pending",
    clickerTitle: "Clicker",
    clickerDetail: "Mark the exact moment with a click",
    settingsDetail: "Profile, language and phone calendar",
  },
};

function fill(text: string, value: number | string): string {
  return text.replace("{n}", String(value));
}

// ---------------------------------------------------------------------------
// Fechas (siempre en hora local, formato AAAA-MM-DD como en la base de datos)
// ---------------------------------------------------------------------------

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Lunes de la semana actual
function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(copy, diff);
}

// Orden por fecha y hora (sin hora, al final del día)
function byDateTime(a: TrainingRow, b: TrainingRow): number {
  const keyA = `${a.date ?? ""} ${a.time ?? "99:99"}`;
  const keyB = `${b.date ?? ""} ${b.time ?? "99:99"}`;
  return keyA.localeCompare(keyB);
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type TrainingRow = {
  id: number;
  pet_id: number | null;
  title: string | null;
  date: string | null;
  time: string | null;
  duration: number | null;
  status: string | null;
};

type PetRow = {
  id: number;
  name: string;
  photo: string | null;
};

type NextKind = "overdue" | "upcoming" | "undated";

type NextTraining = {
  id: number;
  kind: NextKind;
  title: string;
  date: string | null;
  time: string;
  petName: string;
  petPhoto: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const lang: "es" | "en" = locale === "en" ? "en" : "es";
  const tx = DASH_TEXT[lang];

  // Nombre para el saludo: nombre → usuario → parte del correo
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [petCount, setPetCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekTrainings, setWeekTrainings] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [nextTraining, setNextTraining] = useState<NextTraining | null>(null);
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

      // --- Perfil (nombre, usuario y foto) ---
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const emailPrefix = user.email ? user.email.split("@")[0] : "";
      const nameFromProfile =
        profile?.first_name?.trim() || profile?.username?.trim() || "";

      setDisplayName(nameFromProfile || emailPrefix);
      setAvatarUrl(profile?.avatar_url ?? null);

      // --- Perros ---
      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name, photo")
        .eq("user_id", user.id);

      const pets: PetRow[] = petsData ?? [];
      setPetCount(pets.length);

      const petsById = new Map(pets.map((pet) => [pet.id, pet]));

      // --- Entrenamientos ---
      const { data: trainingsData } = await supabase
        .from("trainings")
        .select("id, pet_id, title, date, time, duration, status")
        .eq("user_id", user.id);

      const trainings: TrainingRow[] = trainingsData ?? [];

      const now = new Date();
      const todayISO = toISODate(now);
      const weekStartISO = toISODate(startOfWeek(now));

      const completed = trainings.filter((tr) => tr.status === "completed");
      const pending = trainings.filter((tr) => tr.status !== "completed");

      setPendingCount(pending.length);

      // Hoy: entrenamientos pendientes con fecha de hoy
      setTodayCount(pending.filter((tr) => tr.date === todayISO).length);

      // Semana: entrenamientos completados desde el lunes y sus minutos
      const thisWeek = completed.filter(
        (tr) => tr.date !== null && tr.date >= weekStartISO && tr.date <= todayISO
      );
      setWeekTrainings(thisWeek.length);
      setWeekMinutes(
        thisWeek.reduce((sum, tr) => sum + (tr.duration ?? 0), 0)
      );

      // Racha: días seguidos con algún entrenamiento completado
      // (cuenta desde hoy, o desde ayer si hoy aún no has entrenado)
      const completedDays = new Set(
        completed
          .map((tr) => tr.date)
          .filter((date): date is string => date !== null)
      );

      let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (!completedDays.has(toISODate(cursor))) {
        cursor = addDays(cursor, -1);
      }

      let days = 0;
      while (completedDays.has(toISODate(cursor))) {
        days++;
        cursor = addDays(cursor, -1);
      }
      setStreak(days);

      // Tarjeta azul: atrasado más antiguo → próximo desde hoy → sin fecha
      const overdue = pending
        .filter((tr) => tr.date !== null && tr.date < todayISO)
        .sort(byDateTime);

      const upcoming = pending
        .filter((tr) => tr.date !== null && tr.date >= todayISO)
        .sort(byDateTime);

      const undated = pending.filter((tr) => tr.date === null);

      let chosen: TrainingRow | undefined;
      let kind: NextKind = "upcoming";

      if (overdue.length > 0) {
        chosen = overdue[0];
        kind = "overdue";
      } else if (upcoming.length > 0) {
        chosen = upcoming[0];
        kind = "upcoming";
      } else if (undated.length > 0) {
        chosen = undated[0];
        kind = "undated";
      }

      if (chosen) {
        const pet =
          chosen.pet_id !== null ? petsById.get(chosen.pet_id) : undefined;
        setNextTraining({
          id: chosen.id,
          kind,
          title: chosen.title ?? "",
          date: chosen.date,
          time: chosen.time ? chosen.time.substring(0, 5) : "",
          petName: pet?.name ?? "",
          petPhoto: pet?.photo ?? null,
        });
      } else {
        setNextTraining(null);
      }

      // --- Habilidades dominadas (todas las de tus perros) ---
      if (pets.length > 0) {
        const { data: petSkillsData } = await supabase
          .from("pet_skills")
          .select("auto_progress")
          .in(
            "pet_id",
            pets.map((pet) => pet.id)
          );

        setMasteredCount(
          (petSkillsData ?? []).filter((row) =>
            isMastered(row.auto_progress ?? 0)
          ).length
        );
      } else {
        setMasteredCount(0);
      }

      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // "Hoy", "Mañana" o la fecha corta (p. ej. "jue, 23 oct"), con la hora si la hay
  function formatWhen(date: string | null, time: string): string {
    if (!date) {
      return time;
    }

    const now = new Date();
    const todayISO = toISODate(now);
    const tomorrowISO = toISODate(addDays(now, 1));

    let day: string;
    if (date === todayISO) {
      day = tx.today;
    } else if (date === tomorrowISO) {
      day = tx.tomorrow;
    } else {
      day = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(`${date}T00:00:00`));
    }

    return time ? `${day} · ${time}` : day;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 pt-10">
          <Pawsi pose="espera" size={110} float />
          <p className="text-slate-500">{t("loading")}</p>
        </div>
      </main>
    );
  }

  const avatarInitial = (displayName.trim()[0] ?? "").toUpperCase();

  const todayText =
    todayCount === 0
      ? tx.todayNone
      : todayCount === 1
      ? tx.todayOne
      : fill(tx.todayMany, todayCount);

  const petsDetail =
    petCount === 0
      ? tx.petsNone
      : petCount === 1
      ? tx.petsOne
      : fill(tx.petsMany, petCount);

  // Texto de la tarjeta "Calendario"
  let calendarWhen: string;
  if (!nextTraining) {
    calendarWhen = tx.calendarNone;
  } else if (nextTraining.kind === "overdue") {
    calendarWhen = fill(
      tx.calendarOverdue,
      formatWhen(nextTraining.date, nextTraining.time)
    );
  } else if (nextTraining.kind === "undated") {
    calendarWhen = tx.calendarNoDate;
  } else {
    calendarWhen = fill(
      tx.calendarNext,
      formatWhen(nextTraining.date, nextTraining.time)
    );
  }

  const calendarDetail =
    pendingCount > 0
      ? `${fill(tx.pending, pendingCount)} · ${calendarWhen}`
      : calendarWhen;

  // Línea de fecha de la tarjeta azul
  const nextWhen = nextTraining ? formatWhen(nextTraining.date, nextTraining.time) : "";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 p-4 md:p-10">
      <div className="mx-auto max-w-5xl">

        {/* Arriba a la derecha: cerrar sesión.
            El hueco de la derecha deja sitio a la bandera de idioma,
            que ahora sale en todas las páginas desde app/layout.tsx */}
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            {t("logout")}
          </button>
          <div className="h-9 w-[76px] shrink-0" aria-hidden="true" />
        </div>

        {/* 1. TARJETA DE BIENVENIDA CON PAWSI */}
        <header className="relative mb-8 flex items-center justify-between gap-4 overflow-hidden rounded-3xl bg-white p-5 shadow-sm md:p-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/settings"
              aria-label={t("settings")}
              className="shrink-0 transition hover:opacity-80"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-16 w-16 rounded-full border-4 border-blue-50 object-cover shadow-md"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-blue-50 bg-blue-100 text-2xl font-bold text-blue-700 shadow-md">
                  {avatarInitial || "🙂"}
                </div>
              )}
            </Link>

            <div className="min-w-0">
              <h1 className="break-words text-3xl font-extrabold tracking-tight md:text-4xl">
                {t("greeting", { name: displayName ? `, ${displayName}` : "" })}
              </h1>
              <p className="mt-1 text-slate-600">
                {todayText}
                {streak >= 2 && (
                  <span className="font-semibold text-orange-600">
                    {" · "}
                    {fill(tx.streak, streak)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pawsi saludando (más pequeño en el móvil) */}
          <div className="shrink-0">
            <Pawsi pose="hola" size={90} className="md:hidden" />
            <Pawsi pose="hola" size={140} float className="hidden md:block" />
          </div>
        </header>

        {/* SIN PERROS: invitación a añadir el primero */}
        {petCount === 0 && (
          <section className="mb-8">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm">
              <Pawsi pose="espera" size={110} />
              <p className="text-slate-500">
                {t("noPets")}
                <Link
                  href="/pets"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  {t("addOne")}
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* 2. TU SEMANA */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">
            {tx.weekTitle}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm md:p-6">
              <p className="text-3xl font-extrabold text-blue-600 md:text-4xl">
                {weekTrainings}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {tx.weekTrainings}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm md:p-6">
              <p className="text-3xl font-extrabold text-teal-600 md:text-4xl">
                {weekMinutes}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {tx.weekMinutes}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm md:p-6">
              <p className="text-3xl font-extrabold text-amber-500 md:text-4xl">
                {masteredCount}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {tx.mastered}
              </p>
            </div>
          </div>
        </section>

        {/* 3. PRÓXIMO ENTRENAMIENTO */}
        <section className="mb-8">
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-100">
                {tx.nextTitle}
              </p>
              {nextTraining?.kind === "overdue" && (
                <span className="rounded-full bg-orange-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {tx.overdueTag}
                </span>
              )}
              {nextTraining?.kind === "undated" && (
                <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {tx.noDateTag}
                </span>
              )}
            </div>

            {nextTraining ? (
              <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  {nextTraining.petPhoto ? (
                    <img
                      src={nextTraining.petPhoto}
                      alt={nextTraining.petName}
                      className="h-16 w-16 shrink-0 rounded-full border-4 border-white/40 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-3xl">
                      🐶
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="break-words text-2xl font-bold">
                      {nextTraining.title || nextTraining.petName}
                    </p>
                    <p className="mt-1 text-blue-100">
                      {[
                        nextTraining.title ? nextTraining.petName : "",
                        nextWhen,
                      ]
                        .filter((part) => part !== "")
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/trainings/${nextTraining.id}/edit`}
                  className="shrink-0 rounded-xl bg-white px-6 py-3 text-center font-bold text-blue-700 shadow transition hover:bg-blue-50"
                >
                  {tx.start} →
                </Link>
              </div>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                <div className="flex flex-col items-center gap-4 md:flex-row">
                  <Pawsi pose="espera" size={100} />
                  <p className="text-xl font-semibold">{tx.nextNone}</p>
                </div>
                <Link
                  href="/calendar"
                  className="shrink-0 rounded-xl bg-white px-6 py-3 text-center font-bold text-blue-700 shadow transition hover:bg-blue-50"
                >
                  {tx.nextNoneCta} →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 4. ACCESOS: tarjetas horizontales a lo ancho */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">
            {tx.sectionsTitle}
          </h2>

          <div className="flex flex-col gap-3">
            <Link
              href="/pets"
              className="group flex items-center gap-4 rounded-2xl border-l-4 border-blue-500 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-3xl">
                🐶
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-800">{t("pets")}</p>
                <p className="text-sm text-slate-500">{petsDetail}</p>
              </div>
              <span className="text-2xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500">
                →
              </span>
            </Link>

            <Link
              href="/calendar"
              className="group flex items-center gap-4 rounded-2xl border-l-4 border-purple-500 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-100 text-3xl">
                📅
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-800">{t("calendar")}</p>
                <p className="text-sm text-slate-500">{calendarDetail}</p>
              </div>
              <span className="text-2xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-purple-500">
                →
              </span>
            </Link>

            <Link
              href="/clicker"
              className="group flex items-center gap-4 rounded-2xl border-l-4 border-amber-400 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl">
                🔘
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-800">{tx.clickerTitle}</p>
                <p className="text-sm text-slate-500">{tx.clickerDetail}</p>
              </div>
              <span className="text-2xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-amber-500">
                →
              </span>
            </Link>

            <Link
              href="/settings"
              className="group flex items-center gap-4 rounded-2xl border-l-4 border-slate-400 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-3xl">
                ⚙️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-800">{t("settings")}</p>
                <p className="text-sm text-slate-500">{tx.settingsDetail}</p>
              </div>
              <span className="text-2xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500">
                →
              </span>
            </Link>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/credits"
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              {t("credits")}
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}