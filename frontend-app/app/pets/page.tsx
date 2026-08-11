"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import AddPetForm from "@/components/AddPetForm";
import type { Database } from "@/lib/supabase/database.types";

const supabase = createClient();

type Pet = Database["public"]["Tables"]["pets"]["Row"];

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
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: true });

    if (!error && data) {
      setPets(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPets();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-5xl font-bold text-blue-700">
          🐶 Mis mascotas
        </h1>

        <p className="mb-10 text-xl text-slate-600">
          Aquí aparecerán únicamente tus mascotas.
        </p>

        <div className="mb-10">
          <AddPetForm onAddPet={loadPets} />
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando mascotas...</p>
        ) : (
          <div className="space-y-6">
            {pets.length === 0 && (
              <p className="text-slate-500">
                Todavía no has añadido ninguna mascota.
              </p>
            )}

            {pets.map((pet) => (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <div className="flex cursor-pointer items-center gap-6 rounded-2xl bg-white p-6 shadow-lg transition hover:shadow-xl">
                  {pet.photo ? (
                    <Image
                      src={pet.photo}
                      alt={pet.name}
                      width={112}
                      height={112}
                      className="h-28 w-28 rounded-full border-4 border-blue-500 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-200 text-5xl">
                      🐶
                    </div>
                  )}

                  <div>
                    <h2 className="text-3xl font-bold">{pet.name}</h2>

                    <p className="text-xl text-slate-600">
                      {pet.breed ?? "Sin raza"}
                    </p>

                    <p className="text-lg text-slate-500">
                      {pet.age ?? "Sin edad"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}