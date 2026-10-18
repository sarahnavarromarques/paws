// Cálculo compartido del progreso de cada habilidad de un perro.
// Lo usan la ficha del perro y la pantalla de progreso.

export type SkillProgressItem = {
  skillId: number;
  name: string;
  category: string | null;
  progress: number;
  sessionCount: number;
  lastTrainedDays: number | null;
};

type PetSkillInput = {
  skill_id: number;
  auto_progress: number | null;
};

type CompletedTrainingInput = {
  skill_id?: number | null;
  date: string | null;
};

// Días desde una fecha (YYYY-MM-DD) hasta hoy; null si no hay fecha o es futura
export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) {
    return null;
  }

  const then = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
}

// Une el progreso de cada habilidad con sus sesiones completadas.
// Devuelve la lista ordenada de mayor a menor progreso.
export function buildSkillProgressItems(
  petSkills: PetSkillInput[],
  completedTrainings: CompletedTrainingInput[],
  getName: (skillId: number) => string,
  getCategory: (skillId: number) => string | null
): SkillProgressItem[] {
  const statsBySkill = new Map<
    number,
    { count: number; lastDate: string | null }
  >();

  for (const training of completedTrainings) {
    if (training.skill_id === null || training.skill_id === undefined) {
      continue;
    }

    const current = statsBySkill.get(training.skill_id) ?? {
      count: 0,
      lastDate: null,
    };

    current.count += 1;

    if (
      training.date &&
      (current.lastDate === null || training.date > current.lastDate)
    ) {
      current.lastDate = training.date;
    }

    statsBySkill.set(training.skill_id, current);
  }

  return petSkills
    .map((row) => {
      const stats = statsBySkill.get(row.skill_id);

      return {
        skillId: row.skill_id,
        name: getName(row.skill_id),
        category: getCategory(row.skill_id),
        progress: row.auto_progress ?? 0,
        sessionCount: stats?.count ?? 0,
        lastTrainedDays: daysSince(stats?.lastDate ?? null),
      };
    })
    .sort((a, b) => b.progress - a.progress);
}

// Progreso medio de todas las habilidades (0 si no hay ninguna)
export function averageSkillProgress(items: SkillProgressItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  return Math.round(
    items.reduce((sum, item) => sum + item.progress, 0) / items.length
  );
}