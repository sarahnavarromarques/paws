import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import HistoryFilters from "@/components/HistoryFilters";
import {
  buildHistoryHref,
  parseHistoryQuery,
  type HistoryStatus,
} from "@/lib/history-filters";

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

const STATUSES: HistoryStatus[] = ["all", "completed", "pending"];

export default async function PetHistoryPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = parseHistoryQuery(await searchParams);

  const locale = await getLocale();
  const t = await getTranslations("PetHistory");
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

  const skillNames = new Map(
    (skillsData ?? []).map((skill) => [
      skill.id,
      locale === "en" && skill.name_en ? skill.name_en : skill.name,
    ])
  );

  const skillOptions = Array.from(skillNames, ([skillId, name]) => ({
    id: skillId,
    name,
  })).sort((a, b) => a.name.localeCompare(b.name, locale));

  // --- Aplicar los filtros ---

  const selectedSkillId = query.skill ? Number(query.skill) : null;

  const trainings = allTrainings.filter((training) => {
    if (query.status === "completed" && training.status !== "completed") {
      return false;
    }
    if (query.status === "pending" && training.status === "completed") {
      return false;
    }
    if (selectedSkillId !== null && training.skill_id !== selectedSkillId) {
      return false;
    }
    if (query.from && (!training.date || training.date < query.from)) {
      return false;
    }
    if (query.to && (!training.date || training.date > query.to)) {
      return false;
    }
    return true;
  });

  const hasExtraFilters =
    query.skill !== "" || query.from !== "" || query.to !== "";

  const statusLabel: Record<HistoryStatus, string> = {
    all: t("filterAll"),
    completed: t("filterCompleted"),
    pending: t("filterPending"),
  };

  const emptyText = hasExtraFilters
    ? t("emptyFiltered")
    : query.status === "completed"
    ? t("emptyCompleted")
    : query.status === "pending"
    ? t("emptyPending")
    : t("emptyAll");

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
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

        {/* ESTADO: TODOS / COMPLETADOS / PENDIENTES */}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => {
              const isActive = status === query.status;

              return (
                <Link
                  key={status}
                  href={buildHistoryHref(pet.id, { ...query, status })}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                      : "rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  }
                >
                  {statusLabel[status]}
                </Link>
              );
            })}
          </div>

          <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            {t("count", { count: trainings.length })}
          </span>
        </div>

        {/* HABILIDAD Y FECHAS */}

        <HistoryFilters
          petId={pet.id}
          query={query}
          skillOptions={skillOptions}
        />

        {/* LISTA DE ENTRENAMIENTOS */}

        {trainings.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <div className="text-5xl">🗂️</div>
            <p className="mt-4 text-slate-500">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trainings.map((training) => {
              const isCompleted = training.status === "completed";
              const skillName =
                typeof training.skill_id === "number"
                  ? skillNames.get(training.skill_id) ?? null
                  : null;

              return (
                <div
                  key={training.id}
                  className="rounded-2xl bg-white p-5 shadow"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold">
                        {training.title ?? tProfile("trainingDefaultTitle")}
                      </h2>

                      {skillName && (
                        <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                          🎯 {skillName}
                        </span>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-600">
                        <span>📅 {training.date ?? tProfile("noDate")}</span>
                        <span>
                          🕒{" "}
                          {training.time
                            ? training.time.substring(0, 5)
                            : "--:--"}
                        </span>
                        <span>⏱ {training.duration ?? "-"} min</span>
                      </div>

                      <p className="mt-2">
                        {tProfile("statusLabel")}{" "}
                        <span
                          className={
                            isCompleted
                              ? "font-bold text-green-600"
                              : "font-bold text-orange-600"
                          }
                        >
                          {isCompleted
                            ? tProfile("completedStatus")
                            : tProfile("pendingStatus")}
                        </span>
                      </p>

                      {training.notes && (
                        <p className="mt-2 text-slate-600">{training.notes}</p>
                      )}
                    </div>

                    <Link
                      href={`/trainings/${training.id}/edit`}
                      className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600"
                    >
                      {tProfile("editLink")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}