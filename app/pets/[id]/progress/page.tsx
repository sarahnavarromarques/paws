import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import ProgressAnalysis from "@/components/ProgressAnalysis";
import SkillProgressList from "@/components/SkillProgressList";
import {
  averageSkillProgress,
  buildSkillProgressItems,
} from "@/lib/pet-skill-progress";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

// Número máximo de sesiones recientes que se envían a la IA
const MAX_TRAININGS_FOR_AI = 15;

export default async function PetProgressPage({ params }: PageProps) {
  const { id } = await params;

  const locale = await getLocale();
  const t = await getTranslations("PetProgress");
  const tProfile = await getTranslations("PetProfile");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, name, breed, objective, level")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .single();

  if (petError || !pet) {
    notFound();
  }

  // --- Entrenamientos completados (de más reciente a más antiguo) ---

  const { data: trainingsData } = await supabase
    .from("trainings")
    .select("skill_id, title, date, duration, notes")
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  const completedTrainings = trainingsData ?? [];

  // --- Habilidades del perro y sus nombres ---

  const { data: petSkillRows } = await supabase
    .from("pet_skills")
    .select("skill_id, auto_progress")
    .eq("pet_id", pet.id);

  const petSkillList = petSkillRows ?? [];

  const skillIds = petSkillList.map((row) => row.skill_id);

  const { data: skillsData } =
    skillIds.length > 0
      ? await supabase
          .from("skills")
          .select("id, name, name_en, category, category_en")
          .in("id", skillIds)
      : { data: [] };

  const skillsMap = new Map(
    (skillsData ?? []).map((skill) => [skill.id, skill])
  );

  function localizedSkillName(skillId: number): string {
    const skill = skillsMap.get(skillId);

    if (!skill) {
      return tProfile("genericSkillName");
    }

    return locale === "en" && skill.name_en ? skill.name_en : skill.name;
  }

  function localizedSkillCategory(skillId: number): string | null {
    const skill = skillsMap.get(skillId);

    if (!skill) {
      return null;
    }

    return locale === "en" && skill.category_en
      ? skill.category_en
      : skill.category ?? null;
  }

  const skillItems = buildSkillProgressItems(
    petSkillList,
    completedTrainings,
    localizedSkillName,
    localizedSkillCategory
  );

  const average = averageSkillProgress(skillItems);

  return (
    <main data-tour-section="progress" className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}

        <div className="mb-8">
          <Link
            href={`/pets/${pet.id}`}
            className="inline-block rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("backToPet")}
          </Link>

          <h1 className="mt-6 text-4xl font-extrabold text-blue-700 md:text-5xl">
            {t("title", { name: pet.name })}
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            {t("subtitle")}
          </p>
        </div>

        {/* ANÁLISIS DE PROGRESO (IA) — se hace solo al abrir */}

        <div data-tour="progress-analysis">
        <ProgressAnalysis
          autoAnalyze
          pet={{
            name: pet.name,
            breed: pet.breed ?? null,
            objective: pet.objective ?? null,
            level: pet.level ?? null,
          }}
          skills={skillItems.map((item) => ({
            name: item.name,
            category: item.category,
            progress: item.progress,
            sessionCount: item.sessionCount,
            lastTrainedDays: item.lastTrainedDays,
            isGoal: false,
          }))}
          trainings={completedTrainings
            .slice(0, MAX_TRAININGS_FOR_AI)
            .map((training) => ({
              title: training.title ?? null,
              date: training.date ?? null,
              duration: training.duration ?? null,
              notes: training.notes ?? null,
            }))}
        />
        </div>

        {/* PROGRESO DE CADA HABILIDAD */}

        <div data-tour="progress-bars">
        <SkillProgressList
          petId={pet.id}
          items={skillItems}
          average={average}
        />
        </div>

      </div>
    </main>
  );
}