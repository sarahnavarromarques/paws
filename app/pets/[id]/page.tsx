import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import AddTrainingForm from "@/components/AddTrainingForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    training?: string;
  }>;
};

function calculateAge(birthDate: string | null) {
  if (!birthDate) {
    return "Sin fecha de nacimiento";
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
    return "Fecha no válida";
  }

  if (years === 0) {
    if (months === 0) {
      return "Menos de 1 mes";
    }

    return `${months} ${months === 1 ? "mes" : "meses"}`;
  }

  if (months === 0) {
    return `${years} ${years === 1 ? "año" : "años"}`;
  }

  return `${years} ${years === 1 ? "año" : "años"} y ${months} ${
    months === 1 ? "mes" : "meses"
  }`;
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

function formatDaysSince(days: number | null): string {
  if (days === null) {
    return "Sin entrenar todavía";
  }

  if (days === 0) {
    return "Entrenado hoy";
  }

  if (days === 1) {
    return "Hace 1 día";
  }

  return `Hace ${days} días`;
}

export default async function PetProfile({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { training: selectedTraining } = await searchParams;

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

  const pendingTrainings = allTrainings.filter(
    (training) => training.status !== "completed"
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
    isGoal: boolean;
    sessionCount: number;
    lastTrainedDays: number | null;
  }[] = [];

  if (petSkillList.length > 0) {
    const skillIds = petSkillList.map((row) => row.skill_id);

    const { data: skillsData } = await supabase
      .from("skills")
      .select("id, name, category")
      .in("id", skillIds);

    const skillsMap = new Map(
      (skillsData ?? []).map((skill) => [skill.id, skill])
    );

    petSkillsWithNames = petSkillList
      .map((row) => {
        const skill = skillsMap.get(row.skill_id);
        const stats = trainingStatsBySkill.get(row.skill_id);

        return {
          skillId: row.skill_id,
          name: skill?.name ?? "Habilidad",
          category: skill?.category ?? null,
          progress: row.manual_progress ?? 0,
          isGoal: row.is_goal ?? false,
          sessionCount: stats?.count ?? 0,
          lastTrainedDays: daysSince(stats?.lastDate ?? null),
        };
      })
      .sort((a, b) => b.progress - a.progress);
  }

  const goalSkill =
    petSkillsWithNames.find((item) => item.isGoal) ?? null;

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
      title: "Empieza añadiendo habilidades",
      body: "Este perro todavía no tiene habilidades. Añade alguna para empezar a planificar su entrenamiento.",
      cta: "Añadir habilidades",
    };
  } else if (goalSkill) {
    if (goalSkill.progress >= 100) {
      recommendation = {
        title: `¡Objetivo conseguido! ${goalSkill.name} al 100%`,
        body: "Has completado el objetivo actual. Marca una nueva habilidad como objetivo para seguir avanzando.",
        cta: "Elegir nuevo objetivo",
      };
    } else if (
      goalSkill.lastTrainedDays === null ||
      goalSkill.lastTrainedDays >= 3
    ) {
      const tiempo =
        goalSkill.lastTrainedDays === null
          ? "aún no lo has entrenado"
          : `hace ${goalSkill.lastTrainedDays} días que no lo entrenas`;

      recommendation = {
        title: `Retoma "${goalSkill.name}"`,
        body: `Es el objetivo actual (${goalSkill.progress}%) y ${tiempo}. Dedícale la próxima sesión para no perder ritmo.`,
        cta: "Ver habilidad",
      };
    } else {
      recommendation = {
        title: `Sigue con "${goalSkill.name}"`,
        body: `Es el objetivo actual y está al ${goalSkill.progress}%. Vas con buen ritmo: mantén las sesiones para acercarte a completarlo.`,
        cta: "Ver habilidad",
      };
    }
  } else {
    const lowest = [...petSkillsWithNames].sort(
      (a, b) => a.progress - b.progress
    )[0];

    recommendation = {
      title: `Refuerza "${lowest.name}"`,
      body: `Es la habilidad con menos progreso (${lowest.progress}%). Trabajarla equilibra el aprendizaje. Consejo: marca una habilidad como objetivo para enfocar el plan.`,
      cta: "Marcar un objetivo",
    };
  }

  function formatLatestTraining() {
    if (!latestTraining) {
      return "Sin datos";
    }

    const date = latestTraining.date ?? "";

    const time = latestTraining.time
      ? latestTraining.time.substring(0, 5)
      : "";

    if (date && time) {
      return `${date} — ${time}`;
    }

    return date || time || "Sin datos";
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-6xl">

        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            href="/pets"
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Mis mascotas
          </Link>

          <Link
            href={`/pets/${pet.id}/edit`}
            className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600"
          >
            ✏️ Editar mascota
          </Link>

          <Link
            href={`/pets/${pet.id}/skills`}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            🎯 Habilidades
          </Link>

          <Link
            href={`/pets/${pet.id}/groups`}
            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            📂 Grupos de habilidades
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
                  {pet.breed ?? "Sin raza"}
                </p>
              </div>

            </div>
          </div>

          <div className="grid gap-8 p-10 md:grid-cols-2">

            <div className="rounded-2xl bg-slate-100 p-8">

              <div className="mb-8 grid grid-cols-4 gap-4">

                <div className="rounded-xl bg-blue-50 p-5 text-center">
                  <p className="text-3xl font-bold">
                    {allTrainings.length}
                  </p>
                  <p>Total</p>
                </div>

                <div className="rounded-xl bg-green-50 p-5 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {completedTrainings.length}
                  </p>
                  <p>Completados</p>
                </div>

                <div className="rounded-xl bg-orange-50 p-5 text-center">
                  <p className="text-3xl font-bold text-orange-600">
                    {pendingTrainings.length}
                  </p>
                  <p>Pendientes</p>
                </div>

                <div className="rounded-xl bg-purple-50 p-5 text-center">
                  <p className="text-3xl font-bold">
                    {totalMinutes}
                  </p>
                  <p>Minutos</p>
                </div>

              </div>

              <h2 className="mb-6 text-3xl font-bold">
                Información
              </h2>

              <div className="space-y-4">

                <p>
                  {calculateAge(pet.birth_date)}
                </p>

                <p>
                  <strong>Fecha de nacimiento:</strong>{" "}
                  {pet.birth_date ?? "Sin datos"}
                </p>

                <p>
                  <strong>Sexo:</strong>{" "}
                  {pet.sex ?? "Sin datos"}
                </p>

                <p>
                  <strong>Peso:</strong>{" "}
                  {pet.weight ?? "Sin datos"}
                </p>

                <p>
                  <strong>Color:</strong>{" "}
                  {pet.color ?? "Sin datos"}
                </p>

                <p>
                  <strong>Objetivo:</strong>{" "}
                  {pet.objective ?? "Sin datos"}
                </p>

              </div>
            </div>

            <div className="rounded-2xl bg-slate-100 p-8">

              <h2 className="mb-6 text-3xl font-bold">
                Estado
              </h2>

              <div className="space-y-5">

                <p>
                  📅 Último entrenamiento:{" "}
                  <strong>
                    {formatLatestTraining()}
                  </strong>
                </p>

                <p>
                  ⭐ Nivel:{" "}
                  <strong>
                    {pet.level ?? "Principiante"}
                  </strong>
                </p>

                <p>
                  📊 Entrenamientos completados:{" "}
                  <strong>
                    {completedTrainings.length}
                  </strong>
                </p>

                <p>
                  ⏱️ Tiempo total entrenado:{" "}
                  <strong>
                    {totalMinutes} min
                  </strong>
                </p>

              </div>
            </div>

          </div>

          <div className="px-10">

            {/* OBJETIVO ACTUAL */}

            {goalSkill && (
              <div className="mb-8 rounded-2xl border-2 border-amber-400 bg-amber-50 p-8 shadow">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
                      🎯 Objetivo actual
                    </p>
                    <p className="mt-1 text-3xl font-bold text-amber-900">
                      {goalSkill.category
                        ? `${goalSkill.category} — `
                        : ""}
                      {goalSkill.name}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-4xl font-bold text-amber-600">
                      {goalSkill.progress}%
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                      progreso
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${goalSkill.progress}%` }}
                  />
                </div>

                <p className="mt-4 text-sm font-semibold text-amber-800">
                  {goalSkill.sessionCount === 0
                    ? "Aún no has registrado sesiones de esta habilidad."
                    : `${goalSkill.sessionCount} ${
                        goalSkill.sessionCount === 1
                          ? "sesión completada"
                          : "sesiones completadas"
                      } · ${formatDaysSince(goalSkill.lastTrainedDays)}`}
                </p>
              </div>
            )}

            {/* PLAN RECOMENDADO */}

            <div className="mb-8 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-8 shadow">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
                    🧭 Plan recomendado
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

            {/* HABILIDADES DEL PERRO */}

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">
                  Habilidades del perro
                </h2>

                <div className="flex items-center gap-4">
                  {petSkillsWithNames.length > 0 && (
                    <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {averageSkillProgress}%
                      </span>
                      <span className="ml-2 text-sm font-semibold text-slate-500">
                        media
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/pets/${pet.id}/skills`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Gestionar
                  </Link>
                </div>
              </div>

              {petSkillsWithNames.length > 0 ? (

                <div className="space-y-5">

                  {petSkillsWithNames.map((item) => (
                    <div key={item.skillId}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold">
                          {item.isGoal && "🎯 "}
                          {item.category
                            ? `${item.category} — `
                            : ""}
                          {item.name}
                        </span>
                        <span
                          className={`font-bold ${
                            item.isGoal
                              ? "text-amber-600"
                              : "text-blue-600"
                          }`}
                        >
                          {item.progress}%
                        </span>
                      </div>

                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full transition-all ${
                            item.isGoal
                              ? "bg-amber-500"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {item.sessionCount === 0
                          ? "Sin sesiones registradas"
                          : `${item.sessionCount} ${
                              item.sessionCount === 1
                                ? "sesión"
                                : "sesiones"
                            } · ${formatDaysSince(item.lastTrainedDays)}`}
                      </p>
                    </div>
                  ))}

                </div>

              ) : (

                <p className="text-slate-500">
                  Este perro todavía no tiene habilidades asignadas.{" "}
                  <Link
                    href={`/pets/${pet.id}/skills`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Añadir habilidades
                  </Link>
                </p>

              )}

            </div>

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <h2 className="mb-6 text-3xl font-bold">
                Nuevo entrenamiento
              </h2>

              <AddTrainingForm petId={pet.id} />

            </div>

            <div className="mb-8 rounded-2xl border bg-white p-8 shadow">

              <h2 className="mb-6 text-3xl font-bold">
                Historial de entrenamientos
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
                            📅 Entrenamiento seleccionado
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-6">

                          <div>

                            <h3 className="text-xl font-bold">
                              {training.title ??
                                "Entrenamiento"}
                            </h3>

                            <p>
                              📅{" "}
                              {training.date ??
                                "Sin fecha"}
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
                              Estado:{" "}
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
                                  ? "Completado"
                                  : "Pendiente"}
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
                            ✏️ Editar
                          </Link>

                        </div>

                      </div>
                    );
                  })}

                </div>

              ) : (

                <p className="text-slate-500">
                  No hay entrenamientos registrados.
                </p>

              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}