"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const ADMIN_USER_ID = "ee62d6fc-b3e8-42c9-898e-4f9f9148a347";

type Skill = {
  id: number;
  name: string;
  name_en: string | null;
  category: string | null;
  difficulty: string | null;
  description: string | null;
  description_en: string | null;
  user_id: string | null;
  steps_image: string | null;
  mistakes_image: string | null;
};

type PetSkillRow = {
  id: number;
  skill_id: number;
  manual_progress: number | null;
  auto_progress: number | null;
  is_goal: boolean;
  updated_at: string | null;
};

type Pet = {
  id: number;
  name: string;
  photo: string | null;
};

const DIFFICULTY_STYLES: Record<string, string> = {
  baja: "bg-green-100 text-green-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-red-100 text-red-800",
};

const CATEGORY_ICONS: Record<string, string> = {
  Posiciones: "🐕",
  Control: "🎯",
  Llamada: "📢",
  Paseo: "🚶",
  "Obediencia FCI": "🏆",
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  Posiciones: "Positions",
  Control: "Control",
  Llamada: "Recall",
  Paseo: "Heel",
  "Obediencia FCI": "FCI Obedience",
};

function getCategoryLabel(category: string, locale: string): string {
  if (locale === "en" && CATEGORY_LABELS_EN[category]) {
    return CATEGORY_LABELS_EN[category];
  }
  return category;
}

function getSkillName(skill: Skill, locale: string): string {
  return locale === "en" && skill.name_en ? skill.name_en : skill.name;
}

function getSkillDescription(skill: Skill, locale: string): string | null {
  if (locale === "en" && skill.description_en) return skill.description_en;
  return skill.description;
}

const KNOWN_CATEGORIES = [
  "Posiciones",
  "Control",
  "Llamada",
  "Paseo",
  "Obediencia FCI",
];

const ALL_CATEGORIES_VALUE = "__all__";

type ImageKind = "steps" | "mistakes";

export default function PetSkillsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const petId = Number(params.id);
  const t = useTranslations("PetSkills");
  const locale = useLocale();

  function getDifficultyLabel(difficulty: string): string {
    if (difficulty === "baja") return t("difficultyLow");
    if (difficulty === "media") return t("difficultyMedium");
    if (difficulty === "alta") return t("difficultyHigh");
    return difficulty;
  }

  const [pet, setPet] = useState<Pet | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_VALUE);
  const [savingSkillId, setSavingSkillId] = useState<number | null>(null);
  const [openInfoId, setOpenInfoId] = useState<number | null>(null);

  // Subida de imágenes: guarda "skillId-kind" mientras sube
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Crear habilidad
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(KNOWN_CATEGORIES[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select("id, name, photo")
        .eq("id", petId)
        .eq("user_id", user.id)
        .single();

      if (petError || !petData) {
        router.replace("/pets");
        return;
      }

      setPet(petData);

      const { data: skillsData } = await supabase
        .from("skills")
        .select(
          "id, name, name_en, category, difficulty, description, description_en, user_id, steps_image, mistakes_image"
        )
        .order("id", { ascending: true });

      setSkills(skillsData ?? []);

      const { data: petSkillsData } = await supabase
        .from("pet_skills")
        .select(
          "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
        )
        .eq("pet_id", petId);

      setPetSkills(petSkillsData ?? []);

      setLoading(false);
    }

    if (!Number.isNaN(petId)) {
      void loadData();
    }
  }, [petId, router]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    skills.forEach((skill) => {
      if (skill.category) unique.add(skill.category);
    });
    return [ALL_CATEGORIES_VALUE, ...Array.from(unique)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    if (activeCategory === ALL_CATEGORIES_VALUE) return skills;
    return skills.filter((skill) => skill.category === activeCategory);
  }, [skills, activeCategory]);

  function getProgressForSkill(skillId: number): number {
    const petSkill = petSkills.find((ps) => ps.skill_id === skillId);
    return petSkill?.auto_progress ?? 0;
  }

  function isSkillActive(skillId: number): boolean {
    return petSkills.some((ps) => ps.skill_id === skillId);
  }

  async function handleAddSkill(skillId: number) {
    setSavingSkillId(skillId);

    const { data, error } = await supabase
      .from("pet_skills")
      .insert({
        pet_id: petId,
        skill_id: skillId,
        manual_progress: 0,
        auto_progress: 0,
      })
      .select(
        "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
      )
      .single();

    if (error) {
      console.error("Error añadiendo habilidad:", error);
      setSavingSkillId(null);
      return;
    }

    if (data) {
      setPetSkills((prev) => [...prev, data]);
    }

    setSavingSkillId(null);
  }

  async function handleRemoveSkill(skillId: number) {
    setSavingSkillId(skillId);

    const { error } = await supabase
      .from("pet_skills")
      .delete()
      .eq("pet_id", petId)
      .eq("skill_id", skillId);

    if (error) {
      console.error("Error eliminando habilidad:", error);
      setSavingSkillId(null);
      return;
    }

    setPetSkills((prev) => prev.filter((ps) => ps.skill_id !== skillId));
    setSavingSkillId(null);
  }

  // Subir una imagen (pasos o errores) para una habilidad
  async function handleUploadImage(
    skill: Skill,
    kind: ImageKind,
    file: File
  ) {
    const key = `${skill.id}-${kind}`;
    setUploadingKey(key);

    try {
      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `skill-${skill.id}/${kind}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("skill-images")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error("Error subiendo imagen:", uploadError);
        alert(t("alertUploadFailed"));
        setUploadingKey(null);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("skill-images")
        .getPublicUrl(path);

      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from("skills")
        .update(
          kind === "steps"
            ? { steps_image: publicUrl }
            : { mistakes_image: publicUrl }
        )
        .eq("id", skill.id);

      if (updateError) {
        console.error("Error guardando enlace de imagen:", updateError);
        alert(t("alertUploadSavedFailed"));
        setUploadingKey(null);
        return;
      }

      // Actualizar en pantalla sin recargar
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id
            ? {
                ...s,
                steps_image:
                  kind === "steps" ? publicUrl : s.steps_image,
                mistakes_image:
                  kind === "mistakes" ? publicUrl : s.mistakes_image,
              }
            : s
        )
      );
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleCreateSkill() {
    setCreateError(null);

    const trimmedName = newName.trim();

    if (!trimmedName) {
      setCreateError(t("errorEmptyName"));
      return;
    }

    if (!currentUserId) {
      setCreateError(t("errorNoUser"));
      return;
    }

    const alreadyExists = skills.some(
      (s) =>
        s.user_id === currentUserId &&
        s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (alreadyExists) {
      setCreateError(t("errorDuplicateName"));
      return;
    }

    setCreating(true);

    const { data: skillData, error: skillError } = await supabase
      .from("skills")
      .insert({
        name: trimmedName,
        category: newCategory,
        user_id: currentUserId,
      })
      .select(
        "id, name, name_en, category, difficulty, description, description_en, user_id, steps_image, mistakes_image"
      )
      .single();

    if (skillError || !skillData) {
      console.error("Error creando habilidad:", skillError);
      setCreateError(t("errorCreateFailed"));
      setCreating(false);
      return;
    }

    const { data: petSkillData, error: petSkillError } = await supabase
      .from("pet_skills")
      .insert({
        pet_id: petId,
        skill_id: skillData.id,
        manual_progress: 0,
        auto_progress: 0,
      })
      .select(
        "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
      )
      .single();

    if (petSkillError) {
      console.error("Error añadiendo habilidad al perro:", petSkillError);
    }

    setSkills((prev) => [...prev, skillData]);
    if (petSkillData) {
      setPetSkills((prev) => [...prev, petSkillData]);
    }

    setNewName("");
    setNewCategory(KNOWN_CATEGORIES[0]);
    setCreateOpen(false);
    setCreating(false);
  }

  const activeSkillsCount = petSkills.length;

  const averageProgress =
    petSkills.length === 0
      ? 0
      : Math.round(
          petSkills.reduce(
            (sum, ps) => sum + (ps.auto_progress ?? 0),
            0
          ) / petSkills.length
        );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">{t("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/pets/${petId}`}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("backToPet")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setCreateError(null);
            }}
            className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
          >
            {t("createSkillButton")}
          </button>
        </div>

        <header className="mb-8 flex flex-col gap-6 rounded-3xl bg-white p-8 shadow md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {pet?.photo ? (
              <img
                src={pet.photo}
                alt={pet.name}
                className="h-20 w-20 rounded-full border-4 border-slate-100 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
                🐶
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                {t("skillsOf")}
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight">
                {pet?.name}
              </h1>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="rounded-2xl bg-slate-100 px-6 py-4 text-center">
              <p className="text-3xl font-bold">{activeSkillsCount}</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {t("active")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-6 py-4 text-center">
              <p className="text-3xl font-bold">{averageProgress}%</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {t("average")}
              </p>
            </div>
          </div>
        </header>

        {/* FILTROS DE CATEGORÍA */}
        {skills.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            {categories.map((category) => {
              const isActive = category === activeCategory;
              const label =
                category === ALL_CATEGORIES_VALUE
                  ? t("allCategories")
                  : getCategoryLabel(category, locale);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={
                    isActive
                      ? "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                      : "rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  }
                >
                  {category !== ALL_CATEGORIES_VALUE && CATEGORY_ICONS[category]
                    ? `${CATEGORY_ICONS[category]} `
                    : ""}
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* LISTA DE HABILIDADES */}
        {skills.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <div className="text-5xl">📚</div>
            <h3 className="mt-4 text-2xl font-bold">
              {t("noSkillsAvailableTitle")}
            </h3>
            <p className="mt-2 text-slate-500">
              {t("noSkillsAvailableBody")}
            </p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <p className="text-slate-500">
              {t("noSkillsInCategory")}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredSkills.map((skill) => {
              const difficulty = skill.difficulty ?? "baja";
              const difficultyStyle =
                DIFFICULTY_STYLES[difficulty] ??
                "bg-slate-100 text-slate-700";
              const icon = skill.category
                ? CATEGORY_ICONS[skill.category] ?? "🐾"
                : "🐾";
              const isActive = isSkillActive(skill.id);
              const progress = getProgressForSkill(skill.id);
              const isSaving = savingSkillId === skill.id;
              const isInfoOpen = openInfoId === skill.id;
              const isMine = skill.user_id !== null;

              return (
                <div
                  key={skill.id}
                  className={`flex flex-col rounded-2xl bg-white p-6 shadow transition ${
                    isActive ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <div>
                        <h2 className="text-xl font-bold">
                          {getSkillName(skill, locale)}
                          {isMine && (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 align-middle">
                              {t("mine")}
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {skill.category
                            ? getCategoryLabel(skill.category, locale)
                            : t("noCategory")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenInfoId(isInfoOpen ? null : skill.id)
                        }
                        aria-label={t("moreInfo")}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                          isInfoOpen
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        ℹ
                      </button>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${difficultyStyle}`}
                      >
                        {getDifficultyLabel(difficulty)}
                      </span>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="mt-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600">
                          {t("progressLabel")}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {progress}%
                        </span>
                      </div>

                      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <p className="mb-4 text-xs font-medium text-slate-400">
                        {t("progressAutoNote")}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        disabled={isSaving}
                        className="w-full rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                      >
                        {isSaving ? t("saving") : t("removeSkill")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddSkill(skill.id)}
                      disabled={isSaving}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? t("adding") : t("addToMyPet")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL DE INFORMACIÓN DE HABILIDAD */}
      {(() => {
        const infoSkill = skills.find((s) => s.id === openInfoId);
        if (!infoSkill) return null;

        const icon = infoSkill.category
          ? CATEGORY_ICONS[infoSkill.category] ?? "🐾"
          : "🐾";

        const canEditImages =
          currentUserId === ADMIN_USER_ID ||
          (infoSkill.user_id !== null &&
            infoSkill.user_id === currentUserId);

        const stepsUploading = uploadingKey === `${infoSkill.id}-steps`;
        const mistakesUploading =
          uploadingKey === `${infoSkill.id}-mistakes`;

        const description = getSkillDescription(infoSkill, locale);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setOpenInfoId(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del modal */}
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{icon}</span>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {getSkillName(infoSkill, locale)}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {infoSkill.category
                        ? getCategoryLabel(infoSkill.category, locale)
                        : t("noCategory")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenInfoId(null)}
                  aria-label={t("close")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              {description && (
                <p className="mb-6 text-slate-700">
                  {description}
                </p>
              )}

              {/* Imagen de pasos */}
              <div className="mb-8">
                <p className="mb-3 text-lg font-bold text-slate-800">
                  {t("howToTrainTitle")}
                </p>
                {infoSkill.steps_image ? (
                  <img
                    src={infoSkill.steps_image}
                    alt={getSkillName(infoSkill, locale)}
                    className="w-full rounded-xl border border-slate-200"
                  />
                ) : (
                  <p className="text-sm italic text-slate-400">
                    {t("noStepsImage")}
                  </p>
                )}

                {canEditImages && (
                  <label className="mt-3 inline-block cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                    {stepsUploading
                      ? t("uploading")
                      : infoSkill.steps_image
                      ? t("replaceImage")
                      : t("uploadImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={stepsUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleUploadImage(infoSkill, "steps", file);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Imagen de errores comunes */}
              <div>
                <p className="mb-3 text-lg font-bold text-slate-800">
                  {t("commonMistakesTitle")}
                </p>
                {infoSkill.mistakes_image ? (
                  <img
                    src={infoSkill.mistakes_image}
                    alt={getSkillName(infoSkill, locale)}
                    className="w-full rounded-xl border border-slate-200"
                  />
                ) : (
                  <p className="text-sm italic text-slate-400">
                    {t("noMistakesImage")}
                  </p>
                )}

                {canEditImages && (
                  <label className="mt-3 inline-block cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                    {mistakesUploading
                      ? t("uploading")
                      : infoSkill.mistakes_image
                      ? t("replaceImage")
                      : t("uploadImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={mistakesUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleUploadImage(
                            infoSkill,
                            "mistakes",
                            file
                          );
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CREAR HABILIDAD */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h3 className="mb-2 text-2xl font-bold">{t("createSkillTitle")}</h3>
            <p className="mb-6 text-slate-500">
              {t("createSkillSubtitle", { name: pet?.name ?? "" })}
            </p>

            {createError && (
              <div className="mb-4 rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
                {createError}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block font-semibold">{t("nameLabel")}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={creating}
                placeholder={t("namePlaceholder")}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block font-semibold">{t("categoryLabel")}</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                disabled={creating}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                {KNOWN_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCreateSkill}
                disabled={creating}
                className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? t("creatingButton") : t("createButton")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateError(null);
                }}
                disabled={creating}
                className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}