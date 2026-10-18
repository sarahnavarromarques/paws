"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import AddPetForm from "@/components/AddPetForm";
import { getBreedLabel } from "@/lib/breeds";
import { loadPetPlans, type PetPlan } from "@/lib/pet-plans";
import type { Database } from "@/lib/supabase/database.types";

const supabase = createClient();

type PetRow = Database["public"]["Tables"]["pets"]["Row"];

type Pet = Pick<PetRow, "id" | "user_id" | "name" | "breed" | "age" | "birth_date" | "sex" | "weight" | "color" | "objective" | "level" | "last_training" | "photo">;

type TFunction = ReturnType<typeof useTranslations>;

// Acción principal del día (botón azul) o solo un texto informativo
type PlanAction =
  | { kind: "button"; label: string; href: string }
  | { kind: "text"; label: string };

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

// Quita el punto final para que el texto quede bien dentro de un botón
function asButtonLabel(text: string): string {
  return text.replace(/\.\s*$/, "");
}

export default function PetsPage() {
  const t = useTranslations("Pets");
  // Los textos de la recomendación del día ya existen en "Dashboard"
  const tPlan = useTranslations("Dashboard");
  const tPet = useTranslations("PetProfile");
  const locale = useLocale();
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [plans, setPlans] = useState<Map<number, PetPlan>>(() => new Map());
  const [loading, setLoading] = useState(true);

  async function loadPets() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPets([]);
      setPlans(new Map());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("pets")
      .select(
        "id, user_id, name, breed, age, birth_date, sex, weight, color, objective, level, last_training, photo"
      )
      .eq("user_id", user.id)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error cargando mascotas:", error);
      setPets([]);
      setPlans(new Map());
    } else if (data) {
      setPets(data);

      // Recomendación del día de cada perro (si falla, la lista se ve igual)
      try {
        const petPlans = await loadPetPlans(supabase, user.id, data, locale);
        setPlans(new Map(petPlans.map((plan) => [plan.petId, plan])));
      } catch (planError) {
        console.error("Error cargando recomendaciones:", planError);
        setPlans(new Map());
      }
    }

    setLoading(false);
  }

  // Tras crear una mascota, se abre su cuestionario inicial (se puede saltar).
  function handlePetAdded(petId: number) {
    router.push(`/pets/${petId}/questionnaire`);
  }

  // Decide qué se muestra como acción principal de cada perro
  function getPlanAction(petId: number, plan: PetPlan): PlanAction {
    if (plan.skillCount === 0) {
      return { kind: "text", label: tPlan("addSkills") };
    }

    if (plan.todayTrainingId) {
      return {
        kind: "button",
        label: asButtonLabel(
          tPlan("pendingTraining", { title: plan.todayTrainingTitle ?? "" })
        ),
        href: `/trainings/${plan.todayTrainingId}/edit`,
      };
    }

    if (plan.reinforceSkillName && plan.reinforceSkillId !== null) {
      return {
        kind: "button",
        label: `🎯 ${asButtonLabel(
          tPlan("reinforce", { skill: plan.reinforceSkillName })
        )}`,
        // Abre directamente la información de la habilidad a trabajar
        href: `/pets/${petId}/skills?skill=${plan.reinforceSkillId}`,
      };
    }

    return { kind: "text", label: tPlan("allDone") };
  }

  useEffect(() => {
    void loadPets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-5xl font-extrabold text-blue-700">
              {t("title")}
            </h1>

            <p className="mt-3 text-lg text-slate-600">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
        </div>

        {/* MASCOTAS */}

        <section className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold">
              {t("yourPets")}
            </h2>

            {!loading && pets.length > 0 && (
              <span className="rounded-full bg-blue-100 px-4 py-2 font-semibold text-blue-700">
                {t("petCount", { count: pets.length })}
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <p className="text-slate-500">
                {t("loading")}
              </p>
            </div>
          ) : pets.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <div className="text-6xl">
                🐶
              </div>

              <h3 className="mt-4 text-2xl font-bold">
                {t("noPetsTitle")}
              </h3>

              <p className="mt-2 text-slate-500">
                {t("noPetsSubtitle")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {pets.map((pet) => {
                const plan = plans.get(pet.id);
                const action = plan ? getPlanAction(pet.id, plan) : null;

                return (
                  <div
                    key={pet.id}
                    className="flex h-full flex-col rounded-2xl bg-white p-6 shadow transition duration-200 hover:shadow-xl"
                  >
                    {/* FOTO E INFORMACIÓN (lleva a la ficha) */}

                    <Link
                      href={`/pets/${pet.id}`}
                      className="group flex items-center gap-6"
                    >
                      {pet.photo ? (
                        <Image
                          src={pet.photo}
                          alt={pet.name}
                          width={120}
                          height={120}
                          className="h-28 w-28 shrink-0 rounded-full border-4 border-blue-500 object-cover transition group-hover:border-blue-600"
                        />
                      ) : (
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-slate-200 text-5xl">
                          🐶
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="truncate text-3xl font-bold group-hover:text-blue-700">
                            {pet.name}
                          </h3>

                          {plan && plan.skillCount > 0 && (
                            <span className="mt-1 shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-blue-600">
                              {plan.averageProgress}%
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xl text-slate-600">
                          {pet.breed ? getBreedLabel(pet.breed, locale) : t("noBreed")}
                        </p>

                        <p className="mt-1 text-lg text-slate-500">
                          {calculateAge(pet.birth_date, t)}
                        </p>

                        <p className="mt-4 font-semibold text-blue-600">
                          {t("viewProfile")}
                        </p>
                      </div>
                    </Link>

                    {/* RECOMENDACIÓN DEL DÍA Y ACCESOS */}

                    {action && (
                      <div className="mt-6 flex flex-1 flex-col gap-2 border-t border-slate-100 pt-5">
                        {action.kind === "button" ? (
                          <Link
                            href={action.href}
                            className="rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
                          >
                            {action.label}
                          </Link>
                        ) : (
                          <p className="mb-2 text-slate-600">{action.label}</p>
                        )}

                        <div className="mt-auto flex flex-col gap-2">
                          <Link
                            href={`/pets/${pet.id}/skills`}
                            className="rounded-xl border-2 border-blue-600 px-4 py-2.5 text-center font-semibold text-blue-600 transition hover:bg-blue-50"
                          >
                            {tPlan("viewSkills")}
                          </Link>

                          <Link
                            href={`/pets/${pet.id}/progress`}
                            className="rounded-xl border-2 border-blue-600 px-4 py-2.5 text-center font-semibold text-blue-600 transition hover:bg-blue-50"
                          >
                            {tPet("viewProgress")}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* AÑADIR MASCOTA */}

        <div className="rounded-2xl bg-white p-6 shadow md:p-8">
          {/* data-tour: el tutorial ilumina este título */}
          <h2 data-tour="add-pet" className="mb-6 text-3xl font-bold">
            {t("addPet")}
          </h2>

          <AddPetForm onAddPet={handlePetAdded} />
        </div>

      </div>
    </main>
  );
}