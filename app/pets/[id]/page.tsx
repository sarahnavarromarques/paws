import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import AddTrainingForm from "@/components/AddTrainingForm";
import { getBreedLabel, getColorLabel } from "@/lib/breeds";
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
  const tHealth = await getTranslations("Health");

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
    <main data-tour-section="pet-profile" className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-6xl">

        <div data-tour="pet-buttons" className="mb-6 flex flex-wrap gap-4">
          <Link
            href="/pets"
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("backToPets")}
          </Link>

          {/* Habilidades, grupos y orden recomendado están en la misma página (pestañas) */}
          <Link
            href={`/skills?pet=${pet.id}`}
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

          {/* Salud: vacunas y desparasitaciones (rosa claro, texto oscuro para que se lea) */}
          <Link
            href={`/pets/${pet.id}/vaccines`}
            className="rounded-xl bg-rose-200 px-5 py-3 font-semibold text-rose-800 transition hover:bg-rose-300"
          >
            {tHealth("navLabel")}
          </Link>

          <Link
            href={`/pets/${pet.id}/questionnaire`}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            {questionnaireText(qLocale, "profileButton")}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">

          <div data-tour="pet-header" className="relative bg-blue-600 p-10 text-white">

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

            {/* NUEVO ENTRENAMIENTO (el historial y el orden recomendado tienen su propia pantalla) */}

            <div data-tour="add-training" className="mb-8 rounded-2xl border bg-white p-8 shadow">

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