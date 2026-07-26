"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import AddPetForm from "@/components/AddPetForm";

type Pet = {
  id: number;
  name: string;
  breed: string;
  age: string;
};

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);

  async function loadPets() {
    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .order("id", { ascending: true });

    if (!error && data) {
      setPets(data);
    }
  }

  useEffect(() => {
    loadPets();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-10">

      <h1 className="text-5xl font-bold text-blue-700 mb-4">
        🐶 Mis mascotas
      </h1>

      <p className="text-xl text-slate-600 mb-10">
        Aquí aparecerán todas tus mascotas.
      </p>

      <div className="mb-10">
        <AddPetForm onAddPet={loadPets} />
      </div>

      <div className="space-y-6">

        {pets.length === 0 && (
          <p className="text-slate-500">
            No hay mascotas todavía.
          </p>
        )}

        {pets.map((pet) => (

          <Link
            key={pet.id}
            href={`/pets/${pet.name.toLowerCase()}`}
          >

            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition cursor-pointer">

              <h2 className="text-3xl font-bold">
                {pet.name}
              </h2>

              <p className="text-xl text-slate-600">
                {pet.breed}
              </p>

              <p className="text-lg text-slate-500">
                {pet.age}
              </p>

            </div>

          </Link>

        ))}

      </div>

    </main>
  );
}