"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { BREEDS, COLORS, WEIGHTS, getBreedLabel, getColorLabel } from "@/lib/breeds";
import SearchableSelect from "@/components/SearchableSelect";

const supabase = createClient();

type AddPetFormProps = {
  onAddPet?: () => Promise<void> | void;
};

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function minBirthISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().split("T")[0];
}

function formatDateForLocale(iso: string, locale: string) {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return locale === "en" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

export default function AddPetForm({
  onAddPet,
}: AddPetFormProps) {
  const t = useTranslations("AddPetForm");
  const locale = useLocale();

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

  const dateError =
    birthDate !== "" &&
    (birthDate > todayISO() || birthDate < minBirthISO());

  function handleBreedChange(value: string) {
    setBreed(value);
    if (value !== "Otro") {
      setCustomBreed("");
    }
  }

  function handlePhotoChange(file: File | null) {
    setPhotoError("");

    if (!file) {
      setPhoto(null);
      return;
    }

    const type = file.type.toLowerCase();
    const isAllowed = ALLOWED_PHOTO_TYPES.includes(type);

    if (!isAllowed) {
      setPhoto(null);
      setPhotoError(t("photoTypeError"));
      return;
    }

    setPhoto(file);
  }

  async function handleSave() {
    const finalBreed =
      breed === "Otro" ? customBreed.trim() : breed;

    if (!name.trim() || !finalBreed || !birthDate) {
      alert(t("alertRequiredFields"));
      return;
    }

    if (breed === "Otro" && !customBreed.trim()) {
      alert(t("alertCustomBreed"));
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
      alert(t("alertNoUser"));
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
        alert(t("alertPhotoUploadError"));
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
      alert(t("alertSaveError"));
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

  const breedOptions = BREEDS.includes("Otro")
    ? BREEDS
    : [...BREEDS, "Otro"];

  return (
    <div>
      <label className="mb-2 block font-semibold">
        {t("nameLabel")}
      </label>

      <input
        className="mb-4 w-full rounded-lg border p-3"
        placeholder={t("namePlaceholder")}
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
      />

      <label className="mb-2 block font-semibold">
        {t("breedLabel")}
      </label>

      <div className="mb-4">
        <SearchableSelect
          options={breedOptions}
          value={breed}
          onChange={handleBreedChange}
          placeholder={t("breedPlaceholder")}
          renderLabel={(option) => getBreedLabel(option, locale)}
        />
      </div>

      {breed === "Otro" && (
        <div className="mb-4">
          <label className="mb-2 block font-semibold">
            {t("customBreedLabel")}
          </label>
          <input
            className="w-full rounded-lg border p-3"
            placeholder={t("customBreedPlaceholder")}
            value={customBreed}
            onChange={(e) =>
              setCustomBreed(e.target.value)
            }
          />
        </div>
      )}

      <label className="mb-2 block font-semibold">
        {t("photoLabel")}
      </label>

      <label
        htmlFor="pet-photo-input"
        className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        📷 {photo ? t("changePhoto") : t("selectPhoto")}
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
          {t("photoFile", { name: photo.name })}
        </p>
      )}

      {photoError && (
        <div className="mb-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          ⚠️ {photoError}
        </div>
      )}

      <p className="mb-4 text-sm text-slate-500">
        {t("photoFormats")}
      </p>

      <label className="mb-2 block font-semibold">
        {t("sexLabel")}
      </label>

      <select
        className="mb-4 w-full rounded-lg border bg-white p-3"
        value={sex}
        onChange={(e) => setSex(e.target.value)}
      >
        <option value="">
          {t("selectSex")}
        </option>
        <option value="Macho">{t("male")}</option>
        <option value="Hembra">{t("female")}</option>
      </select>

      <label className="mb-2 block font-semibold">
        {t("weightLabel")}
      </label>

      <div className="mb-4">
        <SearchableSelect
          options={WEIGHTS}
          value={weight}
          onChange={setWeight}
          placeholder={t("selectWeight")}
          renderLabel={(item) => `${item} kg`}
        />
      </div>

      <label className="mb-2 block font-semibold">
        {t("colorLabel")}
      </label>

      <div className="mb-4">
        <SearchableSelect
          options={COLORS}
          value={color}
          onChange={setColor}
          placeholder={t("selectColor")}
          renderLabel={(option) => getColorLabel(option, locale)}
        />
      </div>

      <label className="mb-2 block font-semibold">
        {t("birthDateLabel")}
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
          {t("dateError", { min: formatDateForLocale(minBirthISO(), locale) })}
        </p>
      ) : (
        <p className="mb-6 text-sm text-slate-500">
          {t("ageAutoCalc")}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || dateError}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}