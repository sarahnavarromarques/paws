"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  category: string | null;
};

export default function EditTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
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
    void loadSkills();
    void loadTraining();
  }, [id]);

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

  async function loadTraining() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", Number(id))
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      router.replace("/dashboard");
      return;
    }

    setTitle(data.title ?? "");
    setDate(data.date ?? "");
    setTime(data.time ?? "");
    setDuration(
      data.duration !== null
        ? String(data.duration)
        : ""
    );
    setStatus(data.status ?? "pending");
    setNotes(data.notes ?? "");
    setSkillId(
      data.skill_id !== null && data.skill_id !== undefined
        ? String(data.skill_id)
        : ""
    );

    setLoading(false);
  }

  async function saveTraining() {
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

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("trainings")
      .update({
        title: title.trim(),
        date,
        time: time || null,
        duration: numericDuration,
        status,
        notes: notes.trim() || null,
        skill_id: skillId ? Number(skillId) : null,
      })
      .eq("id", Number(id))
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.back();
    router.refresh();
  }

  async function deleteTraining() {
    if (
      !confirm(
        "¿Seguro que quieres eliminar este entrenamiento?"
      )
    ) {
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("trainings")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-xl">
          <p className="text-slate-500">
            Cargando entrenamiento...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">

        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Volver
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">

          <h1 className="mb-2 text-4xl font-bold">
            Editar entrenamiento
          </h1>

          <p className="mb-8 text-slate-500">
            Modifica los datos del entrenamiento.
          </p>

          <div className="grid gap-5 md:grid-cols-2">

            {/* TÍTULO */}

            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold">
                Entrenamiento
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* HABILIDAD */}

            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold">
                Habilidad trabajada (opcional)
              </label>

              <select
                value={skillId}
                onChange={(e) =>
                  setSkillId(e.target.value)
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">
                  Sin habilidad específica
                </option>

                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.category
                      ? `${skill.category} — `
                      : ""}
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
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* HORA */}

            <div>
              <label className="mb-2 block font-semibold">
                Hora
              </label>

              <input
                type="time"
                value={time}
                onChange={(e) =>
                  setTime(e.target.value)
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                  value={duration}
                  onChange={(e) =>
                    setDuration(e.target.value)
                  }
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                onChange={(e) =>
                  setStatus(e.target.value)
                }
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
                rows={6}
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

          </div>

          {/* BOTONES */}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={saveTraining}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "Guardar cambios"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              disabled={saving}
              className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={deleteTraining}
              disabled={saving}
              className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🗑 Eliminar
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}