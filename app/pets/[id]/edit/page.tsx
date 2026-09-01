"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { BREEDS, COLORS, WEIGHTS } from "@/lib/breeds";
import type { Database } from "@/lib/supabase/database.types";

const supabase = createClient();

type PetUpdate =
  Database["public"]["Tables"]["pets"]["Update"];

const SEXES = ["Macho", "Hembra"];

// Asegura que el valor actual siempre esté en la lista,
// para que al editar nunca se pierda un dato ya guardado.
function withCurrent(list: string[], value: string): string[] {
  if (value && !list.includes(value)) {
    return [value, ...list];
  }
  return list;
}

// Extrae el número de un peso guardado como "28 kg" -> "28"
function parseWeight(raw: string | null): string {
  if (!raw) return "";
  const match = raw.match(/[\d.,]+/);
  if (!match) return "";
  return match[0].replace(",", ".");
}

// Límites de fecha de nacimiento
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function minBirthISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().split("T")[0];
}

export default function EditPetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [objective, setObjective] = useState("");
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    void loadPet();
  }, [id]);

  async function loadPet() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("id", Number(id))
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      router.replace("/pets");
      return;
    }

    setName(data.name ?? "");
    setBreed(data.breed ?? "");
    setBirthDate(data.birth_date ?? "");
    setSex(data.sex ?? "");
    setWeight(parseWeight(data.weight));
    setColor(data.color ?? "");
    setObjective(data.objective ?? "");
    setPhoto(data.photo ?? "");

    setLoading(false);
  }

  async function uploadPhoto(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5 MB.");
      return;
    }

    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploading(false);
      alert("No hay usuario autenticado.");
      return;
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() ?? "jpg";

    const fileName =
      `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("pet-photos")
      .upload(fileName, file);

    if (error) {
      console.error("Error subiendo foto:", error);
      setUploading(false);
      alert(
        "No se ha podido subir la foto. Inténtalo de nuevo o prueba con otra imagen."
      );
      return;
    }

    const { data } = supabase.storage
      .from("pet-photos")
      .getPublicUrl(fileName);

    setPhoto(data.publicUrl);
    setUploading(false);
  }

  async function savePet() {
    if (!name.trim()) {
      alert("Introduce un nombre.");
      return;
    }

    if (!birthDate) {
      alert("Introduce la fecha de nacimiento.");
      return;
    }

    if (birthDate > todayISO()) {
      alert("La fecha de nacimiento no puede ser futura.");
      return;
    }

    if (birthDate < minBirthISO()) {
      alert(
        "La fecha de nacimiento no es válida (demasiado antigua)."
      );
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

    const update: PetUpdate = {
      name: name.trim(),
      breed: breed || null,
      birth_date: birthDate,
      sex: sex || null,
      weight: weight ? `${weight} kg` : null,
      color: color || null,
      objective: objective.trim() || null,
      photo: photo || null,
    };

    const { data, error } = await supabase
      .from("pets")
      .update(update)
      .eq("id", Number(id))
      .eq("user_id", user.id)
      .select();

    setSaving(false);

    if (error) {
      console.error("Error guardando cambios:", error);
      alert(
        "No se han podido guardar los cambios. Inténtalo de nuevo."
      );
      return;
    }

    if (!data || data.length === 0) {
      alert("No se ha actualizado ninguna mascota.");
      return;
    }

    router.replace(`/pets/${id}`);
    router.refresh();
  }

  async function deletePet() {
    const confirmed = confirm(
      "¿Seguro que quieres eliminar esta mascota? También se eliminarán sus entrenamientos."
    );

    if (!confirmed) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error: trainingError } = await supabase
      .from("trainings")
      .delete()
      .eq("pet_id", Number(id))
      .eq("user_id", user.id);

    if (trainingError) {
      console.error(
        "Error eliminando entrenamientos:",
        trainingError
      );
      alert(
        "No se ha podido eliminar la mascota. Inténtalo de nuevo."
      );
      return;
    }

    const { error } = await supabase
      .from("pets")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", user.id);

    if (error) {
      console.error("Error eliminando mascota:", error);
      alert(
        "No se ha podido eliminar la mascota. Inténtalo de nuevo."
      );
      return;
    }

    router.replace("/pets");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-xl">
          <p className="text-slate-500">
            Cargando mascota...
          </p>
        </div>
      </main>
    );
  }

  const breedOptions = withCurrent(BREEDS, breed);
  const sexOptions = withCurrent(SEXES, sex);
  const colorOptions = withCurrent(COLORS, color);
  const weightOptions = withCurrent(WEIGHTS, weight);

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Volver
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">

          <h1 className="mb-2 text-4xl font-bold">
            Editar mascota
          </h1>

          <p className="mb-8 text-slate-500">
            Actualiza la información de tu mascota.
          </p>

          {/* FOTO */}

          <div className="mb-8 text-center">

            {photo ? (
              <Image
                src={photo}
                alt={name}
                width={160}
                height={160}
                className="mx-auto mb-5 h-40 w-40 rounded-full border-4 border-blue-500 object-cover"
              />
            ) : (
              <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center rounded-full bg-slate-200 text-6xl">
                🐶
              </div>
            )}

            <label className="block font-semibold">
              Cambiar foto
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={uploading}
              className="mx-auto mt-3 block max-w-full"
            />

            {uploading && (
              <p className="mt-2 text-sm text-blue-600">
                Subiendo imagen...
              </p>
            )}
          </div>

          {/* CAMPOS */}

          <div className="space-y-5">

            {/* NOMBRE */}

            <div>
              <label className="mb-2 block font-semibold">
                Nombre
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Nombre"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />
            </div>

            {/* RAZA */}

            <div>
              <label className="mb-2 block font-semibold">
                Raza
              </label>

              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={breed}
                onChange={(e) =>
                  setBreed(e.target.value)
                }
              >
                <option value="">
                  Selecciona una raza
                </option>

                {breedOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* FECHA DE NACIMIENTO */}

            <div>
              <label className="mb-2 block font-semibold">
                Fecha de nacimiento
              </label>

              <input
                type="date"
                min={minBirthISO()}
                max={todayISO()}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={birthDate}
                onChange={(e) =>
                  setBirthDate(e.target.value)
                }
              />

              <p className="mt-2 text-sm text-slate-500">
                La edad se calculará automáticamente a partir de esta fecha.
              </p>
            </div>

            {/* SEXO */}

            <div>
              <label className="mb-2 block font-semibold">
                Sexo
              </label>

              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={sex}
                onChange={(e) =>
                  setSex(e.target.value)
                }
              >
                <option value="">
                  Selecciona el sexo
                </option>

                {sexOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* PESO */}

            <div>
              <label className="mb-2 block font-semibold">
                Peso
              </label>

              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={weight}
                onChange={(e) =>
                  setWeight(e.target.value)
                }
              >
                <option value="">
                  Selecciona el peso
                </option>

                {weightOptions.map((item) => (
                  <option key={item} value={item}>
                    {item} kg
                  </option>
                ))}
              </select>
            </div>

            {/* COLOR */}

            <div>
              <label className="mb-2 block font-semibold">
                Color
              </label>

              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={color}
                onChange={(e) =>
                  setColor(e.target.value)
                }
              >
                <option value="">
                  Selecciona un color
                </option>

                {colorOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* OBJETIVO */}

            <div>
              <label className="mb-2 block font-semibold">
                Objetivo
              </label>

              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Objetivo de entrenamiento"
                value={objective}
                onChange={(e) =>
                  setObjective(e.target.value)
                }
              />
            </div>

          </div>

          {/* BOTONES */}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">

            <button
              onClick={savePet}
              disabled={saving || uploading}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "Guardar cambios"}
            </button>

            <button
              onClick={() =>
                router.push(`/pets/${id}`)
              }
              disabled={saving}
              className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              onClick={deletePet}
              disabled={saving || uploading}
              className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🗑 Eliminar mascota
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}