"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  petId: number;
};

type Skill = {
  id: number;
  name: string;
  category: string | null;
};

export default function AddTrainingForm({ petId }: Props) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<string>("");

  useEffect(() => {
    async function loadSkills() {
      const { data } = await supabase
        .from("skills")
        .select("id, name, category")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (data) {
        setSkills(data);
      }
    }

    loadSkills();
  }, []);

  async function handleSave() {
    if (!title.trim()) {
      alert("Introduce un título.");
      return;
    }

    if (!date) {
      alert("Selecciona una fecha.");
      return;
    }

    const numericDuration = duration
      ? Number(duration)
      : null;

    if (
      numericDuration !== null &&
      (!Number.isFinite(numericDuration) ||
        numericDuration < 0)
    ) {
      alert("Introduce una duración válida.");
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
        duration: numericDuration,
        status,
        notes: notes.trim() || null,
        skill_id: skillId ? Number(skillId) : null,
      });

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    setSaving(false);

    setTitle("");
    setDate("");
    setTime("");
    setDuration("");
    setStatus("pending");
    setNotes("");
    setSkillId("");

    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">

        {/* TÍTULO */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            Entrenamiento
          </label>

          <input
            type="text"
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Ej. Llamada, sentado, paseo..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* HABILIDAD */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            Habilidad trabajada (opcional)
          </label>

          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Sin habilidad específica</option>

            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.category ? `${skill.category} — ` : ""}
                {skill.name}
              </option>
            ))}
          </select>
        </div>

        {/* FECHA */}

        <div>
          <label className="mb-2 block font-semibold">
            Fecha
          </label>

          <input
            type="date"
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* HORA */}

        <div>
          <label className="mb-2 block font-semibold">
            Hora
          </label>

          <input
            type="time"
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* DURACIÓN */}

        <div>
          <label className="mb-2 block font-semibold">
            Duración
          </label>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Minutos"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={saving}
            />

            <span className="whitespace-nowrap text-slate-500">
              min
            </span>
          </div>
        </div>

        {/* ESTADO */}

        <div>
          <label className="mb-2 block font-semibold">
            Estado
          </label>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="pending">
              Pendiente
            </option>

            <option value="completed">
              Completado
            </option>
          </select>
        </div>

        {/* NOTAS */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            Notas
          </label>

          <textarea
            rows={5}
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Notas sobre el entrenamiento..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      {/* BOTÓN */}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Guardando..."
          : "Guardar entrenamiento"}
      </button>
    </div>
  );
}