"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BREEDS, COLORS, WEIGHTS } from "@/lib/breeds";

const supabase = createClient();

type AddPetFormProps = {
  onAddPet?: () => Promise<void> | void;
};

// Formatos de imagen permitidos
const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Límites de fecha de nacimiento
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function minBirthISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().split("T")[0];
}

// Convierte "1996-08-30" en "30/08/1996"
function toSpanishDate(iso: string) {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function AddPetForm({
  onAddPet,
}: AddPetFormProps) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [customBreed, setCustomBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");

  const [saving, setSaving] = useState(false);

  // Aviso visible si la fecha no es válida
  const dateError =
    birthDate !== "" &&
    (birthDate > todayISO() || birthDate < minBirthISO());

  function handlePhotoChange(file: File | null) {
    setPhotoError("");

    if (!file) {
      setPhoto(null);
      return;
    }

    // Comprobación real del tipo de archivo
    const type = file.type.toLowerCase();
    const isAllowed = ALLOWED_PHOTO_TYPES.includes(type);

    if (!isAllowed) {
      setPhoto(null);
      setPhotoError(
        "Ese formato no es válido. Sube una foto JPG, PNG o WEBP. Si es una foto de iPhone (HEIC), cámbiala a JPG en Ajustes › Cámara › Formatos, o haz una captura de pantalla de la foto."
      );
      return;
    }

    setPhoto(file);
  }

  async function handleSave() {
    // Raza final: si eligió "Otro", usamos lo que escribió
    const finalBreed =
      breed === "Otro" ? customBreed.trim() : breed;

    if (!name.trim() || !finalBreed || !birthDate) {
      alert(
        "Completa el nombre, la raza y la fecha de nacimiento."
      );
      return;
    }

    if (breed === "Otro" && !customBreed.trim()) {
      alert("Escribe la raza de tu perro.");
      return;
    }

    // Validación de fecha de nacimiento
    if (birthDate > todayISO()) {
      alert(
        "La fecha de nacimiento no puede ser futura."
      );
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
      alert("No hay usuario autenticado.");
      setSaving(false);
      return;
    }

    let photoUrl: string | null = null;

    if (photo) {
      const extension =
        photo.name.split(".").pop() || "jpg";

      const fileName =
        `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("pet-photos")
          .upload(fileName, photo);

      if (uploadError) {
        console.error("Error subiendo foto:", uploadError);
        alert(
          "No se ha podido subir la foto. Inténtalo de nuevo o prueba con otra imagen."
        );
        setSaving(false);
        return;
      }

      const { data } =
        supabase.storage
          .from("pet-photos")
          .getPublicUrl(fileName);

      photoUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("pets")
      .insert({
        user_id: user.id,
        name: name.trim(),
        breed: finalBreed,
        birth_date: birthDate,
        sex: sex || null,
        weight: weight ? `${weight} kg` : null,
        color: color || null,
        photo: photoUrl,
      });

    setSaving(false);

    if (error) {
      console.error("Error guardando mascota:", error);
      alert(
        "No se ha podido guardar la mascota. Inténtalo de nuevo."
      );
      return;
    }

    setName("");
    setBreed("");
    setCustomBreed("");
    setBirthDate("");
    setSex("");
    setWeight("");
    setColor("");
    setPhoto(null);
    setPhotoError("");

    await onAddPet?.();
  }

  return (
    <div>
      <label className="mb-2 block font-semibold">
        Nombre
      </label>

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Nombre de la mascota"
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
      />

      <label className="mb-2 block font-semibold">
        Raza
      </label>

      <select
        className="mb-4 w-full rounded-lg border bg-white p-3"
        value={breed}
        onChange={(e) => {
          setBreed(e.target.value);
          if (e.target.value !== "Otro") {
            setCustomBreed("");
          }
        }}
      >
        <option value="">
          Selecciona una raza
        </option>

        {BREEDS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {breed === "Otro" && (
        <div className="mb-4">
          <label className="mb-2 block font-semibold">
            Escribe la raza
          </label>
          <input
            className="w-full rounded-lg border p-3"
            placeholder="Ej. Braco de Weimar"
            value={customBreed}
            onChange={(e) =>
              setCustomBreed(e.target.value)
            }
          />
        </div>
      )}

      <label className="mb-2 block font-semibold">
        Foto de la mascota
      </label>

      <label
        htmlFor="pet-photo-input"
        className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        📷 {photo ? "Cambiar foto" : "Seleccionar foto"}
      </label>

      <input
        id="pet-photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file =
            e.target.files?.[0] ?? null;
          handlePhotoChange(file);
        }}
      />

      {photo && (
        <p className="mb-2 text-sm text-slate-600">
          ✅ Archivo: {photo.name}
        </p>
      )}

      {photoError && (
        <div className="mb-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          ⚠️ {photoError}
        </div>
      )}

      <p className="mb-4 text-sm text-slate-500">
        Formatos admitidos: JPG, PNG o WEBP.
      </p>

      <label className="mb-2 block font-semibold">
        Sexo
      </label>

      <select
        className="mb-4 w-full rounded-lg border bg-white p-3"
        value={sex}
        onChange={(e) => setSex(e.target.value)}
      >
        <option value="">
          Selecciona el sexo
        </option>
        <option value="Macho">Macho</option>
        <option value="Hembra">Hembra</option>
      </select>

      <label className="mb-2 block font-semibold">
        Peso (opcional)
      </label>

      <div className="mb-4 flex items-center gap-2">
        <select
          className="w-full rounded-lg border bg-white p-3"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        >
          <option value="">
            Selecciona el peso
          </option>

          {WEIGHTS.map((item) => (
            <option key={item} value={item}>
              {item} kg
            </option>
          ))}
        </select>
      </div>

      <label className="mb-2 block font-semibold">
        Color (opcional)
      </label>

      <select
        className="mb-4 w-full rounded-lg border bg-white p-3"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      >
        <option value="">
          Selecciona un color
        </option>

        {COLORS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <label className="mb-2 block font-semibold">
        Fecha de nacimiento
      </label>

      <input
        type="date"
        min={minBirthISO()}
        max={todayISO()}
        className="mb-2 w-full rounded-lg border p-3"
        value={birthDate}
        onChange={(e) =>
          setBirthDate(e.target.value)
        }
      />

      {dateError ? (
        <p className="mb-6 text-sm font-semibold text-red-600">
          ⚠️ La fecha no es válida. Debe estar entre{" "}
          {toSpanishDate(minBirthISO())} y hoy.
        </p>
      ) : (
        <p className="mb-6 text-sm text-slate-500">
          La edad se calculará automáticamente.
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || dateError}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar mascota"}
      </button>
    </div>
  );
}