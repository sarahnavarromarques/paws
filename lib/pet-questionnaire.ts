// Cuestionario inicial de una mascota: preguntas, textos (es/en),
// propuesta de la IA y propuesta local de respaldo.
// Sin "use client": lo usan tanto la página como la ruta del servidor.

export type QuestionnaireLocale = "es" | "en";

export function toQuestionnaireLocale(locale: string): QuestionnaireLocale {
  return locale === "en" ? "en" : "es";
}

// ---------------------------------------------------------------------------
// Preguntas
// ---------------------------------------------------------------------------

export type SingleQuestionId =
  | "goal"
  | "experience"
  | "time"
  | "home"
  | "motivation"
  | "energy"
  | "dogs"
  | "people";

export type MultiQuestionId = "knows" | "problems" | "fears";

export type QuestionId = SingleQuestionId | MultiQuestionId | "notes";

export type QuestionOption = {
  value: string;
  es: string;
  en: string;
  // Si se marca, desmarca las demás (por ejemplo "Ninguno").
  exclusive?: boolean;
};

export type SingleQuestion = {
  id: SingleQuestionId;
  kind: "single";
  es: string;
  en: string;
  options: QuestionOption[];
};

export type MultiQuestion = {
  id: MultiQuestionId;
  kind: "multi";
  es: string;
  en: string;
  options: QuestionOption[];
};

export type TextQuestion = {
  id: "notes";
  kind: "text";
  es: string;
  en: string;
};

export type Question = SingleQuestion | MultiQuestion | TextQuestion;

const RELATION_OPTIONS: QuestionOption[] = [
  { value: "good", es: "Bien", en: "Good" },
  { value: "struggles", es: "Le cuesta", en: "Struggles" },
  { value: "reacts", es: "Reacciona mal", en: "Reacts badly" },
  { value: "unknown", es: "No lo sé", en: "I don't know" },
];

export const QUESTIONS: Question[] = [
  {
    id: "goal",
    kind: "single",
    es: "¿Cuál es el objetivo principal?",
    en: "What is the main goal?",
    options: [
      { value: "basic_obedience", es: "Obediencia básica", en: "Basic obedience" },
      { value: "home_life", es: "Convivencia en casa", en: "Living well at home" },
      { value: "calm_walks", es: "Paseos tranquilos", en: "Calm walks" },
      { value: "fci_competition", es: "Competición FCI", en: "FCI competition" },
      { value: "fix_problem", es: "Corregir un problema", en: "Fix a problem" },
      { value: "tricks_fun", es: "Trucos y diversión", en: "Tricks and fun" },
    ],
  },
  {
    id: "knows",
    kind: "multi",
    es: "¿Qué sabe hacer ya?",
    en: "What can it already do?",
    options: [
      { value: "sit", es: "Sentado", en: "Sit" },
      { value: "down", es: "Tumbado", en: "Down" },
      { value: "stay", es: "Quieto", en: "Stay" },
      { value: "recall", es: "Llamada", en: "Recall" },
      { value: "loose_leash", es: "Pasear sin tirar", en: "Loose-leash walking" },
      { value: "nothing", es: "Nada todavía", en: "Nothing yet", exclusive: true },
    ],
  },
  {
    id: "problems",
    kind: "multi",
    es: "¿Tiene algún problema de conducta?",
    en: "Any behaviour problems?",
    options: [
      { value: "pulls_leash", es: "Tira de la correa", en: "Pulls on the leash" },
      { value: "bites", es: "Muerde o mordisquea", en: "Bites or nips" },
      { value: "barks", es: "Ladra mucho", en: "Barks a lot" },
      { value: "jumps", es: "Salta encima", en: "Jumps on people" },
      { value: "ignores_recall", es: "No viene cuando le llamas", en: "Doesn't come when called" },
      { value: "separation", es: "Lo pasa mal al quedarse solo", en: "Struggles when left alone" },
      { value: "none", es: "Ninguno", en: "None", exclusive: true },
    ],
  },
  {
    id: "experience",
    kind: "single",
    es: "¿Qué experiencia tiene quien entrena?",
    en: "How experienced is the trainer?",
    options: [
      { value: "first_time", es: "Primera vez", en: "First time" },
      { value: "some", es: "Algo de experiencia", en: "Some experience" },
      { value: "professional", es: "Profesional", en: "Professional" },
    ],
  },
  {
    id: "time",
    kind: "single",
    es: "¿Cuánto tiempo al día podéis entrenar?",
    en: "How much time per day can you train?",
    options: [
      { value: "lt10", es: "Menos de 10 min", en: "Less than 10 min" },
      { value: "10_20", es: "10-20 min", en: "10-20 min" },
      { value: "20_40", es: "20-40 min", en: "20-40 min" },
      { value: "gt40", es: "Más de 40 min", en: "More than 40 min" },
    ],
  },
  {
    id: "home",
    kind: "single",
    es: "¿Dónde vive?",
    en: "Where does it live?",
    options: [
      { value: "flat", es: "Piso", en: "Flat" },
      { value: "garden", es: "Casa con jardín", en: "House with garden" },
      { value: "countryside", es: "Campo", en: "Countryside" },
    ],
  },
  {
    id: "motivation",
    kind: "single",
    es: "¿Qué le motiva más?",
    en: "What motivates it most?",
    options: [
      { value: "food", es: "Comida", en: "Food" },
      { value: "toy", es: "Juguete o pelota", en: "Toy or ball" },
      { value: "affection", es: "Caricias y voz", en: "Petting and praise" },
      { value: "unknown", es: "No lo sé", en: "I don't know" },
    ],
  },
  {
    id: "energy",
    kind: "single",
    es: "¿Qué nivel de energía tiene?",
    en: "What is its energy level?",
    options: [
      { value: "low", es: "Bajo", en: "Low" },
      { value: "medium", es: "Medio", en: "Medium" },
      { value: "high", es: "Alto", en: "High" },
    ],
  },
  {
    id: "fears",
    kind: "multi",
    es: "¿Tiene algún miedo?",
    en: "Does it have any fears?",
    options: [
      { value: "loud_noises", es: "Ruidos fuertes", en: "Loud noises" },
      { value: "strangers", es: "Personas desconocidas", en: "Strangers" },
      { value: "other_dogs", es: "Otros perros", en: "Other dogs" },
      { value: "vehicles", es: "Coches o bicis", en: "Cars or bikes" },
      { value: "none", es: "Ninguno", en: "None", exclusive: true },
    ],
  },
  {
    id: "dogs",
    kind: "single",
    es: "¿Cómo se lleva con otros perros?",
    en: "How is it with other dogs?",
    options: RELATION_OPTIONS,
  },
  {
    id: "people",
    kind: "single",
    es: "¿Cómo se lleva con las personas?",
    en: "How is it with people?",
    options: RELATION_OPTIONS,
  },
  {
    id: "notes",
    kind: "text",
    es: "¿Algo más que debamos saber?",
    en: "Anything else we should know?",
  },
];

export const NOTES_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

export type QuestionnaireAnswers = {
  goal: string;
  knows: string[];
  problems: string[];
  experience: string;
  time: string;
  home: string;
  motivation: string;
  energy: string;
  fears: string[];
  dogs: string;
  people: string;
  notes: string;
};

export const EMPTY_ANSWERS: QuestionnaireAnswers = {
  goal: "",
  knows: [],
  problems: [],
  experience: "",
  time: "",
  home: "",
  motivation: "",
  energy: "",
  fears: [],
  dogs: "",
  people: "",
  notes: "",
};

export function isQuestionAnswered(
  question: Question,
  answers: QuestionnaireAnswers
): boolean {
  if (question.kind === "text") {
    return true; // opcional
  }

  if (question.kind === "multi") {
    return answers[question.id].length > 0;
  }

  return answers[question.id] !== "";
}

function findOption(question: Question, value: string): QuestionOption | null {
  if (question.kind === "text") return null;
  return question.options.find((option) => option.value === value) ?? null;
}

// Comprueba que las respuestas recibidas (por ejemplo en la API) son válidas.
export function sanitizeAnswers(raw: unknown): QuestionnaireAnswers | null {
  if (!raw || typeof raw !== "object") return null;

  const input = raw as Record<string, unknown>;
  const result: QuestionnaireAnswers = { ...EMPTY_ANSWERS };

  for (const question of QUESTIONS) {
    const value = input[question.id];

    if (question.kind === "text") {
      result.notes =
        typeof value === "string" ? value.trim().slice(0, NOTES_MAX_LENGTH) : "";
      continue;
    }

    if (question.kind === "multi") {
      if (!Array.isArray(value)) return null;
      const valid = Array.from(
        new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && findOption(question, item) !== null
          )
        )
      );
      if (valid.length === 0) return null;
      result[question.id] = valid;
      continue;
    }

    if (typeof value !== "string" || !findOption(question, value)) return null;
    result[question.id] = value;
  }

  return result;
}

// Texto legible de las respuestas (para la IA o para mostrar).
export function describeAnswers(
  answers: QuestionnaireAnswers,
  locale: QuestionnaireLocale
): string {
  return QUESTIONS.map((question) => {
    const title = question[locale];

    if (question.kind === "text") {
      const text = answers.notes.trim();
      return `${title} ${text || (locale === "en" ? "(nothing)" : "(nada)")}`;
    }

    const values =
      question.kind === "multi" ? answers[question.id] : [answers[question.id]];

    const labels = values
      .map((value) => findOption(question, value)?.[locale])
      .filter((label): label is string => Boolean(label));

    return `${title} ${labels.join(", ")}`;
  }).join("\n");
}

export function getOptionLabel(
  questionId: QuestionId,
  value: string,
  locale: QuestionnaireLocale
): string {
  const question = QUESTIONS.find((q) => q.id === questionId);
  if (!question) return value;
  return findOption(question, value)?.[locale] ?? value;
}

// ---------------------------------------------------------------------------
// Catálogo y propuesta
// ---------------------------------------------------------------------------

export type CatalogSkill = {
  id: number;
  name: string;
  nameEn: string | null;
  category: string | null;
  categoryEn: string | null;
  difficulty: string | null;
};

export type ProposalGroup = {
  name: string;
  reason: string;
  skillIds: number[];
};

export type QuestionnaireProposal = {
  locale: QuestionnaireLocale;
  objective: string;
  summary: string;
  groups: ProposalGroup[];
};

export const MAX_PROPOSAL_GROUPS = 5;
export const MAX_SKILLS_PER_GROUP = 8;

// Solo se limitan los campos que se guardan como datos cortos.
// El resumen y los motivos no tienen límite: cuanto más detalle, mejor.
const OBJECTIVE_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 60;

// Recorta un texto sin partir palabras: intenta acabar en una frase
// completa; si no, corta en el último espacio y añade "…".
function smartTrim(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max);

  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );

  if (lastSentenceEnd > max * 0.5) {
    return slice.slice(0, lastSentenceEnd + 1);
  }

  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[,;:\s]+$/, "")}…`;
}

function cleanShortText(value: unknown, max: number): string {
  return typeof value === "string" ? smartTrim(value, max) : "";
}

function cleanLongText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function skillSetKey(skillIds: number[]): string {
  return [...skillIds].sort((a, b) => a - b).join(",");
}

// Valida la respuesta de la IA: solo habilidades del catálogo, sin grupos
// vacíos, sin nombres ni conjuntos de habilidades repetidos.
export function sanitizeProposal(
  raw: unknown,
  catalog: CatalogSkill[],
  locale: QuestionnaireLocale
): QuestionnaireProposal | null {
  if (!raw || typeof raw !== "object") return null;

  const input = raw as Record<string, unknown>;
  const catalogIds = new Set(catalog.map((skill) => skill.id));

  const objective = cleanShortText(input.objective, OBJECTIVE_MAX_LENGTH);
  const summary = cleanLongText(input.summary);

  if (!objective || !Array.isArray(input.groups)) return null;

  const groups: ProposalGroup[] = [];
  const usedNames = new Set<string>();
  const usedSets = new Set<string>();

  for (const rawGroup of input.groups) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    if (groups.length >= MAX_PROPOSAL_GROUPS) break;

    const group = rawGroup as Record<string, unknown>;
    const name = cleanShortText(group.name, NAME_MAX_LENGTH);
    const reason = cleanLongText(group.reason);
    const rawIds = Array.isArray(group.skill_ids) ? group.skill_ids : [];

    const skillIds = Array.from(
      new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && catalogIds.has(id))
      )
    ).slice(0, MAX_SKILLS_PER_GROUP);

    if (!name || skillIds.length === 0) continue;

    const nameKey = name.toLowerCase();
    const setKey = skillSetKey(skillIds);
    if (usedNames.has(nameKey) || usedSets.has(setKey)) continue;

    usedNames.add(nameKey);
    usedSets.add(setKey);
    groups.push({ name, reason, skillIds });
  }

  if (groups.length === 0) return null;

  return { locale, objective, summary, groups };
}

// ---------------------------------------------------------------------------
// Propuesta local de respaldo (si la IA falla)
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const CONCEPT_KEYWORDS = {
  sit: ["sentado", "sienta", "sit"],
  down: ["tumbado", "echado", "echate", "down"],
  stay: ["quieto", "stay"],
  recall: ["llamada", "recall"],
  leash: ["correa", "junto", "leash", "heel"],
  bite: ["morder", "mordisco", "bite", "biting"],
} as const;

type Concept = keyof typeof CONCEPT_KEYWORDS;

function findSkillsFor(concept: Concept, catalog: CatalogSkill[]): number[] {
  const keywords = CONCEPT_KEYWORDS[concept];
  return catalog
    .filter((skill) => {
      const text = normalize(`${skill.name} ${skill.nameEn ?? ""}`);
      return keywords.some((keyword) => text.includes(keyword));
    })
    .map((skill) => skill.id);
}

function conceptToKnows(concept: Concept): string {
  switch (concept) {
    case "sit":
      return "sit";
    case "down":
      return "down";
    case "stay":
      return "stay";
    case "recall":
      return "recall";
    case "leash":
      return "loose_leash";
    default:
      return "";
  }
}

export function buildLocalProposal(
  answers: QuestionnaireAnswers,
  catalog: CatalogSkill[],
  locale: QuestionnaireLocale
): QuestionnaireProposal {
  const en = locale === "en";
  const knows = new Set(answers.knows);

  const pick = (concepts: Concept[]): number[] =>
    Array.from(
      new Set(
        concepts
          .filter((concept) => !knows.has(conceptToKnows(concept)))
          .flatMap((concept) => findSkillsFor(concept, catalog))
      )
    ).slice(0, MAX_SKILLS_PER_GROUP);

  const candidates: ProposalGroup[] = [
    {
      name: en ? "Foundations" : "Bases",
      reason: en
        ? "Basic positions come first: everything else is built on them."
        : "Las posiciones básicas van primero: todo lo demás se apoya en ellas.",
      skillIds: pick(["sit", "down", "stay"]),
    },
    {
      name: en ? "Walks and recall" : "Paseo y llamada",
      reason: en
        ? "Walking calmly and coming when called make daily life easier."
        : "Pasear sin tirar y venir cuando le llamas facilitan el día a día.",
      skillIds: pick(["recall", "leash"]),
    },
  ];

  if (answers.problems.includes("bites")) {
    candidates.push({
      name: en ? "Good manners" : "Buenos modales",
      reason: en
        ? "You said it bites or nips: working on it early helps a lot."
        : "Has indicado que muerde o mordisquea: trabajarlo pronto ayuda mucho.",
      skillIds: findSkillsFor("bite", catalog).slice(0, MAX_SKILLS_PER_GROUP),
    });
  }

  let groups = candidates.filter((group) => group.skillIds.length > 0);

  // Si no ha encontrado nada, un grupo con las primeras habilidades del catálogo.
  if (groups.length === 0 && catalog.length > 0) {
    groups = [
      {
        name: en ? "First steps" : "Primeros pasos",
        reason: en
          ? "A short set of skills to start training."
          : "Un pequeño conjunto de habilidades para empezar a entrenar.",
        skillIds: catalog.slice(0, 4).map((skill) => skill.id),
      },
    ];
  }

  const goalLabel = getOptionLabel("goal", answers.goal, locale);
  const problemLabels = answers.problems
    .filter((value) => value !== "none")
    .map((value) => getOptionLabel("problems", value, locale));

  const objective =
    problemLabels.length > 0
      ? `${goalLabel}. ${en ? "Work on" : "Trabajar"}: ${problemLabels.join(", ").toLowerCase()}.`
      : `${goalLabel}.`;

  return {
    locale,
    objective: smartTrim(objective, OBJECTIVE_MAX_LENGTH),
    summary: en
      ? "Basic proposal built from your answers."
      : "Propuesta básica creada a partir de tus respuestas.",
    groups,
  };
}

// ---------------------------------------------------------------------------
// Textos de la pantalla (es/en)
// ---------------------------------------------------------------------------

const TEXTS = {
  es: {
    title: "Conozcamos a {name}",
    subtitle: "Unas preguntas rápidas para crear su plan de entrenamiento.",
    stepOf: "Pregunta {current} de {total}",
    multiHint: "Puedes marcar varias.",
    notesPlaceholder: "Por ejemplo: es adoptado, tiene una lesión, vive con un gato…",
    back: "Atrás",
    next: "Siguiente",
    finish: "Crear mi plan",
    skip: "Saltar",
    loading: "Cargando…",
    noPet: "No se ha encontrado la mascota.",
    backToPets: "Volver a mascotas",
    generating: "La IA está preparando el plan…",
    errorGenerate: "No se pudo generar la propuesta. Inténtalo de nuevo.",
    reviewTitle: "Plan propuesto para {name}",
    reviewSubtitle: "Revísalo: puedes cambiar el objetivo y quitar grupos o habilidades. El objetivo se guarda en la ficha; los grupos, al aceptar.",
    fallbackNotice: "La IA no estaba disponible: esta es una propuesta básica. Puedes aceptarla o volver a intentarlo.",
    objectiveLabel: "Objetivo",
    groupsLabel: "Grupos de habilidades",
    includeGroup: "Incluir este grupo",
    tapToRemove: "Toca una habilidad para quitarla o volver a añadirla.",
    editAnswers: "Cambiar respuestas",
    retry: "Volver a generar",
    accept: "Aceptar y guardar",
    accepting: "Guardando y calculando el orden…",
    errorObjective: "Escribe un objetivo.",
    errorNoGroups: "Incluye al menos un grupo con alguna habilidad.",
    errorSave: "No se pudo guardar el plan. Inténtalo de nuevo.",
    skippedDuplicates: "Algunos grupos ya existían y no se han duplicado.",
    profileButton: "📝 Cuestionario inicial",
  },
  en: {
    title: "Let's get to know {name}",
    subtitle: "A few quick questions to build its training plan.",
    stepOf: "Question {current} of {total}",
    multiHint: "You can choose several.",
    notesPlaceholder: "For example: adopted, has an injury, lives with a cat…",
    back: "Back",
    next: "Next",
    finish: "Create my plan",
    skip: "Skip",
    loading: "Loading…",
    noPet: "Pet not found.",
    backToPets: "Back to pets",
    generating: "The AI is preparing the plan…",
    errorGenerate: "The proposal could not be generated. Please try again.",
    reviewTitle: "Proposed plan for {name}",
    reviewSubtitle: "Review it: you can change the goal and remove groups or skills. The goal is saved to the profile; the groups, when you accept.",
    fallbackNotice: "The AI was not available: this is a basic proposal. You can accept it or try again.",
    objectiveLabel: "Goal",
    groupsLabel: "Skill groups",
    includeGroup: "Include this group",
    tapToRemove: "Tap a skill to remove it or add it back.",
    editAnswers: "Change answers",
    retry: "Generate again",
    accept: "Accept and save",
    accepting: "Saving and calculating the order…",
    errorObjective: "Write a goal.",
    errorNoGroups: "Include at least one group with some skill.",
    errorSave: "The plan could not be saved. Please try again.",
    skippedDuplicates: "Some groups already existed and were not duplicated.",
    profileButton: "📝 Initial questionnaire",
  },
} as const;

export type QuestionnaireTextKey = keyof (typeof TEXTS)["es"];

export function questionnaireText(
  locale: QuestionnaireLocale,
  key: QuestionnaireTextKey,
  values?: Record<string, string | number>
): string {
  let text: string = TEXTS[locale][key];
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}