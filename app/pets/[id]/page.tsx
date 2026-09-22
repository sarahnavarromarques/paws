import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import AddTrainingForm from "@/components/AddTrainingForm";
import ProgressAnalysis from "@/components/ProgressAnalysis";
import { getBreedLabel, getColorLabel } from "@/lib/breeds";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    training?: string;
  }>;
};

type TFunction = Awaited<ReturnType<typeof getTranslations>>;

function calculateAge(birthDate: string | null, t: TFunction): string {
  if (!birthDate) {
    return t("noBirthDate");
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) {
    return t("invalidDate");
  }

  if (years === 0) {
    if (months === 0) {
      return t("lessThanMonth");
    }

    return t("ageMonths", { months });
  }

  if (months === 0) {
    return t("ageYears", { years });
  }

  return t("ageYearsMonths", { years, months });
}

function daysSince(dateStr: string | null): number | null {
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

function formatDaysSince(days: number | null, t: TFunction): string {
  if (days === null) {
    return t("daysSinceNever");
  }

  if (days === 0) {
    return t("daysSinceToday");
  }

  if (days === 1) {
    return t("daysSinceOneDay");
  }

  return t("daysSinceMultiple", { days });
}

export default async function PetProfile({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { training: selectedTraining } = await searchParams;

  const locale = await getLocale();
  const t = await getTranslations("PetProfile");
  const tPets = await getTranslations("Pets");
  const tAddPetForm = await getTranslations("AddPetForm");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("*")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .single();

  if (petError || !pet) {
    notFound();
  }

  const { data: trainings } = await supabase
    .from("trainings")
    .select("*")
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  const allTrainings = trainings ?? [];

  const completedTrainings = allTrainings.filter(
    (training) => training.status === "completed"
  );

  const totalMinutes = allTrainings.reduce(
    (total, training) => total + (training.duration ?? 0),
    0
  );

  const latestTraining =
    allTrainings.length > 0 ? allTrainings[0] : null;

  const selectedTrainingId = selectedTraining
    ? Number(selectedTraining)
    : null;

  const orderedTrainings = [...allTrainings].sort((a, b) => {
    if (a.id === selectedTrainingId) {
      return -1;
    }

    if (b.id === selectedTrainingId) {
      return 1;
    }

    return 0;
  });

  // --- Habilidades del perro ---

  const { data: petSkillRows } = await supabase
    .from("pet_skills")
    .select("skill_id, manual_progress, auto_progress, is_goal")
    .eq("pet_id", pet.id);

  const petSkillList = petSkillRows ?? [];

  // Resumen de entrenamientos por habilidad (solo completados)
  const trainingStatsBySkill = new Map<number, { count: number; lastDate: string | null }>();

  for (const training of completedTrainings) {
    if (training.skill_id === null || training.skill_id === undefined) {
      continue;
    }

    const current = trainingStatsBySkill.get(training.skill_id) ?? {
      count: 0,
      lastDate: null,
    };

    current.count += 1;

    // allTrainings viene ordenado por fecha desc, pero comparamos por seguridad
    if (
      training.date &&
      (current.lastDate === null || training.date > current.lastDate)
    ) {
      current.lastDate = training.date;
    }

    trainingStatsBySkill.set(training.skill_id, current);
  }

  let petSkillsWithNames: {
    skillId: number;
    name: string;
    category: string | null;
    progress: number;
    sessionCount: number;
    lastTrainedDays: number | null;
  }[] = [];

  if (petSkillList.length > 0) {
    const skillIds = petSkillList.map((row) => row.skill_id);

    const { data: skillsData } = await supabase
      .from("skills")
      .select("id, name, name_en, category, category_en")
      .in("id", skillIds);

    const skillsMap = new Map(
      (skillsData ?? []).map((skill) => [skill.id, skill])
    );

    petSkillsWithNames = petSkillList
      .map((row) => {
        const skill = skillsMap.get(row.skill_id);
        const stats = trainingStatsBySkill.get(row.skill_id);

        const name =
          locale === "en" && skill?.name_en
            ? skill.name_en
            : skill?.name ?? t("genericSkillName");

        const category =
          locale === "en" && skill?.category_en
            ? skill.category_en
            : skill?.category ?? null;

        return {
          skillId: row.skill_id,
          name,
          category,
          progress: row.auto_progress ?? 0,
          sessionCount: stats?.count ?? 0,
          lastTrainedDays: daysSince(stats?.lastDate ?? null),
        };
      })
      .sort((a, b) => b.progress - a.progress);
  }

  const averageSkillProgress =
    petSkillsWithNames.length === 0
      ? 0
      : Math.round(
          petSkillsWithNames.reduce(
            (sum, item) => sum + item.progress,
            0
          ) / petSkillsWithNames.length
        );

  // --- Plan recomendado (reglas simples) ---

  let recommendation: {
    title: string;
    body: string;
    cta: string;
  };

  if (petSkillsWithNames.length === 0) {
    recommendation = {
      title: t("startAddingSkillsTitle"),
      body: t("startAddingSkillsBody"),
      cta: t("addSkillsCta"),
    };
  } else {
    const lowest = [...petSkillsWithNames].sort(
      (a, b) => a.progress - b.progress
    )[0];

    recommendation = {
      title: t("reinforceTitle", { skill: lowest.name }),
      body: t("reinforceBody", { progress: lowest.progress }),
      cta: t("viewSkillsCta"),
    };
  }

  function formatLatestTraining() {
    if (!latestTraining) {
      return t("noData");
    }

    const date = latestTraining.date ?? "";

    const time = latestTraining.time
      ? latestTraining.time.substring(0, 5)
      : "";

    if (date && time) {
      return `${date} — ${time}`;
    }

    return date || time || t("noData");
  }

  const sexLabel =
    pet.sex === "Macho"
      ? tAddPetForm("male")
      : pet.sex === "Hembra"
      ? tAddPetForm("female")
      : null;

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-6xl">

        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            href="/pets"
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("backToPets")}
          </Link>

          <Link
            href={`/pets/${pet.id}/edit`}
            className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
          >
            {t("editPet")}
          </Link>

          <Link
            href={`/pets/${pet.id}/skills`}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            {t("skills")}
          </Link>

          <Link
            href={`/pets/${pet.id}/groups`}
            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            {t("skillGroups")}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">

          <div className="bg-blue-600 p-10 text-white">
            <div className="flex items-center gap-6">

              {pet.photo ? (
                <img
                  src={pet.photo}
                  alt={pet.name}
                  className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-6xl">
                  🐶
                </div>
              )}

              <div>
                <h1 className="text-5xl font-bold">
                  {pet.name}
                </h1>

                <p className="text-2xl text-blue-100">
                  {pet.breed ? getBreedLabel(pet.breed, locale) : tPets("noBreed")}
                </p>
              </div>

            </div>
          </div>

          <div className="grid gap-8 p-10 md:grid-cols-2">

            <div className="rounded-2xl bg-slate-100 p-8">

              <h2 className="mb-6 text-3xl font-bold">
                {t("infoTitle")}
              </h2>

              <div className="space-y-4">

                <p>
                  {calculateAge(pet.birth_date, tPets)}
                </p>

                <p>
                  <strong>{t("birthDateLabel")}</strong>{" "}
                  {pet.birth_date ?? t("noData")}
                </p>

                <p>
                  <strong>{t("sexLabel")}</strong>{" "}
                  {sexLabel ?? t("noData")}
                </p>

                <p>
                  <strong>{t("weightLabel")}</strong>{" "}
                  {pet.weight ?? t("noData")}
                </p>

                <p>
                  <strong>{t("colorLabel")}</strong>{" "}
                  {pet.color ? getColorLabel(pet.color, locale) : t("noData")}
                </p>

              </div>
            </div>

            <div className="rounded-2xl bg-slate-100 p-8">

              <h2 className="mb-6 text-3xl font-bold">
                {t("statusTitle")}
              </h2>

              <div className="space-y-5">

                <p>
                  {t("lastTraining")}{" "}
                  <strong>
                    {formatLatestTraining()}
                  </strong>
                </p>

                <p>
                  {t("levelLabel")}{" "}
                  <strong>
                    {pet.level ?? t("beginnerLevel")}
                  </strong>
                </p>

                <p>
                  {t("completedTrainingsLabel")}{" "}
                  <strong>
                    {completedTrainings.length}
                  </strong>
                </p>

                <p>
                  {t("totalTimeLabel")}{" "}
                  <strong>
                    {t("minutesSuffix", { minutes: totalMinutes })}
                  </strong>
                </p>

              </div>
            </div>

          </div>

          <div className="px-10">

            {/* PLAN RECOMENDADO */}

            <div className="mb-8 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-8 shadow">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
                    {t("recommendedPlan")}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-indigo-900">
                    {recommendation.title}
                  </p>
                  <p className="mt-2 text-indigo-800">
                    {recommendation.body}
                  </p>
                </div>

                <Link
                  href={`/pets/${pet.id}/skills`}
                  className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
                >
                  {recommendation.cta}
                </Link>
              </div>
            </div>

            {/* ANÁLISIS DE PROGRESO (IA) */}

            <ProgressAnalysis
              pet={{
                name: pet.name,
                breed: pet.breed ?? null,
                objective: pet.objective ?? null,
                level: pet.level ?? null,
              }}
              skills={petSkillsWithNames.map((item) => ({
                name: item.name,
                category: item.category,
                progress: item.progress,
                sessionCount: item.sessionCount,
                lastTrainedDays: item.lastTrainedDays,
                isGoal: false,
              }))}
              trainings={completedTrainings.slice(0, 15).map((training) => ({
                title: training.title ?? null,
                date: training.date ?? null,
                duration: training.duration ?? null,
                notes: training.notes ?? null,
              }))}
            />

            {/* HABILIDADES DEL PERRO */}

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">
                  {t("dogSkillsTitle")}
                </h2>

                <div className="flex items-center gap-4">
                  {petSkillsWithNames.length > 0 && (
                    <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {averageSkillProgress}%
                      </span>
                      <span className="ml-2 text-sm font-semibold text-slate-500">
                        {t("average")}
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/pets/${pet.id}/skills`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    {t("manage")}
                  </Link>
                </div>
              </div>

              {petSkillsWithNames.length > 0 ? (

                <div className="space-y-5">

                  {petSkillsWithNames.map((item) => (
                    <div key={item.skillId}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold">
                          {item.category
                            ? `${item.category} — `
                            : ""}
                          {item.name}
                        </span>
                        <span className="font-bold text-blue-600">
                          {item.progress}%
                        </span>
                      </div>

                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {item.sessionCount === 0
                          ? t("noSessionsRecorded")
                          : `${t("sessionCount", { count: item.sessionCount })} · ${formatDaysSince(item.lastTrainedDays, t)}`}
                      </p>
                    </div>
                  ))}

                </div>

              ) : (

                <p className="text-slate-500">
                  {t("noSkillsYet")}{" "}
                  <Link
                    href={`/pets/${pet.id}/skills`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {t("addSkillsCta")}
                  </Link>
                </p>

              )}

            </div>

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <h2 className="mb-6 text-3xl font-bold">
                {t("newTrainingTitle")}
              </h2>

              <AddTrainingForm petId={pet.id} />

            </div>

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <h2 className="mb-6 text-3xl font-bold">
                {t("trainingHistoryTitle")}
              </h2>

              {orderedTrainings.length > 0 ? (

                <div className="space-y-4">

                  {orderedTrainings.map((training) => {

                    const isSelected =
                      training.id === selectedTrainingId;

                    return (
                      <div
                        key={training.id}
                        id={`training-${training.id}`}
                        className={`rounded-xl border p-5 transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-300"
                            : "border-slate-300 bg-white"
                        }`}
                      >

                        {isSelected && (
                          <div className="mb-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">
                            {t("selectedTrainingBanner")}
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-6">

                          <div>

                            <h3 className="text-xl font-bold">
                              {training.title ??
                                t("trainingDefaultTitle")}
                            </h3>

                            <p>
                              📅{" "}
                              {training.date ??
                                t("noDate")}
                            </p>

                            <p>
                              🕒{" "}
                              {training.time
                                ? training.time.substring(
                                    0,
                                    5
                                  )
                                : "--:--"}
                            </p>

                            <p>
                              ⏱{" "}
                              {training.duration ??
                                "-"}{" "}
                              min
                            </p>

                            <p>
                              {t("statusLabel")}{" "}
                              <span
                                className={
                                  training.status ===
                                  "completed"
                                    ? "font-bold text-green-600"
                                    : "font-bold text-orange-600"
                                }
                              >
                                {training.status ===
                                "completed"
                                  ? t("completedStatus")
                                  : t("pendingStatus")}
                              </span>
                            </p>

                            {training.notes && (
                              <p className="mt-2 text-slate-600">
                                {training.notes}
                              </p>
                            )}

                          </div>

                          <Link
                            href={`/trainings/${training.id}/edit`}
                            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600"
                          >
                            {t("editLink")}
                          </Link>

                        </div>

                      </div>
                    );
                  })}

                </div>

              ) : (

                <p className="text-slate-500">
                  {t("noTrainingsRecorded")}
                </p>

              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}