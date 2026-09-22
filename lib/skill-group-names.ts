// Generador de nombres para grupos de habilidades.
// Red de seguridad si la IA falla. Soporta español e inglés.

export type GroupSkillInput = {
  id: number;
  name: string;
  category: string | null;
};

// Nombres sugeridos según la categoría dominante del grupo (español).
const CATEGORY_NAMES: Record<string, string[]> = {
  Posiciones: [
    "Posiciones",
    "Posturas",
    "Base postural",
    "Control de posturas",
    "Posiciones básicas",
    "Dominio postural",
    "Cambios de posición",
    "Postura firme",
  ],
  Control: [
    "Autocontrol",
    "Serenidad",
    "Calma",
    "Control avanzado",
    "Rutina de calma",
    "Autodominio",
    "Paciencia",
    "Modo zen",
    "Quietud",
    "Templanza",
  ],
  Llamada: [
    "Llamada",
    "Regreso",
    "Vuelta segura",
    "Llamada perfecta",
    "Regreso fiable",
    "Ven aquí",
    "Llamada bajo control",
    "Retorno",
  ],
  Paseo: [
    "Paseo",
    "Marcha",
    "Junto a mí",
    "Paseo perfecto",
    "Marcha controlada",
    "Correa floja",
    "Paseo tranquilo",
    "Junto sin correa",
  ],
  "Obediencia FCI": [
    "Obediencia",
    "Competición",
    "Ring FCI",
    "Nivel competición",
    "Obediencia de concurso",
    "Rutina FCI",
    "Preparación ring",
    "Nivel pro",
  ],
};

// Mismas categorías, sugerencias en inglés.
const CATEGORY_NAMES_EN: Record<string, string[]> = {
  Posiciones: [
    "Positions",
    "Postures",
    "Posture basics",
    "Posture control",
    "Basic positions",
    "Posture mastery",
    "Position changes",
    "Steady posture",
  ],
  Control: [
    "Self-control",
    "Serenity",
    "Calm",
    "Advanced control",
    "Calm routine",
    "Self-mastery",
    "Patience",
    "Zen mode",
    "Stillness",
    "Composure",
  ],
  Llamada: [
    "Recall",
    "Return",
    "Safe return",
    "Perfect recall",
    "Reliable return",
    "Come here",
    "Controlled recall",
    "Homecoming",
  ],
  Paseo: [
    "Walk",
    "Heel",
    "By my side",
    "Perfect walk",
    "Controlled heel",
    "Loose leash",
    "Calm walk",
    "Off-leash heel",
  ],
  "Obediencia FCI": [
    "Obedience",
    "Competition",
    "FCI ring",
    "Competition level",
    "Show obedience",
    "FCI routine",
    "Ring prep",
    "Pro level",
  ],
};

// Nombres genéricos que sirven para cualquier grupo (español).
const THEMATIC_POOL = [
  "Fundamentos",
  "Esenciales",
  "Rutina diaria",
  "Equilibrio",
  "Enfoque",
  "Progreso",
  "Constancia",
  "Conexión",
  "Disciplina",
  "Dominio",
  "Base sólida",
  "Buenos hábitos",
  "Rutina base",
  "Primeros pasos",
  "Nivel inicial",
  "Nivel intermedio",
  "Nivel avanzado",
  "Repaso",
  "Entrenamiento diario",
  "Mi rutina",
  "Sesión completa",
  "Bloque de trabajo",
  "Habilidades clave",
  "Combo básico",
  "Combo pro",
  "Modo entreno",
  "Superación",
  "Confianza",
  "Vínculo",
  "Trabajo fino",
  "Puesta a punto",
  "Objetivo semanal",
];

// Mismo pool, en inglés.
const THEMATIC_POOL_EN = [
  "Fundamentals",
  "Essentials",
  "Daily routine",
  "Balance",
  "Focus",
  "Progress",
  "Consistency",
  "Connection",
  "Discipline",
  "Mastery",
  "Solid base",
  "Good habits",
  "Base routine",
  "First steps",
  "Beginner level",
  "Intermediate level",
  "Advanced level",
  "Review",
  "Daily training",
  "My routine",
  "Full session",
  "Work block",
  "Key skills",
  "Basic combo",
  "Pro combo",
  "Training mode",
  "Growth",
  "Confidence",
  "Bond",
  "Fine-tuning",
  "Tune-up",
  "Weekly goal",
];

// Firma única de un grupo: la lista de ids ordenada.
// Sirve para detectar grupos con exactamente las mismas habilidades.
export function buildGroupSignature(skillIds: number[]): string {
  return [...skillIds].sort((a, b) => a - b).join("-");
}

// Lista ordenada de nombres base según las habilidades del grupo y el idioma.
// Las categorías (s.category) siguen guardadas en español en la base de datos;
// solo cambia el idioma de las SUGERENCIAS.
function baseSuggestions(
  skills: GroupSkillInput[],
  locale: string
): string[] {
  const categoryNames = locale === "en" ? CATEGORY_NAMES_EN : CATEGORY_NAMES;
  const thematicPool = locale === "en" ? THEMATIC_POOL_EN : THEMATIC_POOL;

  const suggestions: string[] = [];

  // Contar categorías para saber cuál domina.
  const counts = new Map<string, number>();
  skills.forEach((s) => {
    if (s.category) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([category]) => {
    const names = categoryNames[category];
    if (names) names.forEach((n) => suggestions.push(n));
  });

  thematicPool.forEach((n) => suggestions.push(n));

  // Quitar duplicados manteniendo el orden.
  return Array.from(new Set(suggestions));
}

// Lista de nombres DISPONIBLES (que el perro no tenga ya usados),
// añadiendo variantes numeradas si hiciera falta para no quedarse sin opciones.
export function buildAvailableGroupNames(
  skills: GroupSkillInput[],
  takenNames: string[],
  locale: string = "es"
): string[] {
  const taken = new Set(takenNames.map((n) => n.trim().toLowerCase()));
  const base = baseSuggestions(skills, locale);

  const available: string[] = [];

  for (const name of base) {
    if (!taken.has(name.toLowerCase())) available.push(name);
  }

  // Variantes numeradas como respaldo: "Fundamentos 2", "Fundamentos 3"...
  let counter = 2;
  while (available.length < 40 && counter <= 50) {
    for (const name of base) {
      const variant = `${name} ${counter}`;
      if (!taken.has(variant.toLowerCase()) && !available.includes(variant)) {
        available.push(variant);
      }
    }
    counter++;
  }

  return available;
}