// Sesión guiada por IA: tipos, guía local de respaldo y validación.
// Se usa en el servidor (rutas de la IA) y en el navegador (tarjeta).

export const CHAT_MAX_LENGTH = 1000;

export type GuideStep = {
  title: string;
  detail: string;
  reps: string;
};

export type SessionGuideData = {
  version: 1;
  objective: string;
  warmup: string;
  steps: GuideStep[];
  levelUp: string;
  levelDown: string;
  finish: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

// ---------- Utilidades ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSteps(value: unknown): GuideStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const steps: GuideStep[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const title = text(item.title);
    const detail = text(item.detail);

    if (!title && !detail) {
      continue;
    }

    steps.push({ title, detail, reps: text(item.reps) });
  }

  return steps;
}

// ---------- Guía local (si la IA falla) ----------

export function buildLocalGuide(
  skillName: string,
  progress: number,
  duration: number | null,
  isEn: boolean
): SessionGuideData {
  if (isEn) {
    const objective =
      progress < 30
        ? `Get "${skillName}" to start happening with help, in a quiet place.`
        : progress < 80
        ? `Consolidate "${skillName}": it should happen on the first cue with little help.`
        : `Keep "${skillName}" sharp and test it with a bit more distraction.`;

    return {
      version: 1,
      objective,
      warmup: "2-3 minutes of play or easy attention work with treats to get your dog switched on.",
      steps: [
        {
          title: "Review something they know",
          detail: "Start with an easy behavior so your dog builds confidence.",
          reps: "3-5 reps",
        },
        {
          title: `Work on "${skillName}"`,
          detail: "Short blocks: reward at the exact moment and rest between blocks.",
          reps: "2-3 blocks of 5",
        },
        {
          title: "Finish on a success",
          detail: "End with an easy repetition that goes well.",
          reps: "1-2 reps",
        },
      ],
      levelUp: "If they get 8 out of 10 right, add a little difficulty: more time, more distance or some distraction.",
      levelDown: "If they miss 2 in a row, go back a step and make it easier.",
      finish:
        duration !== null
          ? `Finish with play and stick to the planned ${duration} minutes.`
          : "Finish with play. Several short sessions beat one long one.",
    };
  }

  const objective =
    progress < 30
      ? `Que "${skillName}" empiece a salir con ayuda, en un lugar tranquilo.`
      : progress < 80
      ? `Consolidar "${skillName}": que salga a la primera con pocas ayudas.`
      : `Mantener "${skillName}" y probarla con algo más de distracción.`;

  return {
    version: 1,
    objective,
    warmup: "2-3 minutos de juego o atención con premios fáciles para activar a tu perro.",
    steps: [
      {
        title: "Repasa algo que ya sepa",
        detail: "Empieza con un ejercicio fácil para que gane confianza.",
        reps: "3-5 repeticiones",
      },
      {
        title: `Trabaja "${skillName}"`,
        detail: "Bloques cortos: premia en el momento justo y descansa entre bloques.",
        reps: "2-3 bloques de 5",
      },
      {
        title: "Termina con un éxito",
        detail: "Acaba con una repetición fácil que salga bien.",
        reps: "1-2 repeticiones",
      },
    ],
    levelUp: "Si acierta 8 de cada 10, añade un poco de dificultad: más tiempo, más distancia o algo de distracción.",
    levelDown: "Si falla 2 seguidas, vuelve al paso anterior y hazlo más fácil.",
    finish:
      duration !== null
        ? `Termina con juego y respeta los ${duration} minutos previstos.`
        : "Termina con juego. Mejor varias sesiones cortas que una larga.",
  };
}

// ---------- Validar la respuesta de la IA (formato de la herramienta) ----------

export function sanitizeGuide(raw: unknown): SessionGuideData | null {
  if (!isRecord(raw)) {
    return null;
  }

  const objective = text(raw.objective);
  const steps = parseSteps(raw.steps);

  if (!objective || steps.length === 0) {
    return null;
  }

  return {
    version: 1,
    objective,
    warmup: text(raw.warmup),
    steps,
    levelUp: text(raw.level_up),
    levelDown: text(raw.level_down),
    finish: text(raw.finish),
  };
}

// ---------- Leer lo guardado en Supabase ----------

export function parseStoredGuide(value: unknown): SessionGuideData | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const objective = text(value.objective);
  const steps = parseSteps(value.steps);

  if (!objective || steps.length === 0) {
    return null;
  }

  return {
    version: 1,
    objective,
    warmup: text(value.warmup),
    steps,
    levelUp: text(value.levelUp),
    levelDown: text(value.levelDown),
    finish: text(value.finish),
  };
}

// Texto plano de la guía (para dar contexto al chat)
export function guideToPlainText(guide: SessionGuideData): string {
  const steps = guide.steps
    .map(
      (step, index) =>
        `${index + 1}. ${step.title}${step.reps ? ` (${step.reps})` : ""}: ${step.detail}`
    )
    .join("\n");

  return [
    `Objetivo: ${guide.objective}`,
    guide.warmup ? `Calentamiento: ${guide.warmup}` : "",
    `Pasos:\n${steps}`,
    guide.levelUp ? `Subir dificultad: ${guide.levelUp}` : "",
    guide.levelDown ? `Bajar dificultad: ${guide.levelDown}` : "",
    guide.finish ? `Final: ${guide.finish}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}