import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import AddTrainingForm from "@/components/AddTrainingForm";

type PageProps = {
  params: Promise<{
    name: string;
  }>;
};

export default async function PetProfile({ params }: PageProps) {
  const { name } = await params;

  // Buscar la mascota

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("*")
    .ilike("name", name)
    .single();

  console.log("PET:", pet);
  console.log("PET ERROR:", petError);

  if (!pet) {
    notFound();
  }

  // Buscar entrenamientos

  const { data: trainings, error: trainingError } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("pet_id", pet.id)
    .order("id", { ascending: false });

  console.log("TRAININGS:", trainings);
  console.log("TRAINING ERROR:", trainingError);

  return (
    <main className="min-h-screen bg-slate-100 p-10">

      <div className="bg-white rounded-3xl shadow-xl max-w-5xl mx-auto overflow-hidden">

        {/* CABECERA */}

        <div className="bg-blue-600 text-white p-10">

          <div className="flex items-center gap-6">

            <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-6xl">
              🐶
            </div>

            <div>

              <h1 className="text-5xl font-bold">
                {pet.name}
              </h1>

              <p className="text-2xl text-blue-100 mt-2">
                {pet.breed}
              </p>

            </div>

          </div>

        </div>

        {/* CONTENIDO */}

        <div className="grid md:grid-cols-2 gap-8 p-10">

          <div className="bg-slate-100 rounded-2xl p-8">

            <h2 className="text-3xl font-bold mb-6">
              Información
            </h2>

            <div className="space-y-4 text-lg">

              <p>
                <strong>Edad:</strong> {pet.age || "Sin datos"}
              </p>

              <p>
                <strong>Sexo:</strong> {pet.sex || "Sin datos"}
              </p>

              <p>
                <strong>Peso:</strong> {pet.weight || "Sin datos"}
              </p>

              <p>
                <strong>Color:</strong> {pet.color || "Sin datos"}
              </p>

              <p>
                <strong>Objetivo:</strong> {pet.objective || "Sin datos"}
              </p>

            </div>

          </div>

          <div className="bg-slate-100 rounded-2xl p-8">

            <h2 className="text-3xl font-bold mb-6">
              Estado
            </h2>

            <div className="space-y-4 text-lg">

              <p>🏃 Muy activo</p>

              <p>🧠 Aprende rápido</p>

              <p>🎯 Muy motivado con comida</p>

              <p>
                📅 Último entrenamiento: {pet.last_training || "Sin datos"}
              </p>

              <p>
                ⭐ Nivel: {pet.level || "Principiante"}
              </p>

            </div>

          </div>

        </div>

        {/* HISTORIAL */}

        <div className="px-10">

          <div className="bg-white border rounded-2xl shadow p-8 mb-8">

            <h2 className="text-3xl font-bold mb-6">
              📅 Historial de entrenamientos
            </h2>

            {trainings && trainings.length > 0 ? (

              <div className="space-y-6">

                {trainings.map((training: any) => (

                  <div
                    key={training.id}
                    className="border-b pb-4"
                  >

                    <h3 className="text-xl font-bold">
                      {training.title}
                    </h3>

                    <p>📅 {training.date}</p>

                    <p>⏱ {training.duration}</p>

                    <p className="text-slate-600">
                      {training.notes}
                    </p>

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

        {/* IA */}

        <div className="px-10 pb-10">

          <div className="bg-green-50 border border-green-300 rounded-2xl p-8">

            <h2 className="text-3xl font-bold mb-4">
              🤖 Recomendación de PAWS AI
            </h2>

            <p className="text-lg leading-8">

              Hoy sería un buen momento para practicar la llamada
              utilizando premios de comida y pocas distracciones.

              <br />
              <br />

              <strong>{pet.name}</strong> está en una fase ideal para
              consolidar este comportamiento.

            </p>

          </div>

        </div>

      </div>

    </main>
  );
}