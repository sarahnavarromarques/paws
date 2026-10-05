"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PawsMascot from "@/components/PawsMascot";
import {
  ONBOARDING_FINISHED_EVENT,
  START_TOUR_EVENT,
} from "@/components/OnboardingTour";

// Pantallas donde la lista nunca se muestra (sin sesión iniciada)
const HIDDEN_PATHS = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/update-password",
];

type Lang = "es" | "en";
type Text = Record<Lang, string>;
type TaskKey = "pet" | "group" | "training" | "completed";
type Progress = Record<TaskKey, boolean>;

const EMPTY_PROGRESS: Progress = {
  pet: false,
  group: false,
  training: false,
  completed: false,
};

const TEXT = {
  title: { es: "Primeros pasos", en: "First steps" },
  subtitle: {
    es: "Se marcan solos cuando los haces",
    en: "They tick off as you do them",
  },
  go: { es: "Ir", en: "Go" },
  close: { es: "Cerrar lista", en: "Close list" },
  collapse: { es: "Plegar", en: "Collapse" },
  taskPet: { es: "Añade tu mascota", en: "Add your pet" },
  taskGroup: {
    es: "Crea un grupo de habilidades",
    en: "Create a skill group",
  },
  taskTraining: {
    es: "Programa tu primer entrenamiento",
    en: "Schedule your first training",
  },
  taskCompleted: {
    es: "Complétalo y deja que la IA calcule el progreso",
    en: "Complete it and let the AI calculate the progress",
  },
  doneTitle: { es: "¡Lo has conseguido! 🎉", en: "You did it! 🎉" },
  doneBody: {
    es: "Ya dominas lo básico de PAWS. A partir de aquí, cada sesión hace que la IA conozca mejor a tu perro.",
    en: "You've mastered the PAWS basics. From now on, every session helps the AI get to know your dog better.",
  },
  doneButton: { es: "¡Genial!", en: "Awesome!" },
} satisfies Record<string, Text>;

const CONFETTI_COLORS = ["#f59e0b", "#ea580c", "#38bdf8", "#22c55e", "#f472b6"];

const CHECKLIST_CSS = `
@keyframes paws-check-pop { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes paws-mini-confetti { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(260px) rotate(540deg); opacity: 0; } }
.paws-check-pop { animation: paws-check-pop 0.3s ease-out both; }
`;

export default function FirstStepsChecklist() {
  const pathname = usePathname();
  const locale = useLocale();
  const lang: Lang = locale === "en" ? "en" : "es";

  const [visible, setVisible] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstPetId, setFirstPetId] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);

  // Consulta los datos reales del usuario para marcar cada tarea
  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setVisible(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, first_steps_dismissed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed || profile.first_steps_dismissed) {
      setVisible(false);
      return;
    }

    const [petsResult, groupsResult, trainingsResult, completedResult] =
      await Promise.all([
        supabase
          .from("pets")
          .select("id")
          .eq("user_id", user.id)
          .order("id", { ascending: true })
          .limit(1),
        supabase
          .from("skill_groups")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("trainings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("trainings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "completed"),
      ]);

    const pets = petsResult.data ?? [];

    setUserId(user.id);
    setFirstPetId(pets.length > 0 ? pets[0].id : null);
    setProgress({
      pet: pets.length > 0,
      group: (groupsResult.count ?? 0) > 0,
      training: (trainingsResult.count ?? 0) > 0,
      completed: (completedResult.count ?? 0) > 0,
    });
    setVisible(true);
  }, []);

  // Volver a comprobar cada vez que se cambia de pantalla
  useEffect(() => {
    if (HIDDEN_PATHS.includes(pathname)) return;
    void load();
  }, [pathname, load]);

  // Volver a comprobar al regresar a la pestaña del navegador
  useEffect(() => {
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // Esconderse mientras el tutorial está en marcha
  useEffect(() => {
    const onStart = () => setTourRunning(true);
    const onFinish = () => {
      setTourRunning(false);
      setExpanded(true);
      void load();
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    window.addEventListener(ONBOARDING_FINISHED_EVENT, onFinish);
    return () => {
      window.removeEventListener(START_TOUR_EVENT, onStart);
      window.removeEventListener(ONBOARDING_FINISHED_EVENT, onFinish);
    };
  }, [load]);

  const dismiss = async () => {
    setVisible(false);
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ first_steps_dismissed: true })
      .eq("id", userId);
  };

  if (!visible || tourRunning || HIDDEN_PATHS.includes(pathname)) return null;

  const petBase = firstPetId !== null ? `/pets/${firstPetId}` : "/pets";

  const tasks: { key: TaskKey; label: Text; href: string }[] = [
    { key: "pet", label: TEXT.taskPet, href: "/pets" },
    {
      key: "group",
      label: TEXT.taskGroup,
      href: firstPetId !== null ? `${petBase}/groups` : "/pets",
    },
    { key: "training", label: TEXT.taskTraining, href: petBase },
    { key: "completed", label: TEXT.taskCompleted, href: petBase },
  ];

  const doneCount = tasks.filter((task) => progress[task.key]).length;
  const allDone = doneCount === tasks.length;
  const percent = Math.round((doneCount / tasks.length) * 100);
  const nextTask = tasks.find((task) => !progress[task.key]);

  // Botón plegado
  if (!expanded && !allDone) {
    return (
      <>
        <style>{CHECKLIST_CSS}</style>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="paws-check-pop fixed bottom-4 right-4 z-[55] flex items-center gap-2 rounded-full bg-[#1e3a5f] py-2 pl-2 pr-4 text-sm font-bold text-white shadow-xl transition hover:scale-105"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
            <PawsMascot size={32} />
          </span>
          {TEXT.title[lang]} · {doneCount}/{tasks.length}
        </button>
      </>
    );
  }

  return (
    <>
      <style>{CHECKLIST_CSS}</style>
      <div className="paws-check-pop fixed bottom-4 right-4 z-[55] w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Cabecera */}
        <div className="relative overflow-hidden bg-[#1e3a5f] p-4 text-white">
          {allDone && (
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className="absolute top-0 block h-2.5 w-1.5 rounded-sm"
                  style={{
                    left: `${(i * 41) % 100}%`,
                    backgroundColor:
                      CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    animation: `paws-mini-confetti ${
                      1.8 + (i % 4) * 0.4
                    }s linear ${(i % 8) * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <PawsMascot size={44} />
              </span>
              <div>
                <p className="text-base font-bold leading-tight">
                  {allDone ? TEXT.doneTitle[lang] : TEXT.title[lang]}
                </p>
                {!allDone && (
                  <p className="text-xs text-sky-200">{TEXT.subtitle[lang]}</p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              {!allDone && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label={TEXT.collapse[lang]}
                  className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="h-5 w-5"
                  >
                    <path strokeLinecap="round" d="M6 12h12" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => void dismiss()}
                aria-label={TEXT.close[lang]}
                className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="relative mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-sky-300 transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs font-bold">
              {doneCount}/{tasks.length}
            </span>
          </div>
        </div>

        {/* Contenido */}
        {allDone ? (
          <div className="p-4">
            <p className="text-sm leading-relaxed text-slate-600">
              {TEXT.doneBody[lang]}
            </p>
            <button
              type="button"
              onClick={() => void dismiss()}
              className="mt-4 w-full rounded-xl bg-[#1e3a5f] py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_4px_0_#0f2540] transition active:translate-y-1 active:shadow-none"
            >
              {TEXT.doneButton[lang]}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const done = progress[task.key];
              const isNext = nextTask?.key === task.key;

              return (
                <li
                  key={task.key}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isNext ? "bg-sky-50" : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      done
                        ? "border-green-500 bg-green-500 text-white"
                        : isNext
                        ? "border-[#1e3a5f]"
                        : "border-slate-300"
                    }`}
                  >
                    {done && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3.5}
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 12l5 5L19 7"
                        />
                      </svg>
                    )}
                  </span>

                  <span
                    className={`flex-1 text-sm ${
                      done
                        ? "text-slate-400 line-through"
                        : "font-semibold text-slate-700"
                    }`}
                  >
                    {task.label[lang]}
                  </span>

                  {!done && isNext && (
                    <Link
                      href={task.href}
                      onClick={() => setExpanded(false)}
                      className="shrink-0 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      {TEXT.go[lang]}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}