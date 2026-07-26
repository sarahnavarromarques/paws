"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  petId: number;
};

export default function AddTrainingForm({ petId }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSave() {
    if (!title) {
      alert("Introduce un título.");
      return;
    }

    const { error } = await supabase
      .from("training_sessions")
      .insert([
        {
          pet_id: petId,
          title,
          date,
          duration,
          notes,
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Entrenamiento guardado.");

    setTitle("");
    setDate("");
    setDuration("");
    setNotes("");

    location.reload();
  }

  return (
    <div className="bg-white rounded-2xl shadow p-8 mb-8 border">

      <h2 className="text-3xl font-bold mb-6">
        ➕ Nuevo entrenamiento
      </h2>

      <input
        className="w-full border rounded-lg p-3 mb-4"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="w-full border rounded-lg p-3 mb-4"
        placeholder="Fecha"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <input
        className="w-full border rounded-lg p-3 mb-4"
        placeholder="Duración"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
      />

      <textarea
        className="w-full border rounded-lg p-3 mb-6"
        rows={4}
        placeholder="Notas del entrenamiento"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
      >
        Guardar entrenamiento
      </button>

    </div>
  );
}