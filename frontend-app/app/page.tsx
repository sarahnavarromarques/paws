"use client";

import { useState } from "react";

import PetCard from "@/components/PetCard";
import AddPetForm from "@/components/AddPetForm";

type Pet = {
  name: string;
  breed: string;
  age: string;
};

export default function PetsPage() {

  const [pets, setPets] = useState<Pet[]>([
    {
      name: "Thor",
      breed: "Border Collie",
      age: "2 años",
    },
    {
      name: "Luna",
      breed: "Labrador Retriever",
      age: "5 años",
    },
    {
      name: "Nala",
      breed: "Pastor Alemán",
      age: "1 año",
    },
    {
      name: "Rocky",
      breed: "Golden Retriever",
      age: "4 años",
    },
  ]);

  function addPet(newPet: Pet) {
    setPets([...pets, newPet]);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">

      <h1 className="text-4xl font-bold text-blue-700">
        🐶 Mis mascotas
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Aquí aparecerán todas tus mascotas.
      </p>

      <div className="mt-8 mb-10">
        <AddPetForm onAddPet={addPet} />
      </div>

      {pets.map((pet, index) => (
        <PetCard
          key={index}
          name={pet.name}
          breed={pet.breed}
          age={pet.age}
        />
      ))}

    </main>
  );
}