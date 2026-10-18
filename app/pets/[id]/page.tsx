import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import AddTrainingForm from "@/components/AddTrainingForm";
import TrainingOrder, {
  type TrainingOrderFallback,
  type TrainingOrderGroupView,
} from "@/components/TrainingOrder";
import { getBreedLabel, getColorLabel } from "@/lib/breeds";
import { parseStoredOrder } from "@/lib/training-order";
import { buildSkillProgressItems } from "@/lib/pet-skill-progress";
import {
  questionnaireText,
  toQuestionnaireLocale,
} from "@/lib/pet-questionnaire";

type PageProps = {
  params: Promise<{
    id: string;
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

export default async function PetProfile({ params }: PageProps) {
  const { id } = await params;

  const locale = await getLocale();
  const qLocale = toQuestionnaireLocale(locale);
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

  // --- Habilidades del perro ---

  const { data: petSkillRows } = await supabase
    .from("pet_skills")
    .select("skill_id, manual_progress, auto_progress, is_goal")
    .eq("pet_id", pet.id);

  const petSkillList = petSkillRows ?? [];

  // --- Grupos de habilidades del perro (para el orden recomendado) ---

  const { data: groupRows } = await supabase
    .from("skill_groups")
    .select("id, name")
    .eq("pet_id", pet.id)
    .order("created_at", { ascending: true });

  const groupList = groupRows ?? [];

  const { data: groupItemRows } =
    groupList.length > 0
      ? await supabase
          .from("skill_group_items")
          .select("group_id, skill_id")
          .in(
            "group_id",
            groupList.map((group) => group.id)
          )
      : { data: [] };

  const groupItems = groupItemRows ?? [];

  // Una sola consulta de nombres para las habilidades del perro y las de sus grupos
  const allSkillIds = Array.from(
    new Set([
      ...petSkillList.map((row) => row.skill_id),
      ...groupItems.map((item) => item.skill_id),
    ])
  );

  const { data: skillsData } =
    allSkillIds.length > 0
      ? await supabase
          .from("skills")
          .select("id, name, name_en, category, category_en")
          .in("id", allSkillIds)
      : { data: [] };

  const skillsMap = new Map(
    (skillsData ?? []).map((skill) => [skill.id, skill])
  );

  function localizedSkillName(skillId: number): string {
    const skill = skillsMap.get(skillId);

    if (!skill) {
      return t("genericSkillName");
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

  // Progreso de cada habilidad (se usa para la sugerencia básica del orden;
  // las barras de cada habilidad están en la pantalla de progreso)
  const petSkillsWithNames = buildSkillProgressItems(
    petSkillList,
    completedTrainings,
    localizedSkillName,
    localizedSkillCategory
  );

  // --- Datos para la tarjeta "Orden recomendado" ---

  const progressBySkill = new Map(
    petSkillList.map((row) => [row.skill_id, row.auto_progress ?? 0])
  );

  const orderGroups: TrainingOrderGroupView[] = groupList.map((group) => ({
    groupId: group.id,
    name: group.name,
    skills: groupItems
      .filter((item) => item.group_id === group.id)
      .map((item) => ({
        skillId: item.skill_id,
        name: localizedSkillName(item.skill_id),
        progress: progressBySkill.get(item.skill_id) ?? 0,
      })),
  }));

  const { data: savedOrderRow } = await supabase
    .from("training_order_recommendations")
    .select("data, used_fallback, updated_at")
    .eq("pet_id", pet.id)
    .maybeSingle();

  const savedOrder = savedOrderRow
    ? parseStoredOrder(savedOrderRow.data)
    : null;

  // Sugerencia básica (reglas simples) mientras no se haya calculado el orden
  let recommendation: TrainingOrderFallback;

  if (petSkillsWithNames.length === 0) {
    recommendation = {
      title: t("startAddingSkillsTitle"),
      body: t("startAddingSkillsBody"),
      cta: t("addSkillsCta"),
      href: `/pets/${pet.id}/skills`,
    };
  } else {
    const lowest = [...petSkillsWithNames].sort(
      (a, b) => a.progress - b.progress
    )[0];

    recommendation = {
      title: t("reinforceTitle", { skill: lowest.name }),
      body: t("reinforceBody", { progress: lowest.progress }),
      cta: t("viewSkillsCta"),
      // Abre directamente la información de esa habilidad
      href: `/pets/${pet.id}/skills?skill=${lowest.skillId}`,
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

  // Texto del lápiz sin el emoji (para el lector de pantalla y el aviso al pasar el ratón)
  const editLabel = t("editPet").replace(/^\S+\s/, "");

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

          {/* Habilidades y grupos están en la misma página (pestañas) */}
          <Link
            href={`/pets/${pet.id}/skills`}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            {t("skills")}
          </Link>

          {/* data-tour: el tutorial ilumina este botón (antes, la tarjeta de análisis) */}
          <Link
            href={`/pets/${pet.id}/progress`}
            data-tour="analyze-progress"
            className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-700"
          >
            {t("viewProgress")}
          </Link>

          <Link
            href={`/pets/${pet.id}/history`}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            {t("history")}
          </Link>

          <Link
            href={`/pets/${pet.id}/questionnaire`}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            {questionnaireText(qLocale, "profileButton")}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">

          <div className="relative bg-blue-600 p-10 text-white">

            {/* Lápiz para editar la mascota (esquina de la ficha) */}
            <Link
              href={`/pets/${pet.id}/edit`}
              aria-label={editLabel}
              title={editLabel}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </Link>

            <div className="flex items-center gap-6 pr-12">

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
                  {questionnaireText(qLocale, "objectiveLabel")}:{" "}
                  <strong>
                    {pet.objective ?? t("noData")}
                  </strong>
                </p>

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

            {/* ORDEN RECOMENDADO (IA) */}

            <TrainingOrder
              petId={pet.id}
              petName={pet.name}
              groups={orderGroups}
              initialOrder={savedOrder}
              initialUpdatedAt={savedOrderRow?.updated_at ?? null}
              initialUsedFallback={savedOrderRow?.used_fallback ?? false}
              fallback={recommendation}
            />

            {/* NUEVO ENTRENAMIENTO (el historial está en su propia pantalla) */}

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <h2 className="mb-6 text-3xl font-bold">
                {t("newTrainingTitle")}
              </h2>

              <AddTrainingForm petId={pet.id} />

            </div>

          </div>
        </div>
      </div>
    </main>
  );
}