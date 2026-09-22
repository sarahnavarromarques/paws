"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { BREEDS, COLORS, WEIGHTS, getBreedLabel, getColorLabel } from "@/lib/breeds";
import type { Database } from "@/lib/supabase/database.types";
import SearchableSelect from "@/components/SearchableSelect";

const supabase = createClient();

type PetUpdate =
  Database["public"]["Tables"]["pets"]["Update"];

const SEXES = ["Macho", "Hembra"];

function withCurrent(list: string[], value: string): string[] {
  if (value && !list.includes(value)) {
    return [value, ...list];
  }
  return list;
}

function parseWeight(raw: string | null): string {
  if (!raw) return "";
  const match = raw.match(/[\d.,]+/);
  if (!match) return "";
  return match[0].replace(",", ".");
}

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
  const t = useTranslations("EditPet");
  const locale = useLocale();

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
      alert(t("alertSelectImage"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t("alertImageTooLarge"));
      return;
    }

    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploading(false);
      alert(t("alertNoUser"));
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
      alert(t("alertPhotoUploadError"));
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
      alert(t("alertEnterName"));
      return;
    }

    if (!birthDate) {
      alert(t("alertEnterBirthDate"));
      return;
    }

    if (birthDate > todayISO()) {
      alert(t("alertFutureDate"));
      return;
    }

    if (birthDate < minBirthISO()) {
      alert(t("alertOldDate"));
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
      alert(t("alertSaveError"));
      return;
    }

    if (!data || data.length === 0) {
      alert(t("alertNoUpdate"));
      return;
    }

    router.replace(`/pets/${id}`);
    router.refresh();
  }

  async function deletePet() {
    const confirmed = confirm(t("confirmDeletePet"));

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
      alert(t("alertDeleteFailed"));
      return;
    }

    const { error } = await supabase
      .from("pets")
      .delete()
      .eq("id", Number(id))
      .eq("user_id", user.id);

    if (error) {
      console.error("Error eliminando mascota:", error);
      alert(t("alertDeleteFailed"));
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
            {t("loading")}
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
            {t("back")}
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">

          <h1 className="mb-2 text-4xl font-bold">
            {t("title")}
          </h1>

          <p className="mb-8 text-slate-500">
            {t("subtitle")}
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
              {t("changePhoto")}
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
                {t("uploadingImage")}
              </p>
            )}
          </div>

          {/* CAMPOS */}

          <div className="space-y-5">

            {/* NOMBRE */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("nameLabel")}
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />
            </div>

            {/* RAZA */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("breedLabel")}
              </label>

              <SearchableSelect
                options={breedOptions}
                value={breed}
                onChange={setBreed}
                placeholder={t("breedPlaceholder")}
                renderLabel={(item) => getBreedLabel(item, locale)}
              />
            </div>

            {/* FECHA DE NACIMIENTO */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("birthDateLabel")}
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
                {t("ageAutoCalcNote")}
              </p>
            </div>

            {/* SEXO */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("sexLabel")}
              </label>

              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={sex}
                onChange={(e) =>
                  setSex(e.target.value)
                }
              >
                <option value="">
                  {t("selectSex")}
                </option>

                {sexOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === "Macho"
                      ? t("male")
                      : item === "Hembra"
                      ? t("female")
                      : item}
                  </option>
                ))}
              </select>
            </div>

            {/* PESO */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("weightLabel")}
              </label>

              <SearchableSelect
                options={weightOptions}
                value={weight}
                onChange={setWeight}
                placeholder={t("selectWeight")}
                renderLabel={(item) => `${item} kg`}
              />
            </div>

            {/* COLOR */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("colorLabel")}
              </label>

              <SearchableSelect
                options={colorOptions}
                value={color}
                onChange={setColor}
                placeholder={t("selectColor")}
                renderLabel={(item) => getColorLabel(item, locale)}
              />
            </div>

            {/* OBJETIVO */}

            <div>
              <label className="mb-2 block font-semibold">
                {t("objectiveLabel")}
              </label>

              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder={t("objectivePlaceholder")}
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
                ? t("savingButton")
                : t("saveChanges")}
            </button>

            <button
              onClick={() =>
                router.push(`/pets/${id}`)
              }
              disabled={saving}
              className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
            >
              {t("cancelButton")}
            </button>

            <button
              onClick={deletePet}
              disabled={saving || uploading}
              className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("deletePetButton")}
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}