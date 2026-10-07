"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { saveUserLanguage, type AppLanguage } from "@/lib/language";
import PawsMascot from "@/components/PawsMascot";

// Pantallas donde el tutorial nunca se muestra (sin sesión iniciada)
const HIDDEN_PATHS = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/update-password",
];

const STEP_KEY = "paws-onboarding-step";
const DONE_KEY = "paws-onboarding-done";
const LANG_KEY = "paws-onboarding-lang-chosen";
export const START_TOUR_EVENT = "paws:start-onboarding";
export const ONBOARDING_FINISHED_EVENT = "paws:onboarding-finished";

// Llamar a esta función (por ejemplo desde Ajustes) vuelve a lanzar el tutorial
export function startOnboardingTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

type Lang = "es" | "en";
type Text = Record<Lang, string>;
type StepKind = "intro" | "loop" | "spot" | "finish";

type TourStep = {
  id: string;
  kind: StepKind;
  route: (petId: number | null) => string;
  icon: string;
  title: Text;
  body: Text;
  needsPet?: boolean;
  target?: string; // valor del atributo data-tour del elemento a iluminar
  tap?: boolean; // muestra "Toca aquí" sobre el elemento
  openMenu?: boolean; // el menú lateral debe estar abierto en este paso
};

const STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "intro",
    route: () => "/dashboard",
    icon: "👋",
    title: {
      es: "¡Hola! Soy Paws, tu ayudante de entrenamiento",
      en: "Hi! I'm Paws, your training buddy",
    },
    body: {
      es: "Te enseño en un par de minutos cómo funciona la app. Puedes saltarlo cuando quieras y repetirlo desde Ajustes.",
      en: "I'll show you how the app works in a couple of minutes. You can skip it any time and replay it from Settings.",
    },
  },
  {
    id: "loop",
    kind: "loop",
    route: () => "/dashboard",
    icon: "🔄",
    title: {
      es: "Así aprende PAWS contigo",
      en: "This is how PAWS learns with you",
    },
    body: {
      es: "Cada sesión que registras enseña algo nuevo a PAWS sobre tu perro. Con eso, la IA te propone el siguiente paso, y vuelta a empezar.",
      en: "Every session you log teaches PAWS something new about your dog. With that, the AI suggests the next step, and the cycle starts again.",
    },
  },
  {
    id: "dashboard",
    kind: "spot",
    route: () => "/dashboard",
    icon: "🏠",
    title: { es: "Tu inicio", en: "Your home" },
    body: {
      es: "Esta es la primera pantalla que verás al entrar. Aquí tienes de un vistazo lo más importante de tus mascotas.",
      en: "This is the first screen you'll see when you log in. It gives you an overview of what matters most about your pets.",
    },
  },
  {
    id: "menu",
    kind: "spot",
    route: () => "/dashboard",
    target: "menu-button",
    tap: true,
    icon: "☰",
    title: { es: "Abre el menú", en: "Open the menu" },
    body: {
      es: "Toca este botón para abrir el menú. Desde aquí llegas a cualquier parte de la app.",
      en: "Tap this button to open the menu. From here you can reach any part of the app.",
    },
  },
  {
    id: "menu-open",
    kind: "spot",
    route: () => "/dashboard",
    target: "sidebar-panel",
    openMenu: true,
    icon: "🧭",
    title: { es: "Todo a mano", en: "Everything at hand" },
    body: {
      es: "Inicio, Mascotas, Calendario, Ajustes y Créditos. Debajo de Mascotas aparecen tus perros: despliega cada uno para ir a sus Habilidades, Grupos o Editar.",
      en: "Home, Pets, Calendar, Settings and Credits. Under Pets you'll find your dogs: expand each one to reach its Skills, Groups or Edit.",
    },
  },
  {
    id: "pets",
    kind: "spot",
    route: () => "/pets",
    target: "add-pet",
    icon: "🐶",
    title: { es: "Tus mascotas", en: "Your pets" },
    body: {
      es: "Aquí están todas tus mascotas. Desde esta pantalla añades una nueva y entras en su ficha.",
      en: "All your pets live here. From this screen you add a new one and open its profile.",
    },
  },
  {
    id: "pet-profile",
    kind: "spot",
    needsPet: true,
    route: (id) => `/pets/${id}`,
    icon: "🪪",
    title: { es: "La ficha de tu mascota", en: "Your pet's profile" },
    body: {
      es: "En PAWS todo gira alrededor de tu mascota. En su ficha tienes sus datos, sus entrenamientos y su evolución.",
      en: "In PAWS everything revolves around your pet. Its profile holds its details, its trainings and its progress.",
    },
  },
  {
    id: "skills",
    kind: "spot",
    needsPet: true,
    route: (id) => `/pets/${id}/skills`,
    target: "skills-filters",
    icon: "🎯",
    title: { es: "Habilidades", en: "Skills" },
    body: {
      es: "Cada habilidad tiene viñetas con los pasos para enseñarla y los errores más frecuentes. Su progreso lo calcula la IA con tus entrenamientos: no tienes que tocarlo a mano.",
      en: "Each skill has illustrated steps to teach it and the most common mistakes. Its progress is calculated by the AI from your trainings: no need to edit it by hand.",
    },
  },
  {
    id: "groups",
    kind: "spot",
    needsPet: true,
    route: (id) => `/pets/${id}/groups`,
    target: "groups-create",
    icon: "🧩",
    title: { es: "Grupos de habilidades", en: "Skill groups" },
    body: {
      es: "Junta habilidades en grupos para entrenarlas a la vez. Si no se te ocurre un nombre, la IA te sugiere uno.",
      en: "Put skills into groups to train them together. If you can't think of a name, the AI suggests one.",
    },
  },
  {
    id: "training",
    kind: "spot",
    needsPet: true,
    route: (id) => `/pets/${id}`,
    icon: "🏋️",
    title: { es: "Cómo se entrena con PAWS", en: "How training works in PAWS" },
    body: {
      es: "1) Crea un entrenamiento eligiendo grupo y habilidad. 2) Entrena con tu perro. 3) Márcalo como completado y responde 4 preguntas rápidas: intentos, aciertos, distracción y ánimo. 4) La IA actualiza el progreso y te dice qué hacer después.",
      en: "1) Create a training by choosing a group and a skill. 2) Train with your dog. 3) Mark it as completed and answer 4 quick questions: attempts, successes, distraction and mood. 4) The AI updates the progress and tells you what to do next.",
    },
  },
  {
    id: "analyze",
    kind: "spot",
    needsPet: true,
    route: (id) => `/pets/${id}`,
    target: "analyze-progress",
    icon: "📊",
    title: { es: "Analizar progreso", en: "Analyze progress" },
    body: {
      es: "La IA estudia el historial de tu perro y te da un resumen, los patrones que detecta y qué trabajar después.",
      en: "The AI studies your dog's history and gives you a summary, the patterns it detects and what to work on next.",
    },
  },
  {
    id: "calendar",
    kind: "spot",
    route: () => "/calendar",
    target: "calendar-controls",
    icon: "📅",
    title: { es: "Calendario", en: "Calendar" },
    body: {
      es: "Aquí ves tus entrenamientos organizados por fechas para planificar la semana.",
      en: "Here you see your trainings organized by date so you can plan your week.",
    },
  },
  {
    id: "settings",
    kind: "spot",
    route: () => "/settings",
    target: "replay-tour",
    icon: "⚙️",
    title: { es: "Ajustes", en: "Settings" },
    body: {
      es: "Tu perfil, foto, idioma, correo y contraseña. Desde aquí también puedes volver a ver este tutorial.",
      en: "Your profile, photo, language, email and password. You can also replay this tutorial from here.",
    },
  },
  {
    id: "finish",
    kind: "finish",
    route: () => "/dashboard",
    icon: "🎉",
    title: { es: "¡Ya estás listo!", en: "You're all set!" },
    body: {
      es: "Te he dejado una lista de primeros pasos. Se irá marcando sola a medida que los hagas.",
      en: "I've left you a first-steps checklist. It will tick itself off as you complete each step.",
    },
  },
];

const LOOP_NODES: { icon: string; label: Text }[] = [
  { icon: "🐶", label: { es: "Mascota", en: "Pet" } },
  { icon: "🎯", label: { es: "Objetivo", en: "Goal" } },
  { icon: "📅", label: { es: "Plan", en: "Plan" } },
  { icon: "🏋️", label: { es: "Sesión", en: "Session" } },
  { icon: "📝", label: { es: "Registro", en: "Log" } },
  { icon: "🤖", label: { es: "IA", en: "AI" } },
];

// Opciones de la pantalla "Elige tu idioma" (se muestran en su propio idioma)
const LANGUAGE_OPTIONS: { value: AppLanguage; flag: string; name: string }[] = [
  { value: "es", flag: "🇪🇸", name: "Español" },
  { value: "en", flag: "🇬🇧", name: "English" },
];

const UI = {
  continue: { es: "Continuar", en: "Continue" },
  next: { es: "Siguiente", en: "Next" },
  back: { es: "Atrás", en: "Back" },
  skip: { es: "Saltar tutorial", en: "Skip tutorial" },
  close: { es: "Cerrar tutorial", en: "Close tutorial" },
  tapHere: { es: "Toca aquí", en: "Tap here" },
  finish: { es: "¡A entrenar!", en: "Let's train!" },
  noPet: {
    es: "Todavía no tienes ninguna mascota. Añade la primera en esta pantalla; el tutorial seguirá solo cuando la crees.",
    en: "You don't have any pets yet. Add your first one on this screen; the tutorial will continue once you create it.",
  },
  created: { es: "Ya la he creado", en: "I've created it" },
  withoutPet: { es: "Seguir sin mascota", en: "Continue without a pet" },
  stillNoPet: {
    es: "Aún no encuentro ninguna mascota. Créala y vuelve a pulsar.",
    en: "I still can't find any pet. Create it and tap again.",
  },
} satisfies Record<string, Text>;

const NAVY = "#1e3a5f";
const CARD_HEIGHT = 300;

// Animaciones del tutorial
const TOUR_CSS = `
@keyframes paws-pop { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes paws-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes paws-spin { to { transform: rotate(360deg); } }
@keyframes paws-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes paws-confetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; } }
.paws-pop { animation: paws-pop 0.35s ease-out both; }
.paws-fade { animation: paws-fade 0.3s ease-out both; }
.paws-spin { animation: paws-spin 24s linear infinite; }
.paws-float { animation: paws-float 2.6s ease-in-out infinite; }
`;

type Rect = { top: number; left: number; width: number; height: number };

// ---------- Utilidades ----------

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // sin almacenamiento disponible: no pasa nada
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // sin almacenamiento disponible: no pasa nada
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Busca el siguiente paso válido (salta los que necesitan mascota si no hay)
function findValidIndex(from: number, dir: 1 | -1, petId: number | null) {
  let i = from;
  while (i >= 0 && i < STEPS.length) {
    if (!STEPS[i].needsPet || petId !== null) return i;
    i += dir;
  }
  return -1;
}

async function loadFirstPet(userId: string): Promise<number | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("pets")
    .select("id")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

function isMenuOpen() {
  const panel = document.querySelector('[data-tour="sidebar-panel"]');
  return panel?.getAttribute("aria-hidden") === "false";
}

function closeMenu() {
  if (isMenuOpen()) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }
}

// Decide dónde colocar la tarjeta respecto al elemento iluminado
function computeCardPosition(rect: Rect): {
  style: CSSProperties;
  arrow: CSSProperties | null;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(360, vw - 32);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = clamp(centerX - cardWidth / 2, 16, vw - cardWidth - 16);
  const arrowX = clamp(centerX - left - 8, 20, cardWidth - 36);

  if (rect.top + rect.height + CARD_HEIGHT + 24 < vh) {
    return {
      style: { top: rect.top + rect.height + 18, left },
      arrow: { top: -7, left: arrowX },
    };
  }

  if (rect.top - CARD_HEIGHT - 24 > 0) {
    return {
      style: { top: rect.top - 18, left, transform: "translateY(-100%)" },
      arrow: { bottom: -7, left: arrowX },
    };
  }

  if (rect.left + rect.width + cardWidth + 40 < vw) {
    const top = clamp(centerY - CARD_HEIGHT / 2, 16, vh - CARD_HEIGHT - 16);
    return {
      style: { top, left: rect.left + rect.width + 18 },
      arrow: { left: -7, top: clamp(centerY - top - 8, 20, CARD_HEIGHT - 36) },
    };
  }

  return { style: { bottom: 16, left }, arrow: null };
}

// ---------- Piezas visuales ----------

function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="relative max-w-sm rounded-2xl border-2 border-gray-200 bg-white px-5 py-3 text-center text-lg font-semibold text-gray-800 shadow-sm">
      {children}
      <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-gray-200 bg-white" />
    </div>
  );
}

function LoopDiagram({ lang }: { lang: Lang }) {
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveNode((n) => (n + 1) % LOOP_NODES.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  const size = 280;
  const radius = 108;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        className="paws-spin absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <PawsMascot size={92} />
      </div>

      {LOOP_NODES.map((node, i) => {
        const angle = ((-90 + (360 / LOOP_NODES.length) * i) * Math.PI) / 180;
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);
        const isActive = i === activeNode;

        return (
          <div
            key={node.label.es}
            className="absolute flex w-20 flex-col items-center transition-all duration-500"
            style={{
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : 0.9})`,
              opacity: isActive ? 1 : 0.65,
            }}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-md transition-colors duration-500 ${
                isActive ? "bg-[#1e3a5f] ring-4 ring-sky-200" : "bg-white"
              }`}
            >
              {node.icon}
            </div>
            <span
              className={`mt-1 text-xs font-bold ${
                isActive ? "text-[#1e3a5f]" : "text-gray-500"
              }`}
            >
              {node.label[lang]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const CONFETTI_COLORS = [
  "#1e3a5f",
  "#f59e0b",
  "#ea580c",
  "#38bdf8",
  "#22c55e",
  "#f472b6",
];

function Confetti() {
  const pieces = Array.from({ length: 48 }, (_, i) => i);
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `paws-confetti ${2.5 + (i % 5) * 0.4}s linear ${
              (i % 12) * 0.15
            }s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ---------- Componente principal ----------

export default function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const lang: Lang = locale === "en" ? "en" : "es";

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [checking, setChecking] = useState(false);
  const [petMessage, setPetMessage] = useState(false);
  const [choosingLanguage, setChoosingLanguage] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const checkedRef = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);

  const step = STEPS[stepIndex];
  const waitingForPet = active && step.id === "pets" && petId === null;

  // 1) Al entrar con sesión iniciada, decidir si hay que mostrar el tutorial
  useEffect(() => {
    if (checkedRef.current) return;
    if (HIDDEN_PATHS.includes(pathname)) return;
    checkedRef.current = true;

    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        checkedRef.current = false;
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) return;
      if (readStorage(DONE_KEY) === user.id) return;

      const firstPet = await loadFirstPet(user.id);
      const saved = Number(readStorage(STEP_KEY));
      const start =
        Number.isInteger(saved) && saved >= 0 && saved < STEPS.length
          ? saved
          : 0;
      const validStart = findValidIndex(start, 1, firstPet);

      // Elegir idioma solo al empezar desde el principio y si aún no se eligió
      const needsLanguage = start === 0 && readStorage(LANG_KEY) !== user.id;

      setUserId(user.id);
      setPetId(firstPet);
      setStepIndex(validStart === -1 ? 0 : validStart);
      setChoosingLanguage(needsLanguage);
      setActive(true);
    };

    init();
  }, [pathname]);

  // 2) Permitir relanzar el tutorial desde otras pantallas (Ajustes)
  useEffect(() => {
    const onStart = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      removeStorage(DONE_KEY);
      const firstPet = await loadFirstPet(user.id);

      setUserId(user.id);
      setPetId(firstPet);
      setPetMessage(false);
      setStepIndex(0);
      setChoosingLanguage(false);
      setActive(true);
    };

    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, []);

  // 3) Guardar el paso actual para continuar si se recarga la página
  useEffect(() => {
    if (!active) return;
    writeStorage(STEP_KEY, String(stepIndex));
  }, [active, stepIndex]);

  // 4) Si el usuario crea su primera mascota y la app le lleva a su ficha, continuar
  useEffect(() => {
    if (!waitingForPet) return;
    const match = pathname.match(/^\/pets\/(\d+)/);
    if (!match) return;
    const newPetId = Number(match[1]);
    setPetId(newPetId);
    setPetMessage(false);
    const next = findValidIndex(stepIndex + 1, 1, newPetId);
    if (next !== -1) setStepIndex(next);
  }, [waitingForPet, pathname, stepIndex]);

  // 5) Llevar al usuario a la pantalla de cada paso
  useEffect(() => {
    if (!active) return;
    if (step.needsPet && petId === null) return;
    if (waitingForPet && pathname.startsWith("/pets/")) return;
    const route = step.route(petId);
    if (pathname !== route) router.push(route);
  }, [active, step, petId, pathname, router, waitingForPet]);

  // 6) Preparar el menú lateral y buscar el elemento a iluminar
  useEffect(() => {
    setRect(null);
    targetRef.current = null;
    if (!active) return;

    if (step.openMenu) {
      if (!isMenuOpen()) {
        document
          .querySelector<HTMLElement>('[data-tour="menu-button"]')
          ?.click();
      }
    } else if (step.kind === "spot") {
      closeMenu();
    }

    if (!step.target) return;

    let tries = 0;
    const timeouts: number[] = [];

    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const interval = window.setInterval(() => {
      tries += 1;
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`
      );
      if (el) {
        window.clearInterval(interval);
        targetRef.current = el;
        if (!step.openMenu) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        timeouts.push(window.setTimeout(measure, 400));
        timeouts.push(window.setTimeout(measure, 800));
      } else if (tries >= 20) {
        window.clearInterval(interval);
      }
    }, 150);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      window.clearInterval(interval);
      timeouts.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, pathname]);

  const finish = async () => {
    setActive(false);
    setRect(null);
    closeMenu();
    removeStorage(STEP_KEY);
    if (!userId) return;
    writeStorage(DONE_KEY, userId);
    const supabase = createClient();
    // upsert: crea la fila del perfil si el usuario aún no tiene una
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Error guardando el tutorial como completado:", error);
    }
    window.dispatchEvent(new Event(ONBOARDING_FINISHED_EVENT));
  };

  // Elegir idioma antes de empezar el tutorial
  const chooseLanguage = async (language: AppLanguage) => {
    if (savingLanguage) return;

    // Marcar como elegido para no volver a preguntar tras la recarga
    if (userId) writeStorage(LANG_KEY, userId);

    if (language === lang) {
      setChoosingLanguage(false);
      return;
    }

    setSavingLanguage(true);
    const saved = await saveUserLanguage(language);

    if (saved) {
      // Recarga completa: el tutorial empieza ya en el idioma elegido
      window.location.reload();
      return;
    }

    // Si falla el guardado, seguimos con el idioma actual
    setSavingLanguage(false);
    setChoosingLanguage(false);
  };

  const goNext = () => {
    const next = findValidIndex(stepIndex + 1, 1, petId);
    if (next === -1) {
      finish();
    } else {
      setStepIndex(next);
    }
  };

  const goBack = () => {
    const prev = findValidIndex(stepIndex - 1, -1, petId);
    if (prev !== -1) setStepIndex(prev);
  };

  const handleTap = () => {
    targetRef.current?.click();
    goNext();
  };

  const continueWithoutPet = () => {
    setPetMessage(false);
    goNext();
  };

  const checkPet = async () => {
    if (!userId) return;
    setChecking(true);
    const firstPet = await loadFirstPet(userId);
    setChecking(false);
    if (firstPet === null) {
      setPetMessage(true);
      return;
    }
    setPetId(firstPet);
    setPetMessage(false);
    const next = findValidIndex(stepIndex + 1, 1, firstPet);
    if (next !== -1) setStepIndex(next);
  };

  if (!active || HIDDEN_PATHS.includes(pathname)) return null;

  // ---------- Pantalla "Elige tu idioma" (antes del tutorial) ----------
  if (choosingLanguage) {
    return (
      <div className="paws-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-white px-6 py-8 text-center">
        <style>{TOUR_CSS}</style>

        <SpeechBubble>
          Elige tu idioma
          <span className="block text-base font-medium text-gray-500">
            Choose your language
          </span>
        </SpeechBubble>

        <div className="paws-float">
          <PawsMascot size={150} />
        </div>

        <div className="grid w-full max-w-sm gap-3">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={savingLanguage}
              onClick={() => void chooseLanguage(option.value)}
              className="rounded-xl bg-[#1e3a5f] px-6 py-4 text-lg font-bold text-white shadow-[0_4px_0_#0f2540] transition active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              <span className="mr-2">{option.flag}</span>
              {option.name}
            </button>
          ))}
        </div>

        <p className="max-w-sm text-sm text-gray-500">
          Podrás cambiarlo cuando quieras · You can change it any time
        </p>
      </div>
    );
  }

  const visibleSteps = STEPS.filter((s) => !s.needsPet || petId !== null);
  const position = visibleSteps.indexOf(step) + 1;
  const total = visibleSteps.length;
  const progress = Math.round((position / total) * 100);
  const canGoBack = findValidIndex(stepIndex - 1, -1, petId) !== -1;

  // ---------- Pantallas completas: bienvenida, ciclo y final ----------
  if (step.kind !== "spot") {
    const isFinish = step.kind === "finish";

    return (
      <div className="paws-fade fixed inset-0 z-[70] flex flex-col bg-white">
        <style>{TOUR_CSS}</style>
        {isFinish && <Confetti />}

        <div className="flex items-center gap-4 px-4 pt-5 sm:px-8">
          <button
            type="button"
            onClick={finish}
            aria-label={UI.close[lang]}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
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
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#1e3a5f] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div
          key={step.id}
          className="paws-pop relative flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-6 text-center"
        >
          <SpeechBubble>{step.title[lang]}</SpeechBubble>

          {step.kind === "loop" ? (
            <LoopDiagram lang={lang} />
          ) : (
            <div className="paws-float">
              <PawsMascot size={170} />
            </div>
          )}

          <p className="max-w-md text-base leading-relaxed text-gray-600">
            {step.body[lang]}
          </p>
        </div>

        <div className="border-t border-gray-200 px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            {canGoBack && !isFinish ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border-2 border-gray-200 px-5 py-3 text-sm font-bold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
              >
                {UI.back[lang]}
              </button>
            ) : step.kind === "intro" ? (
              <button
                type="button"
                onClick={finish}
                className="text-sm font-semibold text-gray-400 underline hover:text-gray-600"
              >
                {UI.skip[lang]}
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={isFinish ? finish : goNext}
              className="rounded-xl bg-[#1e3a5f] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_4px_0_#0f2540] transition active:translate-y-1 active:shadow-none"
            >
              {isFinish ? UI.finish[lang] : UI.continue[lang]}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Tarjeta azul con el perro guía ----------
  const position_ = rect && !waitingForPet ? computeCardPosition(rect) : null;

  const card = (
    <div
      key={step.id}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="paws-pop relative w-[min(360px,calc(100vw-32px))] rounded-2xl p-5 text-white shadow-2xl"
      style={{ backgroundColor: NAVY }}
    >
      {position_?.arrow && (
        <span
          className="absolute h-4 w-4 rotate-45"
          style={{ ...position_.arrow, backgroundColor: NAVY }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <PawsMascot size={50} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
              {position} / {total}
            </p>
            <h2 id="onboarding-title" className="text-lg font-bold leading-tight">
              <span className="mr-1">{step.icon}</span>
              {step.title[lang]}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={finish}
          aria-label={UI.close[lang]}
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

      <p className="mt-3 text-sm leading-relaxed text-white/85">
        {step.body[lang]}
      </p>

      {waitingForPet && (
        <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
          {UI.noPet[lang]}
        </p>
      )}
      {waitingForPet && petMessage && (
        <p className="mt-2 text-sm font-semibold text-red-200">
          {UI.stillNoPet[lang]}
        </p>
      )}

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-sky-300 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {canGoBack && (
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {UI.back[lang]}
          </button>
        )}

        {waitingForPet ? (
          <>
            <button
              type="button"
              onClick={continueWithoutPet}
              className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              {UI.withoutPet[lang]}
            </button>
            <button
              type="button"
              onClick={checkPet}
              disabled={checking}
              className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#1e3a5f] hover:bg-sky-50 disabled:opacity-50"
            >
              {UI.created[lang]}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] hover:bg-sky-50"
          >
            {UI.next[lang]}
          </button>
        )}
      </div>
    </div>
  );

  // Paso en el que el usuario tiene que poder usar la pantalla (crear mascota)
  if (waitingForPet) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
        <style>{TOUR_CSS}</style>
        <div className="pointer-events-auto">{card}</div>
      </div>
    );
  }

  // Paso con un elemento iluminado
  if (rect && position_) {
    return (
      <>
        <style>{TOUR_CSS}</style>
        <div className="fixed inset-0 z-[60]" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-white transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
          }}
        />

        {step.tap && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none fixed z-[61] animate-ping rounded-xl border-4 border-sky-300"
              style={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              }}
            />
            <button
              type="button"
              onClick={handleTap}
              aria-label={UI.tapHere[lang]}
              className="fixed z-[65] cursor-pointer rounded-xl"
              style={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              }}
            />
            <span
              className="pointer-events-none fixed z-[65] whitespace-nowrap rounded-full bg-sky-300 px-3 py-1 text-xs font-bold text-[#1e3a5f] shadow"
              style={{
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width + 16,
                transform: "translateY(-50%)",
              }}
            >
              👆 {UI.tapHere[lang]}
            </span>
          </>
        )}

        <div className="fixed z-[70]" style={position_.style}>
          {card}
        </div>
      </>
    );
  }

  // Paso sin elemento iluminado: tarjeta centrada
  return (
    <div className="paws-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <style>{TOUR_CSS}</style>
      {card}
    </div>
  );
}