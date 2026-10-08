// Orden de entrenamiento recomendado: tipos, orden local de respaldo y validación.
// Se usa en el servidor (ruta de la IA) y en el navegador (ficha y panel).

export const MASTERED_THRESHOLD = 80;

export type OrderSkill = {
  skillId: number;
  reasonEs: string;
  reasonEn: string;
};

export type OrderGroup = {
  groupId: number;
  reasonEs: string;
  reasonEn: string;
  skills: OrderSkill[];
};

export type TrainingOrderData = {
  version: 1;
  summaryEs: string;
  summaryEn: string;
  nextSkillId: number | null;
  groups: OrderGroup[];
};

export type OrderInputSkill = {
  skillId: number;
  name: string;
  nameEn: string | null;
  category: string | null;
  progress: number;
  sessionCount: number;
  isGoal: boolean;
};

export type OrderInputGroup = {
  groupId: number;
  name: string;
  skills: OrderInputSkill[];
};

// Grupos tal como están ahora (para comparar con un orden guardado)
export type CurrentGroup = {
  groupId: number;
  skillIds: number[];
};

// ---------- Utilidades ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : fallback;
}

export function isMastered(progress: number): boolean {
  return progress >= MASTERED_THRESHOLD;
}

function compareSkills(a: OrderInputSkill, b: OrderInputSkill): number {
  const aMastered = isMastered(a.progress);
  const bMastered = isMastered(b.progress);

  // Las dominadas van al final, como repaso
  if (aMastered !== bMastered) {
    return aMastered ? 1 : -1;
  }

  // El objetivo de la mascota va primero
  if (a.isGoal !== b.isGoal) {
    return a.isGoal ? -1 : 1;
  }

  return a.progress - b.progress;
}

function groupAverage(group: OrderInputGroup): number {
  if (group.skills.length === 0) {
    return 100;
  }

  return Math.round(
    group.skills.reduce((sum, skill) => sum + skill.progress, 0) /
      group.skills.length
  );
}

function localSkillReason(skill: OrderInputSkill): { es: string; en: string } {
  const p = skill.progress;

  if (isMastered(p)) {
    return {
      es: `Ya dominada (${p}%): repásala de vez en cuando.`,
      en: `Already mastered (${p}%): review it now and then.`,
    };
  }

  if (skill.isGoal) {
    return {
      es: `Es el objetivo de la mascota (${p}%).`,
      en: `It's the pet's goal (${p}%).`,
    };
  }

  if (p === 0) {
    return {
      es: "Aún sin progreso: empieza por aquí.",
      en: "No progress yet: start here.",
    };
  }

  return {
    es: `Progreso actual: ${p}%.`,
    en: `Current progress: ${p}%.`,
  };
}

function buildProgressMap(groups: OrderInputGroup[]): Map<number, number> {
  const map = new Map<number, number>();

  for (const group of groups) {
    for (const skill of group.skills) {
      map.set(skill.skillId, skill.progress);
    }
  }

  return map;
}

// ---------- Siguiente habilidad (regla única para ficha y panel) ----------
// Recorre el orden guardado quedándose solo con lo que sigue existiendo.
// 1) La que eligió la IA, si sigue en sus grupos.
// 2) Si no, la primera no dominada.
// 3) Si todo está dominado, la primera.

export function resolveNextSkillId(
  order: TrainingOrderData,
  currentGroups: CurrentGroup[],
  progressById: Map<number, number>
): number | null {
  const currentById = new Map(
    currentGroups.map((group) => [group.groupId, new Set(group.skillIds)])
  );

  const ordered: number[] = [];

  for (const orderGroup of order.groups) {
    const skillSet = currentById.get(orderGroup.groupId);

    if (!skillSet) {
      continue;
    }

    for (const orderSkill of orderGroup.skills) {
      if (skillSet.has(orderSkill.skillId)) {
        ordered.push(orderSkill.skillId);
      }
    }
  }

  if (order.nextSkillId !== null && ordered.includes(order.nextSkillId)) {
    return order.nextSkillId;
  }

  return (
    ordered.find((skillId) => !isMastered(progressById.get(skillId) ?? 0)) ??
    ordered[0] ??
    null
  );
}

// Primera habilidad no dominada siguiendo el orden; si todo está dominado, la primera.
function pickNextSkill(
  order: OrderGroup[],
  inputs: OrderInputGroup[]
): number | null {
  return resolveNextSkillId(
    {
      version: 1,
      summaryEs: "",
      summaryEn: "",
      nextSkillId: null,
      groups: order,
    },
    inputs.map((group) => ({
      groupId: group.groupId,
      skillIds: group.skills.map((skill) => skill.skillId),
    })),
    buildProgressMap(inputs)
  );
}

// ---------- Orden local (si la IA falla) ----------

export function buildLocalOrder(groups: OrderInputGroup[]): TrainingOrderData {
  const sortedGroups = [...groups].sort(
    (a, b) => groupAverage(a) - groupAverage(b)
  );

  const orderGroups: OrderGroup[] = sortedGroups.map((group) => {
    const avg = groupAverage(group);

    return {
      groupId: group.groupId,
      reasonEs: `Progreso medio del grupo: ${avg}%.`,
      reasonEn: `Group average progress: ${avg}%.`,
      skills: [...group.skills].sort(compareSkills).map((skill) => {
        const reason = localSkillReason(skill);

        return {
          skillId: skill.skillId,
          reasonEs: reason.es,
          reasonEn: reason.en,
        };
      }),
    };
  });

  return {
    version: 1,
    summaryEs:
      "Orden calculado con reglas simples: primero lo que tiene menos progreso y lo ya dominado al final.",
    summaryEn:
      "Order calculated with simple rules: least progress first, mastered skills last.",
    nextSkillId: pickNextSkill(orderGroups, groups),
    groups: orderGroups,
  };
}

// ---------- Validar la respuesta de la IA ----------
// Solo acepta ids que existen. Si la IA olvida algún grupo o habilidad,
// se añade al final con el orden local. Si la respuesta no sirve, devuelve null.

export function sanitizeOrder(
  raw: unknown,
  inputs: OrderInputGroup[]
): TrainingOrderData | null {
  if (!isRecord(raw) || !Array.isArray(raw.groups)) {
    return null;
  }

  const local = buildLocalOrder(inputs);
  const inputById = new Map(inputs.map((group) => [group.groupId, group]));
  const localById = new Map(local.groups.map((group) => [group.groupId, group]));

  const usedGroups = new Set<number>();
  const result: OrderGroup[] = [];

  for (const rawGroup of raw.groups) {
    if (!isRecord(rawGroup)) {
      continue;
    }

    const groupId = Number(rawGroup.group_id);
    const input = inputById.get(groupId);

    if (!input || usedGroups.has(groupId)) {
      continue;
    }

    usedGroups.add(groupId);

    const localGroup = localById.get(groupId);
    const validSkillIds = new Set(input.skills.map((skill) => skill.skillId));
    const usedSkills = new Set<number>();
    const skills: OrderSkill[] = [];

    if (Array.isArray(rawGroup.skills)) {
      for (const rawSkill of rawGroup.skills) {
        if (!isRecord(rawSkill)) {
          continue;
        }

        const skillId = Number(rawSkill.skill_id);

        if (!validSkillIds.has(skillId) || usedSkills.has(skillId)) {
          continue;
        }

        usedSkills.add(skillId);

        const localSkill = localGroup?.skills.find(
          (skill) => skill.skillId === skillId
        );

        skills.push({
          skillId,
          reasonEs: text(rawSkill.reason_es, localSkill?.reasonEs ?? ""),
          reasonEn: text(rawSkill.reason_en, localSkill?.reasonEn ?? ""),
        });
      }
    }

    for (const localSkill of localGroup?.skills ?? []) {
      if (!usedSkills.has(localSkill.skillId)) {
        skills.push(localSkill);
      }
    }

    result.push({
      groupId,
      reasonEs: text(rawGroup.reason_es, localGroup?.reasonEs ?? ""),
      reasonEn: text(rawGroup.reason_en, localGroup?.reasonEn ?? ""),
      skills,
    });
  }

  if (result.length === 0) {
    return null;
  }

  for (const localGroup of local.groups) {
    if (!usedGroups.has(localGroup.groupId)) {
      result.push(localGroup);
    }
  }

  const allSkillIds = new Set(
    inputs.flatMap((group) => group.skills.map((skill) => skill.skillId))
  );

  const rawNext = Number(raw.next_skill_id);

  return {
    version: 1,
    summaryEs: text(raw.summary_es, local.summaryEs),
    summaryEn: text(raw.summary_en, local.summaryEn),
    nextSkillId: allSkillIds.has(rawNext)
      ? rawNext
      : pickNextSkill(result, inputs),
    groups: result,
  };
}

// ---------- Leer lo guardado en Supabase ----------

export function parseStoredOrder(value: unknown): TrainingOrderData | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) {
    return null;
  }

  const groups: OrderGroup[] = [];

  for (const rawGroup of value.groups) {
    if (!isRecord(rawGroup) || typeof rawGroup.groupId !== "number") {
      continue;
    }

    const skills: OrderSkill[] = [];

    if (Array.isArray(rawGroup.skills)) {
      for (const rawSkill of rawGroup.skills) {
        if (!isRecord(rawSkill) || typeof rawSkill.skillId !== "number") {
          continue;
        }

        skills.push({
          skillId: rawSkill.skillId,
          reasonEs: text(rawSkill.reasonEs, ""),
          reasonEn: text(rawSkill.reasonEn, ""),
        });
      }
    }

    groups.push({
      groupId: rawGroup.groupId,
      reasonEs: text(rawGroup.reasonEs, ""),
      reasonEn: text(rawGroup.reasonEn, ""),
      skills,
    });
  }

  return {
    version: 1,
    summaryEs: text(value.summaryEs, ""),
    summaryEn: text(value.summaryEn, ""),
    nextSkillId:
      typeof value.nextSkillId === "number" ? value.nextSkillId : null,
    groups,
  };
}