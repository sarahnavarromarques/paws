import type { createClient } from "@/lib/supabase/client";
import {
  parseStoredOrder,
  resolveNextSkillId,
} from "@/lib/training-order";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

// Recomendación del día para un perro:
// entrenamiento pendiente de hoy, habilidad a reforzar y progreso medio
export type PetPlan = {
  petId: number;
  petName: string;
  skillCount: number;
  averageProgress: number;
  todayTrainingId: number | null;
  todayTrainingTitle: string | null;
  reinforceSkillId: number | null;
  reinforceSkillName: string | null;
};

type PlanPet = {
  id: number;
  name: string;
};

type Training = {
  id: number;
  title: string;
  date: string | null;
  status: string;
  pet_id: number;
};

type PetSkillRow = {
  pet_id: number;
  skill_id: number;
  auto_progress: number | null;
};

type SkillInfo = {
  id: number;
  name: string;
  name_en: string | null;
};

type GroupRow = {
  id: number;
  pet_id: number | null;
};

type GroupItemRow = {
  group_id: number;
  skill_id: number;
};

type OrderRow = {
  pet_id: number;
  data: unknown;
};

function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function loadPetPlans(
  supabase: SupabaseBrowserClient,
  userId: string,
  pets: PlanPet[],
  locale: string
): Promise<PetPlan[]> {
  if (pets.length === 0) {
    return [];
  }

  const petIds = pets.map((p) => p.id);

  // --- Entrenamientos pendientes ---
  const { data: trainingsData } = await supabase
    .from("trainings")
    .select("id, title, date, status, pet_id")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  const trainings: Training[] = (trainingsData ?? []).map((tr) => ({
    id: tr.id,
    title: tr.title,
    date: tr.date,
    status: tr.status ?? "",
    pet_id: tr.pet_id,
  }));

  const pending = trainings.filter((tr) => tr.status !== "completed");

  // --- Habilidades, grupos y orden recomendado por perro ---
  let skillsInfo: SkillInfo[] = [];
  let groupItemRows: GroupItemRow[] = [];

  const { data: petSkillsData } = await supabase
    .from("pet_skills")
    .select("pet_id, skill_id, auto_progress")
    .in("pet_id", petIds);

  const petSkills: PetSkillRow[] = (petSkillsData ?? []).map((row) => ({
    pet_id: row.pet_id,
    skill_id: row.skill_id,
    auto_progress: row.auto_progress,
  }));

  const { data: groupsData } = await supabase
    .from("skill_groups")
    .select("id, pet_id")
    .in("pet_id", petIds);

  const groupRows: GroupRow[] = groupsData ?? [];

  if (groupRows.length > 0) {
    const { data: itemsData } = await supabase
      .from("skill_group_items")
      .select("group_id, skill_id")
      .in(
        "group_id",
        groupRows.map((g) => g.id)
      );

    groupItemRows = itemsData ?? [];
  }

  const { data: ordersData } = await supabase
    .from("training_order_recommendations")
    .select("pet_id, data")
    .in("pet_id", petIds);

  const orderRows: OrderRow[] = ordersData ?? [];

  // Nombres de las habilidades del perro y de sus grupos
  const skillIds = Array.from(
    new Set([
      ...petSkills.map((ps) => ps.skill_id),
      ...groupItemRows.map((item) => item.skill_id),
    ])
  );

  if (skillIds.length > 0) {
    const { data: skillsData } = await supabase
      .from("skills")
      .select("id, name, name_en")
      .in("id", skillIds);

    skillsInfo = skillsData ?? [];
  }

  const skillsMap = new Map(skillsInfo.map((s) => [s.id, s]));
  const today = todayISO();

  function skillName(skillId: number): string | null {
    const skill = skillsMap.get(skillId);
    if (!skill) {
      return null;
    }
    return locale === "en" && skill.name_en ? skill.name_en : skill.name;
  }

  return pets.map((pet) => {
    const rows = petSkills.filter((ps) => ps.pet_id === pet.id);
    const skillCount = rows.length;

    const averageProgress =
      skillCount === 0
        ? 0
        : Math.round(
            rows.reduce((sum, r) => sum + (r.auto_progress ?? 0), 0) /
              skillCount
          );

    // 1) ¿Hay un entrenamiento pendiente para HOY?
    const todayTraining =
      pending.find((tr) => tr.pet_id === pet.id && tr.date === today) ?? null;

    let reinforceSkillId: number | null = null;

    if (!todayTraining && skillCount > 0) {
      // 2) Si hay orden calculado, la siguiente según ese orden
      const orderRow = orderRows.find((row) => row.pet_id === pet.id);
      const order = orderRow ? parseStoredOrder(orderRow.data) : null;

      if (order) {
        const currentGroups = groupRows
          .filter((g) => g.pet_id === pet.id)
          .map((g) => ({
            groupId: g.id,
            skillIds: groupItemRows
              .filter((item) => item.group_id === g.id)
              .map((item) => item.skill_id),
          }));

        const progressById = new Map(
          rows.map((r) => [r.skill_id, r.auto_progress ?? 0])
        );

        reinforceSkillId = resolveNextSkillId(
          order,
          currentGroups,
          progressById
        );
      }

      // 3) Si no hay orden, la habilidad con menor progreso
      if (reinforceSkillId === null) {
        const lowest = [...rows].sort(
          (a, b) => (a.auto_progress ?? 0) - (b.auto_progress ?? 0)
        )[0];
        reinforceSkillId = lowest.skill_id;
      }
    }

    return {
      petId: pet.id,
      petName: pet.name,
      skillCount,
      averageProgress,
      todayTrainingId: todayTraining?.id ?? null,
      todayTrainingTitle: todayTraining?.title ?? null,
      reinforceSkillId,
      reinforceSkillName:
        reinforceSkillId !== null ? skillName(reinforceSkillId) : null,
    };
  });
}