"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

const supabase = createClient();

type Pet = Database["public"]["Tables"]["pets"]["Row"];
type PetUpdate = Database["public"]["Tables"]["pets"]["Update"];

export default function EditPetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [objective, setObjective] = useState("");
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    void loadPet();
  }, []);

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
    setAge(data.age ?? "");
    setSex(data.sex ?? "");
    setWeight(data.weight ?? "");
    setColor(data.color ?? "");
    setObjective(data.objective ?? "");
    setPhoto(data.photo ?? "");

    setLoading(false);
  }

  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("No hay usuario autenticado.");
      return;
    }

    const extension = file.name.split(".").pop();
    const fileName = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("pet-photos")
      .upload(fileName, file);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("pet-photos")
      .getPublicUrl(fileName);

    setPhoto(data.publicUrl);
  }

  async function savePet() {
    if (!name.trim()) {
      alert("Introduce un nombre.");
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

    console.log("USER:", user.id);
    console.log("PET:", id);

    const update: PetUpdate = {
      name: name.trim(),
      breed: breed.trim() || null,
      age: age.trim() || null,
      sex: sex.trim() || null,
      weight: weight.trim() || null,
      color: color.trim() || null,
      objective: objective.trim() || null,
      photo: photo || null,
    };

    console.log(update);

    const { data, error } = await supabase
  .from("pets")
  .update(update)
  .eq("id", Number(id))
  .select();

console.log("ERROR:", error);
console.log("DATA:", data);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("No se ha actualizado ninguna mascota.");
      console.error("UPDATE 0 FILAS");
      return;
    }

    router.replace(`/pets/${id}`);
    router.refresh();
  }  
  
  async function deletePet() {
    if (!confirm("¿Seguro que quieres eliminar esta mascota?")) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("pets")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    router.replace("/pets");
    router.refresh();
  }

  if (loading) {
    return <main className="p-10">Cargando...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-xl">
        <h1 className="mb-8 text-4xl font-bold">
          Editar mascota
        </h1>

        {photo && (
          <Image
            src={photo}
            alt={name}
            width={160}
            height={160}
            className="mx-auto mb-8 h-40 w-40 rounded-full border-4 border-blue-500 object-cover"
          />
        )}

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Raza"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Edad"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Sexo"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Peso"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border p-3"
          placeholder="Objetivo"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />

        <label className="mb-2 block font-semibold">
          Cambiar foto
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={uploadPhoto}
          className="mb-8"
        />

        <div className="flex gap-4">
          <button
            onClick={savePet}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>

          <button
            onClick={deletePet}
            className="rounded-xl bg-red-600 px-6 py-3 text-white hover:bg-red-700"
          >
            Eliminar mascota
          </button>
        </div>
      </div>
    </main>
  );
}