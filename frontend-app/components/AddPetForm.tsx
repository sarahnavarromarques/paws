"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type AddPetFormProps = {
  onAddPet?: () => Promise<void> | void;
};

export default function AddPetForm({ onAddPet }: AddPetFormProps) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !breed.trim() || !age.trim()) {
      alert("Completa todos los campos.");
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
      const extension = photo.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(fileName, photo);

      if (uploadError) {
        alert(uploadError.message);
        setSaving(false);
        return;
      }

      const { data } = supabase.storage
        .from("pet-photos")
        .getPublicUrl(fileName);

      photoUrl = data.publicUrl;
    }

    const { error } = await supabase.from("pets").insert({
      user_id: user.id,
      name: name.trim(),
      breed: breed.trim(),
      age: age.trim(),
      photo: photoUrl,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setBreed("");
    setAge("");
    setPhoto(null);

    await onAddPet?.();
  }

  return (
    <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="mb-6 text-2xl font-bold">
        Nueva mascota
      </h2>

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Raza"
        value={breed}
        onChange={(e) => setBreed(e.target.value)}
      />

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder="Edad"
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        className="mb-6"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setPhoto(file);
        }}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar mascota"}
      </button>
    </div>
  );
}