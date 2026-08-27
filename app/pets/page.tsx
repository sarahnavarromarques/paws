"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import AddPetForm from "@/components/AddPetForm";
import type { Database } from "@/lib/supabase/database.types";

const supabase = createClient();

type PetRow = Database["public"]["Tables"]["pets"]["Row"];

type Pet = Pick<PetRow, "id" | "user_id" | "name" | "breed" | "age" | "birth_date" | "sex" | "weight" | "color" | "objective" | "level" | "last_training" | "photo">;

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

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPets() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPets([]);
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
    } else if (data) {
      setPets(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPets();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-5xl font-extrabold text-blue-700">
              🐶 Mis mascotas
            </h1>

            <p className="mt-3 text-lg text-slate-600">
              Gestiona tus mascotas y consulta su progreso.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>

        {/* AÑADIR MASCOTA */}

        <div className="mb-10 rounded-2xl bg-white p-6 shadow md:p-8">
          <h2 className="mb-6 text-3xl font-bold">
            Añadir mascota
          </h2>

          <AddPetForm onAddPet={loadPets} />
        </div>

        {/* MASCOTAS */}

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold">
              Tus mascotas
            </h2>

            {!loading && pets.length > 0 && (
              <span className="rounded-full bg-blue-100 px-4 py-2 font-semibold text-blue-700">
                {pets.length}{" "}
                {pets.length === 1 ? "mascota" : "mascotas"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <p className="text-slate-500">
                Cargando mascotas...
              </p>
            </div>
          ) : pets.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <div className="text-6xl">
                🐶
              </div>

              <h3 className="mt-4 text-2xl font-bold">
                Todavía no tienes mascotas
              </h3>

              <p className="mt-2 text-slate-500">
                Añade tu primera mascota usando el formulario de arriba.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {pets.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="group"
                >
                  <div className="flex h-full cursor-pointer items-center gap-6 rounded-2xl bg-white p-6 shadow transition duration-200 hover:-translate-y-1 hover:shadow-xl">

                    {/* FOTO */}

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

                    {/* INFORMACIÓN */}

                    <div className="min-w-0">
                      <h3 className="truncate text-3xl font-bold group-hover:text-blue-700">
                        {pet.name}
                      </h3>

                      <p className="mt-1 text-xl text-slate-600">
                        {pet.breed ?? "Sin raza"}
                      </p>

                      <p className="mt-1 text-lg text-slate-500">
                        {calculateAge(pet.birth_date)}
                      </p>

                      <p className="mt-4 font-semibold text-blue-600">
                        Ver perfil →
                      </p>
                    </div>

                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}