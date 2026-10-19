"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import PawsiLoading from "@/components/PawsiLoading";
import TrainingOrder, {
  type TrainingOrderFallback,
  type TrainingOrderGroupView,
} from "@/components/TrainingOrder";
import { parseStoredOrder } from "@/lib/training-order";

const supabase = createClient();

type Props = {
  petId: number;
  petName: string;
};

// Datos tal cual vienen de Supabase; los textos se calculan al pintar
// (así cambian bien de idioma).
type RawData = {
  groups: { id: number; name: string }[];
  items: { group_id: number; skill_id: number }[];
  petSkills: { skill_id: number; auto_progress: number | null }[];
  skills: { id: number; name: string; name_en: string | null }[];
  saved: {
    data: unknown;
    used_fallback: boolean | null;
    updated_at: string | null;
  } | null;
};

// Pestaña "Orden recomendado" de la página de habilidades.
// Carga los grupos, el progreso y el orden guardado del perro.
export default function TrainingOrderTab({ petId, petName }: Props) {
  const tPet = useTranslations("PetProfile");
  const tSkills = useTranslations("PetSkills");
  const locale = useLocale();

  const [raw, setRaw] = useState<RawData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: groupRows } = await supabase
        .from("skill_groups")
        .select("id, name")
        .eq("pet_id", petId)
        .order("created_at", { ascending: true });

      const groups = groupRows ?? [];

      const { data: itemRows } =
        groups.length > 0
          ? await supabase
              .from("skill_group_items")
              .select("group_id, skill_id")
              .in(
                "group_id",
                groups.map((group) => group.id)
              )
          : { data: [] };

      const items = itemRows ?? [];

      const { data: petSkillRows } = await supabase
        .from("pet_skills")
        .select("skill_id, auto_progress")
        .eq("pet_id", petId);

      const petSkills = petSkillRows ?? [];

      const allSkillIds = Array.from(
        new Set([
          ...petSkills.map((row) => row.skill_id),
          ...items.map((item) => item.skill_id),
        ])
      );

      const { data: skillRows } =
        allSkillIds.length > 0
          ? await supabase
              .from("skills")
              .select("id, name, name_en")
              .in("id", allSkillIds)
          : { data: [] };

      const { data: savedRow } = await supabase
        .from("training_order_recommendations")
        .select("data, used_fallback, updated_at")
        .eq("pet_id", petId)
        .maybeSingle();

      if (cancelled) return;

      setRaw({
        groups,
        items,
        petSkills,
        skills: skillRows ?? [],
        saved: savedRow ?? null,
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [petId]);

  if (!raw) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow">
        <PawsiLoading text={tSkills("loading")} variant="card" />
      </div>
    );
  }

  const skillsMap = new Map(raw.skills.map((skill) => [skill.id, skill]));

  function localizedSkillName(skillId: number): string {
    const skill = skillsMap.get(skillId);
    if (!skill) return tPet("genericSkillName");
    return locale === "en" && skill.name_en ? skill.name_en : skill.name;
  }

  const progressBySkill = new Map(
    raw.petSkills.map((row) => [row.skill_id, row.auto_progress ?? 0])
  );

  const orderGroups: TrainingOrderGroupView[] = raw.groups.map((group) => ({
    groupId: group.id,
    name: group.name,
    skills: raw.items
      .filter((item) => item.group_id === group.id)
      .map((item) => ({
        skillId: item.skill_id,
        name: localizedSkillName(item.skill_id),
        progress: progressBySkill.get(item.skill_id) ?? 0,
      })),
  }));

  const savedOrder = raw.saved ? parseStoredOrder(raw.saved.data) : null;

  // Sugerencia básica (reglas simples) mientras no se haya calculado el orden
  let fallback: TrainingOrderFallback;

  if (raw.petSkills.length === 0) {
    fallback = {
      title: tPet("startAddingSkillsTitle"),
      body: tPet("startAddingSkillsBody"),
      cta: tPet("addSkillsCta"),
      href: `/pets/${petId}/skills`,
    };
  } else {
    const lowest = [...raw.petSkills].sort(
      (a, b) => (a.auto_progress ?? 0) - (b.auto_progress ?? 0)
    )[0];

    fallback = {
      title: tPet("reinforceTitle", { skill: localizedSkillName(lowest.skill_id) }),
      body: tPet("reinforceBody", { progress: lowest.auto_progress ?? 0 }),
      cta: tPet("viewSkillsCta"),
      href: `/pets/${petId}/skills?skill=${lowest.skill_id}`,
    };
  }

  return (
    <TrainingOrder
      petId={petId}
      petName={petName}
      groups={orderGroups}
      initialOrder={savedOrder}
      initialUpdatedAt={raw.saved?.updated_at ?? null}
      initialUsedFallback={raw.saved?.used_fallback ?? false}
      fallback={fallback}
    />
  );
}