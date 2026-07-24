"use client";

import { useState } from "react";

type AddPetFormProps = {
  onAddPet: (pet: {
    name: string;
    breed: string;
    age: string;
  }) => void;
};

export default function AddPetForm({ onAddPet }: AddPetFormProps) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");

  function handleSave() {
    if (!name || !breed || !age) {
      alert("Completa todos los campos.");
      return;
    }

    onAddPet({
      name,
      breed,
      age,
    });

    setName("");
    setBreed("");
    setAge("");
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-8">
      <h2 className="text-2xl font-bold mb-6">
        Nueva mascota
      </h2>

      <input
        className="w-full border rounded-lg p-3 mb-4"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="w-full border rounded-lg p-3 mb-4"
        placeholder="Raza"
        value={breed}
        onChange={(e) => setBreed(e.target.value)}
      />

      <input
        className="w-full border rounded-lg p-3 mb-6"
        placeholder="Edad"
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />

      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
      >
        Guardar mascota
      </button>
    </div>
  );
}