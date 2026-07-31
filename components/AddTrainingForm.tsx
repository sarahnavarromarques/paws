"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  petId: number;
};

export default function AddTrainingForm({ petId }: Props) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSave() {
    if (!title.trim()) {
      alert("Introduce un título.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Usuario no autenticado.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("trainings")
      .insert({
        user_id: user.id,
        pet_id: petId,
        title: title.trim(),
        date,
        time: time || null,
        duration: duration ? Number(duration) : null,
        notes: notes.trim() || null,
      });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDate("");
    setTime("");
    setDuration("");
    setNotes("");

    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-white p-8 shadow">

      <h2 className="mb-6 text-3xl font-bold">
        Nuevo entrenamiento
      </h2>

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        type="date"
        className="mb-4 w-full rounded-lg border p-3"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <input
        type="time"
        className="mb-4 w-full rounded-lg border p-3"
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />

      <input
        type="number"
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Duración (minutos)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
      />

      <textarea
        rows={5}
        className="mb-6 w-full rounded-lg border p-3"
        placeholder="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar entrenamiento"}
      </button>

    </div>
  );
}