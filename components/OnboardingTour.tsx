"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { saveUserLanguage, type AppLanguage } from "@/lib/language";
import Pawsi from "@/components/Pawsi";
import {
  DEFAULT_ACCOUNT_TYPE,
  isAccountType,
  type AccountType,
} from "@/lib/account-type";

// Pantallas donde el tutorial nunca se muestra (sin sesión iniciada)
const HIDDEN_PATHS = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/update-password",
];

// Claves "v2": el tutorial nuevo se enseña una vez a todos,
// también a quien ya vio el antiguo
const STEP_KEY = "paws-onboarding-v2-step";
const DONE_KEY = "paws-onboarding-v2-done";
const LANG_KEY = "paws-onboarding-v2-lang-chosen";
const ACCOUNT_KEY = "paws-onboarding-v2-account-chosen";
export const START_TOUR_EVENT = "paws:start-onboarding";
export const ONBOARDING_FINISHED_EVENT = "paws:onboarding-finished";
// Aviso al resto de la app de si hay un tutorial o una guía en pantalla
export const TOUR_STATE_EVENT = "paws:tour-state";

const WELCOME_ID = "welcome";
const WELCOME_ROUTE = "/dashboard";

// Guía de los huesitos: va dentro de la bienvenida y, además, como guía
// propia (enganchada a la pastilla del saldo) para quien ya vio la bienvenida
const HUESITOS_ID = "huesitos";

// Llamar a esta función (por ejemplo desde Ajustes) vuelve a lanzar
// la bienvenida y vuelve a activar todas las guías de cada pantalla
export function startOnboardingTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

// ¿Hay ahora mismo un tutorial o una guía en pantalla (o a punto de salir)?
export function isTourRunning(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.pawsTour !== "off";
}

type Lang = "es" | "en";
type Text = Record<Lang, string>;
type StepKind = "intro" | "loop" | "spot" | "finish";

type TourStep = {
  id: string;
  kind: StepKind;
  icon: string;
  title: Text;
  body: Text;
  target?: string; // valor del atributo data-tour del elemento a iluminar
  tap?: boolean; // el usuario tiene que tocar el elemento para seguir
  openMenu?: boolean; // el menú lateral debe estar abierto en este paso
  cardAt?: "top"; // la tarjeta va arriba de la pantalla y el elemento justo debajo
};

type SectionTour = {
  id: string; // valor del atributo data-tour-section de la pantalla
  name: Text;
  steps: TourStep[];
};

// ---------- Huesitos (en la bienvenida y como guía propia) ----------

const HUESITO_STEPS: TourStep[] = [
  {
    id: "huesitos-balance",
    kind: "spot",
    target: "huesito-balance",
    icon: "🦴",
    title: { es: "Tus huesitos", en: "Your bones" },
    body: {
      es: "Estos son tus huesitos. Los gastas al usar la IA de PAWS. Empiezas con 20 de regalo.",
      en: "These are your bones. You spend them when you use PAWS's AI. You start with 20 as a gift.",
    },
  },
  {
    // Sin elemento iluminado: tarjeta centrada
    id: "huesitos-costs",
    kind: "spot",
    icon: "💡",
    title: {
      es: "Cada botón te dice lo que cuesta",
      en: "Every button tells you its cost",
    },
    body: {
      es: "Por ejemplo, «Preparar sesión · 2 🦴». Si te quedas sin huesitos, PAWS sigue funcionando con su versión básica.",
      en: "For example, «Prepare session · 2 🦴». If you run out of bones, PAWS keeps working with its basic version.",
    },
  },
  {
    id: "huesitos-details",
    kind: "spot",
    target: "huesito-balance",
    icon: "👆",
    title: { es: "Tu saldo y tus movimientos", en: "Your balance and activity" },
    body: {
      es: "Pulsa la pastilla cuando quieras para ver tu saldo, los precios y tus movimientos.",
      en: "Tap the badge any time to see your balance, the prices and your activity.",
    },
  },
];

// ---------- Bienvenida (primera vez que se entra) ----------

const WELCOME_STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "intro",
    icon: "👋",
    title: {
      es: "¡Hola! Soy Pawsi, tu ayudante de entrenamiento",
      en: "Hi! I'm Pawsi, your training buddy",
    },
    body: {
      es: "Te enseño cómo funciona PAWS. Primero lo básico, y después te explicaré cada pantalla la primera vez que entres en ella. Puedes saltarlo cuando quieras y repetirlo desde Ajustes.",
      en: "I'll show you how PAWS works. First the basics, and then I'll explain each screen the first time you open it. You can skip it any time and replay it from Settings.",
    },
  },
  {
    id: "loop",
    kind: "loop",
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
    id: "menu",
    kind: "spot",
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
    target: "sidebar-panel",
    openMenu: true,
    icon: "🧭",
    title: { es: "Todo a mano", en: "Everything at hand" },
    body: {
      es: "Inicio, Mascotas, Calendario, Clicker, Ajustes y Créditos. Debajo de Mascotas aparecen tus perros: despliega cada uno para ir a sus Habilidades, su Progreso, su Historial o su Salud.",
      en: "Home, Pets, Calendar, Clicker, Settings and Credits. Under Pets you'll find your dogs: expand each one to reach its Skills, its Progress, its History or its Health.",
    },
  },
  ...HUESITO_STEPS,
  {
    id: "finish",
    kind: "finish",
    icon: "🎉",
    title: { es: "¡Ya conoces lo básico!", en: "You know the basics!" },
    body: {
      es: "A partir de ahora, la primera vez que entres en cada pantalla te explicaré cómo funciona. También te he dejado una lista de primeros pasos que se marca sola.",
      en: "From now on, the first time you open each screen I'll explain how it works. I've also left you a first-steps checklist that ticks itself off.",
    },
  },
];

// ---------- Guías de cada pantalla ----------

const SECTIONS: SectionTour[] = [
  {
    // Enganchada a la pastilla del saldo, que está en todas las páginas
    id: HUESITOS_ID,
    name: { es: "Huesitos", en: "Bones" },
    steps: HUESITO_STEPS,
  },
  {
    id: "dashboard",
    name: { es: "Inicio", en: "Home" },
    steps: [
      {
        id: "dashboard-greeting",
        kind: "spot",
        target: "dashboard-greeting",
        icon: "👋",
        title: { es: "Tu resumen del día", en: "Your daily summary" },
        body: {
          es: "Cada día te saludo con lo que tienes pendiente y tu racha de días entrenando. ¡Intenta no romperla!",
          en: "Every day I greet you with what's pending and your training streak. Try not to break it!",
        },
      },
      {
        // Solo aparece si hay vacunas o desparasitaciones atrasadas o próximas (si no, se salta)
        id: "dashboard-vaccines",
        kind: "spot",
        target: "dashboard-vaccines",
        icon: "🩺",
        title: { es: "Salud al día", en: "Health up to date" },
        body: {
          es: "Si alguna vacuna o desparasitación está atrasada o toca en los próximos 30 días, te aviso aquí. Tócala para ir a la Salud de ese perro.",
          en: "If any vaccine or parasite treatment is overdue or due in the next 30 days, I'll let you know here. Tap it to go to that dog's Health.",
        },
      },
      {
        id: "dashboard-week",
        kind: "spot",
        target: "dashboard-week",
        icon: "📈",
        title: { es: "Tu semana", en: "Your week" },
        body: {
          es: "Aquí ves cuántos entrenamientos y minutos llevas esta semana y cuántas habilidades domina ya tu perro.",
          en: "Here you see how many trainings and minutes you've done this week and how many skills your dog has mastered.",
        },
      },
      {
        id: "dashboard-next",
        kind: "spot",
        target: "dashboard-next",
        icon: "⏭️",
        title: { es: "Próximo entrenamiento", en: "Next training" },
        body: {
          es: "Tu siguiente entrenamiento, listo para abrirlo. Si se te pasó alguno, verás la etiqueta \"Atrasado\".",
          en: "Your next training, ready to open. If you missed one, you'll see the \"Overdue\" label.",
        },
      },
      {
        id: "dashboard-shortcuts",
        kind: "spot",
        target: "dashboard-shortcuts",
        cardAt: "top",
        icon: "🧭",
        title: { es: "Accesos rápidos", en: "Quick access" },
        body: {
          es: "Mascotas, Calendario, Clicker y Ajustes, cada uno con un dato al día para que veas de un vistazo cómo vas.",
          en: "Pets, Calendar, Clicker and Settings, each with a live figure so you can see how you're doing at a glance.",
        },
      },
      {
        id: "dashboard-language",
        kind: "spot",
        target: "language-switcher",
        icon: "🌍",
        title: { es: "Cambia el idioma", en: "Change the language" },
        body: {
          es: "Toca la bandera en cualquier pantalla para cambiar entre español e inglés.",
          en: "Tap the flag on any screen to switch between Spanish and English.",
        },
      },
    ],
  },
  {
    id: "pets",
    name: { es: "Mis mascotas", en: "My pets" },
    steps: [
      {
        id: "pets-list",
        kind: "spot",
        target: "pets-list",
        icon: "🐶",
        title: { es: "Tus perros", en: "Your dogs" },
        body: {
          es: "Aquí están todos tus perros con su progreso. Toca uno para abrir su ficha.",
          en: "All your dogs are here with their progress. Tap one to open its profile.",
        },
      },
      {
        id: "pets-reinforce",
        kind: "spot",
        target: "pet-reinforce",
        icon: "💪",
        title: { es: "Qué reforzar hoy", en: "What to reinforce today" },
        body: {
          es: "PAWS te dice qué habilidad conviene reforzar hoy. Toca el botón y vas directo a ella.",
          en: "PAWS tells you which skill to reinforce today. Tap the button and you go straight to it.",
        },
      },
      {
        id: "pets-actions",
        kind: "spot",
        target: "pet-actions",
        icon: "📊",
        title: { es: "Habilidades y progreso", en: "Skills and progress" },
        body: {
          es: "\"Ver habilidades\" abre la lista de habilidades del perro y \"Ver progreso\" su análisis con IA.",
          en: "\"View skills\" opens the dog's skill list and \"View progress\" its AI analysis.",
        },
      },
      {
        id: "pets-add",
        kind: "spot",
        target: "add-pet",
        icon: "➕",
        title: { es: "Añade una mascota", en: "Add a pet" },
        body: {
          es: "Al crear una mascota te propongo un cuestionario rápido. Con tus respuestas, la IA prepara su objetivo, sus grupos de habilidades y el orden para entrenarlas.",
          en: "When you add a pet I'll offer you a quick questionnaire. With your answers, the AI prepares its goal, its skill groups and the order to train them.",
        },
      },
    ],
  },
  {
    id: "questionnaire",
    name: { es: "Cuestionario", en: "Questionnaire" },
    steps: [
      {
        id: "questionnaire-intro",
        kind: "spot",
        icon: "📝",
        title: { es: "Conozcamos a tu perro", en: "Let's get to know your dog" },
        body: {
          es: "Responde tocando las opciones. Al final la IA te propone un objetivo, grupos de habilidades y un orden de trabajo: revísalo y acéptalo antes de guardar. Si prefieres, puedes saltarlo.",
          en: "Answer by tapping the options. At the end the AI suggests a goal, skill groups and a training order: review it and accept it before saving. You can also skip it.",
        },
      },
    ],
  },
  {
    id: "pet-profile",
    name: { es: "Ficha", en: "Profile" },
    steps: [
      {
        id: "pet-header",
        kind: "spot",
        target: "pet-header",
        icon: "🪪",
        title: { es: "La ficha de tu perro", en: "Your dog's profile" },
        body: {
          es: "Sus datos y su objetivo. Para cambiar algo, toca el lápiz de la esquina.",
          en: "Its details and its goal. To change anything, tap the pencil in the corner.",
        },
      },
      {
        id: "pet-add-training",
        kind: "spot",
        target: "add-training",
        icon: "➕",
        title: { es: "Crea un entrenamiento", en: "Create a training" },
        body: {
          es: "Elige un grupo y una habilidad, la fecha y la duración. El título se pone solo.",
          en: "Choose a group and a skill, the date and the duration. The title fills itself in.",
        },
      },
      {
        id: "pet-buttons",
        kind: "spot",
        target: "pet-buttons",
        icon: "🧭",
        title: { es: "Todo sobre tu perro", en: "Everything about your dog" },
        body: {
          es: "Desde aquí vas a sus Habilidades, a su Progreso, a su Historial de entrenamientos y a su Salud (vacunas y desparasitaciones).",
          en: "From here you reach its Skills, its Progress, its training History and its Health (vaccines and parasite prevention).",
        },
      },
    ],
  },
  {
    id: "skills",
    name: { es: "Habilidades", en: "Skills" },
    steps: [
      {
        id: "skills-tabs",
        kind: "spot",
        target: "skills-tabs",
        icon: "🗂️",
        title: { es: "Tres pestañas", en: "Three tabs" },
        body: {
          es: "Habilidades: lo que aprende tu perro. Grupos: habilidades que entrenáis juntas. Orden recomendado: por dónde seguir, según la IA.",
          en: "Skills: what your dog is learning. Groups: skills you train together. Recommended order: where to go next, according to the AI.",
        },
      },
      {
        id: "skills-filters",
        kind: "spot",
        target: "skills-filters",
        icon: "🔎",
        title: { es: "Busca y filtra", en: "Search and filter" },
        body: {
          es: "Encuentra rápido una habilidad por su nombre o su categoría.",
          en: "Quickly find a skill by its name or category.",
        },
      },
      {
        id: "skills-create",
        kind: "spot",
        target: "skill-create",
        icon: "✏️",
        title: { es: "Crea tu propia habilidad", en: "Create your own skill" },
        body: {
          es: "Si quieres enseñar algo que no está en el catálogo, créalo aquí. Se añadirá a la lista y podrás asignarlo a tus perros.",
          en: "If you want to teach something that's not in the catalog, create it here. It will be added to the list and you can assign it to your dogs.",
        },
      },
      {
        id: "skills-card",
        kind: "spot",
        target: "skill-card",
        icon: "🎯",
        title: { es: "Abre una habilidad", en: "Open a skill" },
        body: {
          es: "Dentro tienes un vídeo, viñetas con los pasos para enseñarla (tócalas para verlas a pantalla completa) y los errores más frecuentes. Su progreso lo calcula la IA con tus entrenamientos.",
          en: "Inside you'll find a video, illustrated steps to teach it (tap them to view full screen) and the most common mistakes. Its progress is calculated by the AI from your trainings.",
        },
      },
    ],
  },
  {
    id: "skill-groups",
    name: { es: "Grupos", en: "Groups" },
    steps: [
      {
        id: "groups-create",
        kind: "spot",
        target: "groups-create",
        icon: "🧩",
        title: { es: "Crea un grupo", en: "Create a group" },
        body: {
          es: "Junta habilidades para entrenarlas a la vez. Si no se te ocurre un nombre, la IA te sugiere uno.",
          en: "Put skills together to train them at the same time. If you can't think of a name, the AI suggests one.",
        },
      },
      {
        id: "groups-list",
        kind: "spot",
        target: "groups-list",
        icon: "📦",
        title: { es: "Tus grupos", en: "Your groups" },
        body: {
          es: "Cuando crees un entrenamiento, primero eliges el grupo y después la habilidad.",
          en: "When you create a training, you first choose the group and then the skill.",
        },
      },
    ],
  },
  {
    id: "skill-order",
    name: { es: "Orden recomendado", en: "Recommended order" },
    steps: [
      {
        id: "order-calculate",
        kind: "spot",
        target: "order-calculate",
        icon: "🧠",
        title: { es: "Calcula el orden", en: "Calculate the order" },
        body: {
          es: "La IA ordena tus grupos y sus habilidades según el progreso, los requisitos entre habilidades y el objetivo del perro. Se guarda hasta que lo vuelvas a calcular.",
          en: "The AI orders your groups and their skills based on progress, the requirements between skills and your dog's goal. It's saved until you recalculate it.",
        },
      },
      {
        id: "order-list",
        kind: "spot",
        target: "order-list",
        icon: "🪜",
        title: { es: "Sigue el camino", en: "Follow the path" },
        body: {
          es: "La primera habilidad es la siguiente que conviene trabajar. También la verás en Mis mascotas.",
          en: "The first skill is the next one to work on. You'll also see it in My pets.",
        },
      },
    ],
  },
  {
    id: "training",
    name: { es: "Entrenamiento", en: "Training" },
    steps: [
      {
        id: "training-prepare",
        kind: "spot",
        target: "training-prepare",
        icon: "📋",
        title: { es: "Prepara la sesión", en: "Prepare the session" },
        body: {
          es: "La IA te prepara el plan de hoy paso a paso: objetivo, calentamiento, ejercicios con repeticiones y cuándo subir o bajar la dificultad.",
          en: "The AI prepares today's plan step by step: goal, warm-up, exercises with repetitions and when to make it harder or easier.",
        },
      },
      {
        id: "training-chat",
        kind: "spot",
        target: "training-chat",
        icon: "💬",
        title: { es: "Pregunta tus dudas", en: "Ask your questions" },
        body: {
          es: "Si algo no sale, pregúntalo aquí. La conversación se guarda y la IA la tendrá en cuenta al calcular el progreso.",
          en: "If something doesn't work, ask here. The conversation is saved and the AI takes it into account when calculating progress.",
        },
      },
      {
        id: "training-complete",
        kind: "spot",
        target: "training-complete",
        icon: "✅",
        title: { es: "Al terminar", en: "When you finish" },
        body: {
          es: "Márcalo como completado y responde 4 preguntas rápidas: intentos, aciertos, distracción y ánimo. La IA actualiza el progreso y te dice qué hacer después.",
          en: "Mark it as completed and answer 4 quick questions: attempts, successes, distraction and mood. The AI updates the progress and tells you what to do next.",
        },
      },
    ],
  },
  {
    id: "progress",
    name: { es: "Progreso", en: "Progress" },
    steps: [
      {
        id: "progress-analysis",
        kind: "spot",
        target: "progress-analysis",
        icon: "🤖",
        title: { es: "Análisis de la IA", en: "AI analysis" },
        body: {
          es: "La IA estudia el historial de tu perro y te da un resumen, los patrones que detecta y qué trabajar después. Puedes repetir el análisis cuando quieras.",
          en: "The AI studies your dog's history and gives you a summary, the patterns it detects and what to work on next. You can repeat the analysis any time.",
        },
      },
      {
        id: "progress-bars",
        kind: "spot",
        target: "progress-bars",
        icon: "📊",
        title: { es: "Cada habilidad", en: "Each skill" },
        body: {
          es: "El progreso de cada habilidad. Sube con cada entrenamiento que registras.",
          en: "The progress of each skill. It goes up with every training you log.",
        },
      },
    ],
  },
  {
    id: "history",
    name: { es: "Historial", en: "History" },
    steps: [
      {
        id: "history-filters",
        kind: "spot",
        target: "history-filters",
        icon: "🔎",
        title: { es: "Filtra tus entrenamientos", en: "Filter your trainings" },
        body: {
          es: "Completados o pendientes, por habilidad y entre dos fechas. Se aplica al momento.",
          en: "Completed or pending, by skill and between two dates. It applies instantly.",
        },
      },
      {
        id: "history-list",
        kind: "spot",
        target: "history-list",
        icon: "🗒️",
        title: { es: "Todo lo que habéis hecho", en: "Everything you've done" },
        body: {
          es: "Toca cualquier entrenamiento para abrirlo.",
          en: "Tap any training to open it.",
        },
      },
    ],
  },
  {
    id: "health",
    name: { es: "Salud", en: "Health" },
    steps: [
      {
        id: "health-tabs",
        kind: "spot",
        target: "health-tabs",
        icon: "🩺",
        title: { es: "La salud de tu perro", en: "Your dog's health" },
        body: {
          es: "Aquí tienes dos pestañas: Vacunas y Desparasitaciones. Cada una con sus próximas dosis y las que ya se han hecho.",
          en: "Here you have two tabs: Vaccines and Parasite prevention. Each one with its upcoming doses and the ones already done.",
        },
      },
      {
        // Sin elemento iluminado: tarjeta centrada
        id: "vaccines-intro",
        kind: "spot",
        icon: "💉",
        title: { es: "Tu calendario de vacunación", en: "Your vaccine schedule" },
        body: {
          es: "Pulsa \"Generar plan sugerido\" y preparo las vacunas según la edad de tu perro. Si alguna dosis ya debería estar puesta, te pregunto cuáles se puso. Es un plan orientativo: tu veterinario decide.",
          en: "Tap \"Generate suggested plan\" and I'll prepare the vaccines based on your dog's age. If some doses should already have been given, I'll ask which ones. It's only a suggested plan: your vet decides.",
        },
      },
      {
        // Solo aparece si ya hay vacunas (si no, se salta)
        id: "vaccines-list",
        kind: "spot",
        target: "vaccines-list",
        icon: "📋",
        title: { es: "Próximas dosis y puestas", en: "Upcoming and given doses" },
        body: {
          es: "Cuando le pongan una vacuna, pulsa \"Marcar como puesta\": el siguiente refuerzo se crea solo. Puedes guardar el veterinario, el lote y una foto de la pegatina de la cartilla. Abajo tienes las vacunas opcionales.",
          en: "When a vaccine is given, tap \"Mark as given\": the next booster is created automatically. You can save the vet, the batch number and a photo of the card sticker. Optional vaccines are at the bottom.",
        },
      },
      {
        // Sin elemento iluminado: tarjeta centrada
        id: "deworming-intro",
        kind: "spot",
        icon: "🪱",
        title: { es: "Desparasitaciones", en: "Parasite prevention" },
        body: {
          es: "En la otra pestaña registras pastillas, pipetas, collares, comprimidos antipulgas y la prevención de filaria. Al marcar una como hecha, PAWS crea la siguiente según el intervalo, que puedes cambiar si tu producto dura otro tiempo.",
          en: "In the other tab you record tablets, spot-ons, collars, flea tablets and heartworm prevention. When you mark one as done, PAWS creates the next one based on the interval, which you can change if your product lasts a different time.",
        },
      },
      {
        // Sin elemento iluminado: tarjeta centrada
        id: "health-reminders",
        kind: "spot",
        icon: "🔔",
        title: { es: "Te aviso a tiempo", en: "I'll remind you in time" },
        body: {
          es: "Lo que esté atrasado o toque en los próximos 30 días aparece en Inicio. Además, lo verás en el Calendario y en el calendario de tu móvil si lo tienes activado en Ajustes.",
          en: "Anything overdue or due in the next 30 days appears on Home. You'll also see it in the Calendar and in your phone's calendar if you've turned it on in Settings.",
        },
      },
    ],
  },
  {
    id: "calendar",
    name: { es: "Calendario", en: "Calendar" },
    steps: [
      {
        id: "calendar-controls",
        kind: "spot",
        target: "calendar-controls",
        icon: "📅",
        title: { es: "Muévete por las fechas", en: "Move through dates" },
        body: {
          es: "Usa las flechas para ver otras semanas o meses y planificar.",
          en: "Use the arrows to see other weeks or months and plan ahead.",
        },
      },
      {
        id: "calendar-grid",
        kind: "spot",
        target: "calendar-grid",
        icon: "🗓️",
        title: { es: "Entrenamientos y salud", en: "Trainings and health" },
        body: {
          es: "Las barritas de color son entrenamientos y el punto rosa, vacunas y desparasitaciones. Toca un día para verlos y abrirlos. Si quieres verlos también en el calendario de tu móvil, actívalo en Ajustes.",
          en: "The colored bars are trainings and the pink dot is vaccines and parasite treatments. Tap a day to see and open them. If you want to see them in your phone's calendar too, turn it on in Settings.",
        },
      },
    ],
  },
  {
    id: "clicker",
    name: { es: "Clicker", en: "Clicker" },
    steps: [
      {
        id: "clicker-button",
        kind: "spot",
        target: "clicker-button",
        tap: true,
        icon: "🔔",
        title: { es: "¡Pruébalo!", en: "Try it!" },
        body: {
          es: "Toca el botón. Suena justo en el instante en que tu perro hace lo que le pides, y después le das el premio.",
          en: "Tap the button. Make it sound at the exact moment your dog does what you ask, and then give the treat.",
        },
      },
      {
        id: "clicker-customize",
        kind: "spot",
        target: "clicker-customize",
        icon: "🔊",
        title: { es: "Elige tu sonido", en: "Choose your sound" },
        body: {
          es: "Elige entre 10 sonidos y ajusta el volumen, el tono y el tiempo entre clic y clac.",
          en: "Pick from 10 sounds and adjust the volume, the pitch and the gap between click and clack.",
        },
      },
      {
        id: "clicker-vibration",
        kind: "spot",
        target: "clicker-vibration",
        icon: "📳",
        title: { es: "Vibración", en: "Vibration" },
        body: {
          es: "Actívala si quieres notar cada clic. En iPhone, el navegador no permite vibrar.",
          en: "Turn it on if you want to feel each click. On iPhone, the browser doesn't allow vibration.",
        },
      },
    ],
  },
  {
    id: "settings",
    name: { es: "Ajustes", en: "Settings" },
    steps: [
      {
        id: "settings-profile",
        kind: "spot",
        target: "settings-profile",
        icon: "👤",
        title: { es: "Tu perfil", en: "Your profile" },
        body: {
          es: "Tu foto, usuario, nombre y tipo de cuenta. La IA adapta su forma de hablarte según el tipo de cuenta.",
          en: "Your photo, username, name and account type. The AI adapts the way it talks to you to your account type.",
        },
      },
      {
        id: "settings-huesitos",
        kind: "spot",
        target: "settings-huesitos",
        icon: "🦴",
        title: { es: "Tus huesitos", en: "Your bones" },
        body: {
          es: "Aquí ves tu saldo, cuánto cuesta cada función de IA y todos tus movimientos.",
          en: "Here you see your balance, what each AI feature costs and all your activity.",
        },
      },
      {
        id: "settings-language",
        kind: "spot",
        target: "settings-language",
        icon: "🌍",
        title: { es: "Idioma", en: "Language" },
        body: {
          es: "Elige el idioma de la app. También puedes cambiarlo con la bandera de arriba.",
          en: "Choose the app language. You can also change it with the flag at the top.",
        },
      },
      {
        id: "settings-calendar",
        kind: "spot",
        target: "settings-calendar",
        icon: "📲",
        title: { es: "Calendario del móvil", en: "Phone calendar" },
        body: {
          es: "Añade tus entrenamientos, vacunas y desparasitaciones al calendario de tu iPhone o de Google, y se mantendrán al día solos.",
          en: "Add your trainings, vaccines and parasite treatments to your iPhone or Google calendar, and they'll stay up to date on their own.",
        },
      },
      {
        id: "settings-account",
        kind: "spot",
        target: "settings-account",
        icon: "🔐",
        title: { es: "Tu cuenta", en: "Your account" },
        body: {
          es: "Cambia tu correo o tu contraseña, cierra sesión o borra tu cuenta.",
          en: "Change your email or password, log out or delete your account.",
        },
      },
      {
        id: "settings-replay",
        kind: "spot",
        target: "replay-tour",
        icon: "🔁",
        title: { es: "Vuelve a verlo", en: "See it again" },
        body: {
          es: "Desde aquí puedes repetir la bienvenida y todas las guías de cada pantalla.",
          en: "From here you can replay the welcome and every screen guide.",
        },
      },
    ],
  },
];

const SECTION_IDS = new Set(SECTIONS.map((s) => s.id));

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
  close: { es: "Cerrar", en: "Close" },
  tapHere: { es: "Toca aquí", en: "Tap here" },
  finish: { es: "¡A entrenar!", en: "Let's train!" },
  gotIt: { es: "Entendido", en: "Got it" },
  hideAll: { es: "No mostrar más guías", en: "Don't show more guides" },
} satisfies Record<string, Text>;

// Pregunta "¿Cómo vas a usar PAWS?" (después del idioma)
const ACCOUNT_UI = {
  title: { es: "¿Cómo vas a usar PAWS?", en: "How will you use PAWS?" },
  hint: {
    es: "Podrás cambiarlo cuando quieras en Ajustes",
    en: "You can change it any time in Settings",
  },
} satisfies Record<string, Text>;

const ACCOUNT_OPTIONS: {
  value: AccountType;
  icon: string;
  name: Text;
  description: Text;
}[] = [
  {
    value: "particular",
    icon: "🏠",
    name: { es: "Tengo perro", en: "I have a dog" },
    description: {
      es: "Entreno a mi perro (o voy con un adiestrador)",
      en: "I train my own dog (or work with a trainer)",
    },
  },
  {
    value: "profesional",
    icon: "🎓",
    name: { es: "Soy adiestrador/a", en: "I'm a dog trainer" },
    description: {
      es: "Trabajo con perros de clientes",
      en: "I work with clients' dogs",
    },
  },
  {
    value: "centro",
    icon: "🏫",
    name: { es: "Centro de adiestramiento", en: "Training center" },
    description: {
      es: "Varios adiestradores en un mismo centro",
      en: "Several trainers in one center",
    },
  },
  {
    value: "refugio",
    icon: "🐾",
    name: { es: "Refugio o protectora", en: "Shelter or rescue" },
    description: {
      es: "Preparamos perros para su adopción",
      en: "We prepare dogs for adoption",
    },
  },
];

const NAVY = "#1e3a5f";
const CARD_HEIGHT = 300;

// Cada cuánto se comprueba si la pantalla del paso está lista (ms)
const POLL_MS = 100;
// Máximo de comprobaciones antes de mostrar la tarjeta centrada
const MAX_TRIES_WELCOME = 60; // ≈ 6 s
const MAX_TRIES_SECTION = 25; // ≈ 2,5 s
// Cada cuánto se busca una pantalla con guía pendiente (ms)
const SECTION_SCAN_MS = 400;
// Para saber si el elemento ya dejó de moverse (la página terminó de cargar)
const STABLE_CHECK_MS = 120;
const STABLE_CHECKS_NEEDED = 3;
const MAX_STABLE_ATTEMPTS = 30;
// Alto aproximado de la barra superior fija de la app
const TOP_BAR_HEIGHT = 64;
// Pasos con la tarjeta arriba: dónde empieza la tarjeta y dónde
// debe quedar el elemento iluminado (justo debajo de la tarjeta)
const CARD_TOP = TOP_BAR_HEIGHT + 8;
const BELOW_CARD = CARD_TOP + CARD_HEIGHT + 8;

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

function isMenuOpen() {
  const panel = document.querySelector('[data-tour="sidebar-panel"]');
  return panel?.getAttribute("aria-hidden") === "false";
}

function closeMenu() {
  if (isMenuOpen()) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }
}

function sectionIsOnScreen(sectionId: string) {
  return (
    document.querySelector(`[data-tour-section="${sectionId}"]`) !== null
  );
}

// Posición del elemento dentro de la página (no cambia al desplazarse,
// solo cuando la página se recoloca porque carga contenido)
function pagePosition(el: HTMLElement): string {
  const r = el.getBoundingClientRect();
  return [
    Math.round(r.top + window.scrollY),
    Math.round(r.left + window.scrollX),
    Math.round(r.width),
    Math.round(r.height),
  ].join(",");
}

// ¿Se ve el elemento en la pantalla (en el sitio que le toca)?
function isInViewport(el: HTMLElement, cardAtTop = false): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;

  // Tarjeta arriba: el elemento debe empezar justo debajo de la tarjeta
  if (cardAtTop) {
    return Math.abs(r.top - BELOW_CARD) < 24;
  }

  // Elementos muy altos: basta con que su parte de arriba se vea
  if (r.height > vh - TOP_BAR_HEIGHT - 32) {
    return r.top >= 0 && r.top < vh / 2;
  }

  return r.top >= TOP_BAR_HEIGHT && r.bottom <= vh - 16;
}

// Desplaza la página (sin animación) para dejar el elemento en su sitio
function centerOnScreen(el: HTMLElement, cardAtTop = false) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  let target: number;

  if (cardAtTop) {
    // El elemento empieza justo debajo de la tarjeta
    target = window.scrollY + r.top - BELOW_CARD;
  } else if (r.height > vh - TOP_BAR_HEIGHT - 32) {
    target = window.scrollY + r.top - TOP_BAR_HEIGHT - 16;
  } else {
    target = window.scrollY + r.top - (vh - r.height) / 2;
  }

  window.scrollTo({ top: Math.max(0, target), behavior: "instant" });
}

// Decide dónde colocar la tarjeta respecto al elemento iluminado
function computeCardPosition(
  rect: Rect,
  cardAtTop = false
): {
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

  // Tarjeta fija arriba, con la flecha apuntando hacia abajo al elemento
  if (cardAtTop) {
    return {
      style: { top: CARD_TOP, left },
      arrow: { bottom: -7, left: arrowX },
    };
  }

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

      {/* Pawsi pensando en el centro del ciclo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Pawsi pose="piensa" size={110} />
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

function CloseIcon() {
  return (
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
  );
}

// ---------- Componente principal ----------

export default function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const lang: Lang = locale === "en" ? "en" : "es";

  // Bienvenida en marcha
  const [active, setActive] = useState(false);
  // Guía de pantalla en marcha (id de la sección) o null
  const [section, setSection] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  // true cuando ya sabemos qué guías ha visto el usuario
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [rect, setRect] = useState<Rect | null>(null);
  // true cuando la pantalla del paso ya está lista y se puede enseñar la tarjeta
  const [ready, setReady] = useState(false);
  const [choosingLanguage, setChoosingLanguage] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  // Las preguntas iniciales son dos pantallas: idioma y tipo de cuenta
  const [setupStep, setSetupStep] = useState<"language" | "account">("language");
  const [currentAccountType, setCurrentAccountType] =
    useState<AccountType>(DEFAULT_ACCOUNT_TYPE);
  const checkedRef = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);

  const currentSection = section
    ? SECTIONS.find((s) => s.id === section) ?? null
    : null;
  const steps = currentSection ? currentSection.steps : WELCOME_STEPS;
  const step: TourStep = steps[stepIndex] ?? steps[0];
  const running = active || currentSection !== null;
  const isHidden =
    HIDDEN_PATHS.includes(pathname) || pathname.startsWith("/invite/");

  // Hay tutorial en pantalla (o aún no sabemos si va a salir)
  const tourOnScreen =
    !isHidden && (!loaded || running || choosingLanguage);

  // 0) Avisar al resto de la app (por ejemplo, a "Primeros pasos")
  useEffect(() => {
    document.documentElement.dataset.pawsTour = tourOnScreen ? "on" : "off";
    window.dispatchEvent(
      new CustomEvent(TOUR_STATE_EVENT, { detail: { running: tourOnScreen } })
    );
  }, [tourOnScreen]);

  // 1) Al entrar con sesión iniciada, cargar qué guías ha visto el usuario
  useEffect(() => {
    if (isHidden) {
      // Sin sesión (o se cerró sesión): se olvida todo para el siguiente usuario
      if (checkedRef.current) {
        checkedRef.current = false;
        setLoaded(false);
        setActive(false);
        setSection(null);
        setUserId(null);
        setSeen([]);
      }
      return;
    }
    if (checkedRef.current) return;
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
        .select("tours_seen, account_type")
        .eq("id", user.id)
        .maybeSingle();

      const seenList = profile?.tours_seen ?? [];
      if (isAccountType(profile?.account_type)) {
        setCurrentAccountType(profile.account_type);
      }
      const welcomeDone =
        seenList.includes(WELCOME_ID) || readStorage(DONE_KEY) === user.id;

      setUserId(user.id);
      setSeen(seenList);
      setLoaded(true);

      if (welcomeDone) return;

      const saved = Number(readStorage(STEP_KEY));
      const start =
        Number.isInteger(saved) && saved >= 0 && saved < WELCOME_STEPS.length
          ? saved
          : 0;

      // Elegir idioma y tipo de cuenta solo al empezar desde el principio
      // y si aún no se eligieron
      const needsLanguage = start === 0 && readStorage(LANG_KEY) !== user.id;
      const needsAccount = start === 0 && readStorage(ACCOUNT_KEY) !== user.id;

      setSection(null);
      setStepIndex(start);
      setSetupStep(needsLanguage ? "language" : "account");
      setChoosingLanguage(needsLanguage || needsAccount);
      setActive(true);
    };

    init();
  }, [isHidden]);

  // 2) Relanzar desde Ajustes: bienvenida otra vez y todas las guías de nuevo
  useEffect(() => {
    const onStart = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      removeStorage(DONE_KEY);
      removeStorage(STEP_KEY);

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        tours_seen: [],
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error("Error reiniciando las guías:", error);
      }

      setUserId(user.id);
      setSeen([]);
      setLoaded(true);
      setSection(null);
      setStepIndex(0);
      setChoosingLanguage(false);
      setActive(true);
    };

    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, []);

  // 3) Guardar el paso de la bienvenida para continuar si se recarga la página
  useEffect(() => {
    if (!active) return;
    writeStorage(STEP_KEY, String(stepIndex));
  }, [active, stepIndex]);

  // 4) La bienvenida ocurre en el inicio
  useEffect(() => {
    if (!active || choosingLanguage) return;
    if (pathname !== WELCOME_ROUTE) router.push(WELCOME_ROUTE);
  }, [active, choosingLanguage, pathname, router]);

  // 5) Buscar una pantalla con guía pendiente (cuando no hay otra en marcha)
  useEffect(() => {
    if (!loaded || active || section || choosingLanguage || isHidden) return;

    const scan = () => {
      const marks = document.querySelectorAll<HTMLElement>(
        "[data-tour-section]"
      );
      for (const mark of Array.from(marks)) {
        const id = mark.dataset.tourSection;
        if (id && SECTION_IDS.has(id) && !seen.includes(id)) {
          setStepIndex(0);
          setSection(id);
          return true;
        }
      }
      return false;
    };

    if (scan()) return;
    const interval = window.setInterval(() => {
      if (scan()) window.clearInterval(interval);
    }, SECTION_SCAN_MS);
    return () => window.clearInterval(interval);
  }, [loaded, active, section, choosingLanguage, isHidden, seen, pathname]);

  // 6) Preparar el paso: esperar a que su pantalla esté lista, abrir/cerrar
  // el menú, esperar a que el elemento deje de moverse, bajar la pantalla
  // hasta él y entonces mostrar la tarjeta (una sola vez, en su sitio).
  useEffect(() => {
    setRect(null);
    setReady(false);
    targetRef.current = null;
    if (!running || choosingLanguage) return;

    const sectionId = currentSection?.id ?? null;
    const maxTries = sectionId ? MAX_TRIES_SECTION : MAX_TRIES_WELCOME;
    const cardAtTop = step.cardAt === "top";
    let tries = 0;
    let menuHandled = false;
    let cancelled = false;
    const timeouts: number[] = [];

    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Si el elemento no está en su sitio, mueve la pantalla hasta él
    const keepVisible = () => {
      const el = targetRef.current;
      if (!el || step.openMenu) return;
      if (!isInViewport(el, cardAtTop)) {
        centerOnScreen(el, cardAtTop);
      }
    };

    // Espera a que el elemento lleve un rato sin moverse y lo muestra
    const waitUntilStable = (
      el: HTMLElement,
      previous: string,
      stableCount: number,
      attempts: number
    ) => {
      if (cancelled) return;

      const current = pagePosition(el);
      const nextStable = current === previous ? stableCount + 1 : 0;

      if (nextStable >= STABLE_CHECKS_NEEDED || attempts >= MAX_STABLE_ATTEMPTS) {
        if (!step.openMenu) {
          centerOnScreen(el, cardAtTop);
        }

        timeouts.push(
          window.setTimeout(() => {
            if (cancelled) return;
            keepVisible();
            measure();
            setReady(true);
          }, 150)
        );

        timeouts.push(
          window.setTimeout(() => {
            if (cancelled) return;
            keepVisible();
            measure();
          }, 600)
        );
        return;
      }

      timeouts.push(
        window.setTimeout(
          () => waitUntilStable(el, current, nextStable, attempts + 1),
          STABLE_CHECK_MS
        )
      );
    };

    const interval = window.setInterval(() => {
      tries += 1;

      // a) Esperar a estar en la pantalla correcta
      if (sectionId) {
        // Si el usuario se fue de la pantalla, la guía se cierra sin darla
        // por vista: volverá a salir la próxima vez que entre
        if (!sectionIsOnScreen(sectionId)) {
          if (tries >= maxTries) {
            window.clearInterval(interval);
            setSection(null);
          }
          return;
        }
      } else if (window.location.pathname !== WELCOME_ROUTE) {
        if (tries >= maxTries) {
          window.clearInterval(interval);
          setReady(true);
        }
        return;
      }

      // b) Abrir o cerrar el menú lateral (una sola vez)
      if (!menuHandled) {
        menuHandled = true;
        if (step.openMenu) {
          if (!isMenuOpen()) {
            document
              .querySelector<HTMLElement>('[data-tour="menu-button"]')
              ?.click();
          }
        } else if (step.kind === "spot") {
          closeMenu();
        }
      }

      // c) Paso sin elemento que iluminar: ya se puede mostrar
      if (!step.target) {
        window.clearInterval(interval);
        setReady(true);
        return;
      }

      // d) Buscar el elemento y esperar a que se quede quieto
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`
      );

      if (el) {
        window.clearInterval(interval);
        targetRef.current = el;
        waitUntilStable(el, pagePosition(el), 0, 0);
      } else if (tries >= maxTries) {
        // No se encontró el elemento: saltar al siguiente paso
        window.clearInterval(interval);
        if (sectionId) {
          // En una guía de pantalla, se salta el paso
          if (stepIndex + 1 < steps.length) {
            setStepIndex(stepIndex + 1);
          } else {
            finishSection();
          }
        } else {
          // En la bienvenida, se muestra centrado (no se salta)
          setReady(true);
        }
      }
    }, POLL_MS);

    // Si la página cambia de tamaño después (fotos que cargan, etc.),
    // se asegura de que el elemento siga a la vista y recoloca el recuadro
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            keepVisible();
            measure();
          })
        : null;
    resizeObserver?.observe(document.body);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      timeouts.forEach((t) => window.clearTimeout(t));
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [running, choosingLanguage, step, currentSection, pathname]);

  // Guarda en la cuenta las guías vistas
  const markSeen = async (ids: string[], completedWelcome = false) => {
    const next = Array.from(new Set([...seen, ...ids]));
    setSeen(next);
    if (!userId) return;

    const supabase = createClient();
    const updatedAt = new Date().toISOString();
    const { error } = completedWelcome
      ? await supabase.from("profiles").upsert({
          id: userId,
          tours_seen: next,
          onboarding_completed: true,
          updated_at: updatedAt,
        })
      : await supabase.from("profiles").upsert({
          id: userId,
          tours_seen: next,
          updated_at: updatedAt,
        });

    if (error) {
      console.error("Error guardando las guías vistas:", error);
    }
  };

  const finishWelcome = async () => {
    setActive(false);
    setRect(null);
    closeMenu();
    removeStorage(STEP_KEY);
    if (userId) writeStorage(DONE_KEY, userId);
    // La bienvenida ya incluye los huesitos: su guía propia no se repite
    await markSeen([WELCOME_ID, HUESITOS_ID], true);
    window.dispatchEvent(new Event(ONBOARDING_FINISHED_EVENT));
  };

  const finishSection = () => {
    const id = section;
    setSection(null);
    setRect(null);
    if (id) void markSeen([id]);
  };

  const hideAllSections = () => {
    setSection(null);
    setRect(null);
    void markSeen(Array.from(SECTION_IDS));
  };

  const close = () => {
    if (currentSection) {
      finishSection();
    } else {
      void finishWelcome();
    }
  };

  // Elegir idioma antes de empezar el tutorial
  const chooseLanguage = async (language: AppLanguage) => {
    if (savingLanguage) return;

    // Marcar como elegido para no volver a preguntar tras la recarga
    if (userId) writeStorage(LANG_KEY, userId);

    if (language === lang) {
      goToAccountOrFinishSetup();
      return;
    }

    setSavingLanguage(true);
    const saved = await saveUserLanguage(language);

    if (saved) {
      // Recarga completa: el tutorial sigue ya en el idioma elegido
      // (con la pregunta del tipo de cuenta, si falta)
      window.location.reload();
      return;
    }

    // Si falla el guardado, seguimos con el idioma actual
    setSavingLanguage(false);
    goToAccountOrFinishSetup();
  };

  // Después del idioma: preguntar el tipo de cuenta si aún no se eligió
  const goToAccountOrFinishSetup = () => {
    if (userId && readStorage(ACCOUNT_KEY) !== userId) {
      setSetupStep("account");
    } else {
      setChoosingLanguage(false);
    }
  };

  // Elegir el tipo de cuenta (particular, adiestrador, centro, refugio)
  const chooseAccountType = async (accountType: AccountType) => {
    if (savingLanguage) return;

    // Marcar como elegido para no volver a preguntar
    if (userId) writeStorage(ACCOUNT_KEY, userId);

    if (accountType === currentAccountType || !userId) {
      setChoosingLanguage(false);
      return;
    }

    setSavingLanguage(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      account_type: accountType,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      // Recarga completa: los textos de la app cambian según el tipo de cuenta
      // ("mascotas" → "perros", menú "Mis clientes"...)
      window.location.reload();
      return;
    }

    // Si falla el guardado, seguimos con el tipo actual
    console.error("Error guardando el tipo de cuenta:", error);
    setSavingLanguage(false);
    setChoosingLanguage(false);
  };

  const goNext = () => {
    if (stepIndex + 1 < steps.length) {
      setStepIndex(stepIndex + 1);
    } else {
      close();
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleTap = () => {
    targetRef.current?.click();
    goNext();
  };

  if (isHidden) return null;

  // ---------- Pantalla "¿Cómo vas a usar PAWS?" (después del idioma) ----------
  if (active && choosingLanguage && setupStep === "account") {
    return (
      <div className="paws-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-white px-6 py-8 text-center">
        <style>{TOUR_CSS}</style>

        <SpeechBubble>{ACCOUNT_UI.title[lang]}</SpeechBubble>

        <div className="paws-float">
          <Pawsi pose="piensa" size={150} />
        </div>

        <div className="grid w-full max-w-sm gap-3">
          {ACCOUNT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={savingLanguage}
              onClick={() => void chooseAccountType(option.value)}
              className="flex items-center gap-3 rounded-xl bg-[#1e3a5f] px-5 py-3 text-left text-white shadow-[0_4px_0_#0f2540] transition active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              <span className="text-2xl">{option.icon}</span>
              <span>
                <span className="block text-lg font-bold">{option.name[lang]}</span>
                <span className="block text-sm text-sky-200">
                  {option.description[lang]}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="max-w-sm text-sm text-gray-500">{ACCOUNT_UI.hint[lang]}</p>
      </div>
    );
  }

  // ---------- Pantalla "Elige tu idioma" (antes del tutorial) ----------
  if (active && choosingLanguage) {
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
          <Pawsi pose="hola" size={170} />
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

  if (!running) return null;

  const position = stepIndex + 1;
  const total = steps.length;
  const progress = Math.round((position / total) * 100);
  const canGoBack = stepIndex > 0;
  const isLast = stepIndex === steps.length - 1;

  // ---------- Pantallas completas: bienvenida, ciclo y final ----------
  if (!currentSection && step.kind !== "spot") {
    const isFinish = step.kind === "finish";

    return (
      <div className="paws-fade fixed inset-0 z-[70] flex flex-col bg-white">
        <style>{TOUR_CSS}</style>
        {isFinish && <Confetti />}

        <div className="flex items-center gap-4 px-4 pt-5 sm:px-8">
          <button
            type="button"
            onClick={close}
            aria-label={UI.close[lang]}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
          >
            <CloseIcon />
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
              {/* Bienvenida: Pawsi saluda · Final: Pawsi celebra */}
              <Pawsi pose={isFinish ? "celebra" : "hola"} size={190} />
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
                onClick={close}
                className="text-sm font-semibold text-gray-400 underline hover:text-gray-600"
              >
                {UI.skip[lang]}
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={isFinish ? close : goNext}
              className="rounded-xl bg-[#1e3a5f] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_4px_0_#0f2540] transition active:translate-y-1 active:shadow-none"
            >
              {isFinish ? UI.finish[lang] : UI.continue[lang]}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Tarjeta azul con Pawsi señalando ----------
  const cardPosition = rect
    ? computeCardPosition(rect, step.cardAt === "top")
    : null;
  const counter = currentSection
    ? `${currentSection.name[lang]} · ${position} / ${total}`
    : `${position} / ${total}`;
  const mustTap = Boolean(step.tap && rect);

  const card = (
    <div
      key={`${section ?? WELCOME_ID}-${step.id}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="paws-pop relative w-[min(360px,calc(100vw-32px))] rounded-2xl p-5 text-white shadow-2xl"
      style={{ backgroundColor: NAVY }}
    >
      {cardPosition?.arrow && (
        <span
          className="absolute h-4 w-4 rotate-45"
          style={{ ...cardPosition.arrow, backgroundColor: NAVY }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white">
            <Pawsi pose="senala" size={56} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
              {counter}
            </p>
            <h2 id="onboarding-title" className="text-lg font-bold leading-tight">
              <span className="mr-1">{step.icon}</span>
              {step.title[lang]}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={UI.close[lang]}
          className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/85">
        {step.body[lang]}
      </p>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-sky-300 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {currentSection && stepIndex === 0 ? (
          <button
            type="button"
            onClick={hideAllSections}
            className="text-xs font-semibold text-white/60 underline hover:text-white"
          >
            {UI.hideAll[lang]}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              {UI.back[lang]}
            </button>
          )}
          {!mustTap && (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] hover:bg-sky-50"
            >
              {isLast && currentSection ? UI.gotIt[lang] : UI.next[lang]}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Mientras se prepara el paso: solo la pantalla oscurecida, sin tarjeta
  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-slate-900/60"
        aria-hidden="true"
      />
    );
  }

  // Paso con un elemento iluminado
  if (rect && cardPosition) {
    const vw = typeof window !== "undefined" ? window.innerWidth : 360;
    const labelTop =
      rect.top > TOP_BAR_HEIGHT ? rect.top - 40 : rect.top + rect.height + 14;
    const labelLeft = clamp(rect.left + rect.width / 2, 60, vw - 60);

    return (
      <>
        <style>{TOUR_CSS}</style>
        <div className="fixed inset-0 z-[60]" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-white"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
          }}
        />

        {mustTap && (
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
                top: labelTop,
                left: labelLeft,
                transform: "translateX(-50%)",
              }}
            >
              👆 {UI.tapHere[lang]}
            </span>
          </>
        )}

        <div className="fixed z-[70]" style={cardPosition.style}>
          {card}
        </div>
      </>
    );
  }

  // Paso sin elemento iluminado: tarjeta centrada
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <style>{TOUR_CSS}</style>
      {card}
    </div>
  );
}