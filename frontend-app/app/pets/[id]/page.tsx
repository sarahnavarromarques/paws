import TrainingActions from "@/components/TrainingActions";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import AddTrainingForm from "@/components/AddTrainingForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PetProfile({ params }: PageProps) {
  const { id } = await params;

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
    .order("date", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="max-w-6xl mx-auto">

        <div className="mb-6 flex gap-4">
          <Link
            href="/pets"
            className="bg-slate-600 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-semibold transition"
          >
            ← Mis mascotas
          </Link>

          <Link
            href={`/pets/${pet.id}/edit`}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold transition"
          >
            ✏️ Editar mascota
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* CABECERA */}

          <div className="bg-blue-600 text-white p-10">

            <div className="flex items-center gap-6">

              {pet.photo ? (
                <img
                  src={pet.photo}
                  alt={pet.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-6xl">
                  🐶
                </div>
              )}

              <div>
                <h1 className="text-5xl font-bold">
                  {pet.name}
                </h1>

                <p className="text-2xl text-blue-100">
                  {pet.breed}
                </p>
              </div>

            </div>

          </div>

          {/* INFORMACIÓN */}

          <div className="grid md:grid-cols-2 gap-8 p-10">

            <div className="bg-slate-100 rounded-2xl p-8">

<div className="grid grid-cols-4 gap-4 mb-8">

  <div className="bg-blue-50 rounded-xl p-5 text-center">
    <p className="text-3xl font-bold">
      {trainings?.length ?? 0}
    </p>
    <p>Total</p>
  </div>

  <div className="bg-green-50 rounded-xl p-5 text-center">
    <p className="text-3xl font-bold">
      {trainings?.filter(t => t.status === "completed").length ?? 0}
    </p>
    <p>Completados</p>
  </div>

  <div className="bg-orange-50 rounded-xl p-5 text-center">
    <p className="text-3xl font-bold">
      {trainings?.filter(t => t.status === "pending").length ?? 0}
    </p>
    <p>Pendientes</p>
  </div>

  <div className="bg-purple-50 rounded-xl p-5 text-center">
    <p className="text-3xl font-bold">
      {trainings?.reduce((a, b) => a + (b.duration ?? 0), 0)}
    </p>
    <p>Minutos</p>
  </div>

</div>


              <h2 className="text-3xl font-bold mb-6">
                Información
              </h2>

              <div className="space-y-4">

                <p><strong>Edad:</strong> {pet.age ?? "Sin datos"}</p>

                <p><strong>Sexo:</strong> {pet.sex ?? "Sin datos"}</p>

                <p><strong>Peso:</strong> {pet.weight ?? "Sin datos"}</p>

                <p><strong>Color:</strong> {pet.color ?? "Sin datos"}</p>

                <p><strong>Objetivo:</strong> {pet.objective ?? "Sin datos"}</p>

              </div>

            </div>

            <div className="bg-slate-100 rounded-2xl p-8">

              <h2 className="text-3xl font-bold mb-6">
                Estado
              </h2>

              <div className="space-y-4">

                <p>
                  📅 Último entrenamiento:{" "}
                  {pet.last_training ?? "Sin datos"}
                </p>

                <p>
                  ⭐ Nivel: {pet.level ?? "Principiante"}
                </p>

              </div>

            </div>

          </div>

          {/* NUEVO ENTRENAMIENTO */}

          <div className="px-10">

            <div className="bg-white border rounded-2xl shadow p-8 mb-8">

              <h2 className="text-3xl font-bold mb-6">
                Nuevo entrenamiento
              </h2>

              <AddTrainingForm petId={pet.id} />

            </div>

            {/* HISTORIAL */}

            <div className="bg-white border rounded-2xl shadow p-8 mb-8">

              <h2 className="text-3xl font-bold mb-6">
                Historial de entrenamientos
              </h2>

              {trainings && trainings.length > 0 ? (

                <div className="space-y-4">

                  {trainings.map((training: any) => (
  <div
    key={training.id}
    className="border rounded-xl p-5 flex justify-between items-start"
  >
    <div>
      <h3 className="text-xl font-bold">{training.title}</h3>

      <p>📅 {training.date}</p>

      <p>🕒 {training.time ?? "--:--"}</p>

      <p>⏱ {training.duration ?? "-"} min</p>

      <p>
        Estado:{" "}
        <span
          className={
            training.status === "completed"
              ? "text-green-600 font-bold"
              : "text-orange-600 font-bold"
          }
        >
          {training.status}
        </span>
      </p>

      <p className="mt-2 text-slate-600">
        {training.notes}
      </p>
    </div>

    <TrainingActions id={training.id} />
  </div>
))}

 

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