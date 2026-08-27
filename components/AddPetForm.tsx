"use client";

import { useState } from "react";
import { pipeline, RawImage } from "@huggingface/transformers";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type AddPetFormProps = {
  onAddPet?: () => Promise<void> | void;
};

const BREEDS = [
  "Mestizo",
  "Labrador Retriever",
  "Golden Retriever",
  "Pastor Alemán",
  "Bulldog Francés",
  "Bulldog Inglés",
  "Beagle",
  "Caniche",
  "Chihuahua",
  "Yorkshire Terrier",
  "Pomerania",
  "Border Collie",
  "Boxer",
  "Rottweiler",
  "Husky Siberiano",
  "Dálmata",
  "Cocker Spaniel",
  "Shih Tzu",
  "Teckel",
  "Bichón Maltés",
  "Bichón Frisé",
  "Jack Russell Terrier",
  "American Staffordshire Terrier",
  "Pitbull",
  "Doberman",
  "Gran Danés",
  "San Bernardo",
  "Akita Inu",
  "Shiba Inu",
];

const BREED_ALIASES: Record<string, string> = {
  chihuahua: "Chihuahua",
  maltese_dog: "Bichón Maltés",
  "shih-tzu": "Shih Tzu",
  yorkshire_terrier: "Yorkshire Terrier",
  beagle: "Beagle",
  golden_retriever: "Golden Retriever",
  labrador_retriever: "Labrador Retriever",
  german_shepherd: "Pastor Alemán",
  french_bulldog: "Bulldog Francés",
  english_bulldog: "Bulldog Inglés",
  cocker_spaniel: "Cocker Spaniel",
  american_staffordshire_terrier:
    "American Staffordshire Terrier",
  staffordshire_bullterrier:
    "American Staffordshire Terrier",
  rottweiler: "Rottweiler",
  siberian_husky: "Husky Siberiano",
  boxer: "Boxer",
  border_collie: "Border Collie",
  pomeranian: "Pomerania",
  doberman: "Doberman",
  great_dane: "Gran Danés",
  saint_bernard: "San Bernardo",
  akita: "Akita Inu",
  akita_inu: "Akita Inu",
  shiba_inu: "Shiba Inu",
  dalmatian: "Dálmata",
  toy_poodle: "Caniche",
  miniature_poodle: "Caniche",
  standard_poodle: "Caniche",
  poodle: "Caniche",
  dachshund: "Teckel",
  jack_russell_terrier:
    "Jack Russell Terrier",
};

let classifierPromise: Promise<any> | null = null;

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "image-classification",
      "skyau/dog-breed-classifier-vit",
      {
        revision: "refs/pr/3",
      }
    );
  }

  return classifierPromise;
}

function normalizeLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

function findBreed(label: string) {
  const normalized = normalizeLabel(label);

  return BREED_ALIASES[normalized] ?? null;
}

export default function AddPetForm({
  onAddPet,
}: AddPetFormProps) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  async function identifyBreed(file: File) {
    setIdentifying(true);

    setAiMessage(
      "🤖 Analizando la foto... La primera vez puede tardar un poco."
    );

    try {
      const classifier = await getClassifier();

      const image = await RawImage.fromBlob(file);

      const results = await classifier(image, {
        top_k: 5,
      });

      if (!Array.isArray(results) || results.length === 0) {
        setAiMessage(
          "🤖 No he podido identificar la raza. Selecciónala manualmente."
        );
        return;
      }

      let detectedBreed: string | null = null;
      let confidence = 0;

      for (const result of results) {
        const candidate = findBreed(
          String(result.label)
        );

        if (candidate) {
          detectedBreed = candidate;
          confidence = Math.round(
            Number(result.score) * 100
          );
          break;
        }
      }

      if (!detectedBreed) {
        setBreed("Mestizo");

        setAiMessage(
          "🤖 No he encontrado una raza de la lista. He seleccionado Mestizo."
        );

        return;
      }

      setBreed(detectedBreed);

      setAiMessage(
        `🤖 Creo que es ${detectedBreed} (${confidence}%). Puedes cambiarla si no es correcta.`
      );
    } catch (error) {
      console.error(
        "Error identificando raza:",
        error
      );

      setAiMessage(
        "❌ No se ha podido analizar la foto. Selecciona la raza manualmente."
      );
    } finally {
      setIdentifying(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !breed || !birthDate) {
      alert(
        "Completa el nombre, la raza y la fecha de nacimiento."
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
        alert(uploadError.message);
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
        breed,
        birth_date: birthDate,
        photo: photoUrl,
      });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setBreed("");
    setBirthDate("");
    setPhoto(null);
    setAiMessage("");

    await onAddPet?.();
  }

  return (
    <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="mb-6 text-2xl font-bold">
        Nueva mascota
      </h2>

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
          setAiMessage("");
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

      <label className="mb-2 block font-semibold">
        Foto de la mascota
      </label>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="mb-3 w-full"
        onChange={async (e) => {
          const file =
            e.target.files?.[0] ?? null;

          setPhoto(file);
          setAiMessage("");

          if (file) {
            await identifyBreed(file);
          }
        }}
      />

      {aiMessage && (
        <div className="mb-6 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {aiMessage}
        </div>
      )}

      <label className="mb-2 block font-semibold">
        Fecha de nacimiento
      </label>

      <input
        type="date"
        className="mb-2 w-full rounded-lg border p-3"
        value={birthDate}
        onChange={(e) =>
          setBirthDate(e.target.value)
        }
      />

      <p className="mb-6 text-sm text-slate-500">
        La edad se calculará automáticamente.
      </p>

      <button
        onClick={handleSave}
        disabled={saving || identifying}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Guardando..."
          : identifying
            ? "Analizando foto..."
            : "Guardar mascota"}
      </button>
    </div>
  );
}