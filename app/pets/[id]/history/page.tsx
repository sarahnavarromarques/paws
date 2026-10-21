import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import PetHistoryList from "@/components/PetHistoryList";
import { parseHistoryQuery } from "@/lib/history-filters";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    filter?: string;
    skill?: string;
    from?: string;
    to?: string;
  }>;
};

// Historial de entrenamientos de un perro.
// Se cargan todos una vez; los filtros se aplican en el navegador
// (PetHistoryList), así no se recarga la página al cambiarlos.
export default async function PetHistoryPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const initialQuery = parseHistoryQuery(await searchParams);

  const locale = await getLocale();
  const t = await getTranslations("PetHistory");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, name")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .single();

  if (petError || !pet) {
    notFound();
  }

  // Todos los entrenamientos del perro, del más reciente al más antiguo
  const { data: trainingsData } = await supabase
    .from("trainings")
    .select("id, title, date, time, duration, notes, status, skill_id")
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  const allTrainings = trainingsData ?? [];

  // --- Nombres de las habilidades entrenadas (para el filtro y las tarjetas) ---

  const trainedSkillIds = Array.from(
    new Set(
      allTrainings
        .map((training) => training.skill_id)
        .filter((skillId): skillId is number => typeof skillId === "number")
    )
  );

  const { data: skillsData } =
    trainedSkillIds.length > 0
      ? await supabase
          .from("skills")
          .select("id, name, name_en")
          .in("id", trainedSkillIds)
      : { data: [] };

  const skillOptions = (skillsData ?? [])
    .map((skill) => ({
      id: skill.id,
      name: locale === "en" && skill.name_en ? skill.name_en : skill.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <main data-tour-section="history" className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">

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

        {/* FILTROS Y LISTA (se filtra al momento, sin recargar) */}

        <div data-tour="history-filters">
        <PetHistoryList
          petId={pet.id}
          trainings={allTrainings.map((training) => ({
            id: training.id,
            title: training.title ?? null,
            date: training.date ?? null,
            time: training.time ?? null,
            duration: training.duration ?? null,
            notes: training.notes ?? null,
            status: training.status ?? null,
            skill_id: typeof training.skill_id === "number" ? training.skill_id : null,
          }))}
          skillOptions={skillOptions}
          initialQuery={initialQuery}
        />
        </div>

      </div>
    </main>
  );
}