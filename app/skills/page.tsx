"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import ImageLightbox from "@/components/ImageLightbox";
import PetGroupsManager from "@/components/PetGroupsManager";
import TrainingOrderTab from "@/components/TrainingOrderTab";

const supabase = createClient();
const ADMIN_USER_ID = "ee62d6fc-b3e8-42c9-898e-4f9f9148a347";

const SKILL_COLUMNS =
  "id, name, name_en, category, difficulty, description, description_en, user_id, steps_image, mistakes_image, steps_image_en, mistakes_image_en, video_url, video_url_en";

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
  steps_image_en: string | null;
  mistakes_image_en: string | null;
  video_url: string | null;
  video_url_en: string | null;
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

const ORDER_TAB_LABEL: Record<"es" | "en", string> = {
  es: "Orden recomendado",
  en: "Recommended order",
};

type ViewerText = {
  previous: string;
  next: string;
  tapToEnlarge: string;
  rotateHint: string;
  closeImage: string;
  videoTitle: string;
  noVideo: string;
  videoPlaceholder: string;
  saveVideo: string;
  replaceVideo: string;
  savingVideo: string;
  removeVideo: string;
  confirmRemoveVideo: string;
  invalidVideo: string;
  videoSaveError: string;
  videoLanguageNote: string;
};

const VIEWER_TEXT: Record<"es" | "en", ViewerText> = {
  es: {
    previous: "← Anterior",
    next: "Siguiente →",
    tapToEnlarge: "🔍 Toca la viñeta para verla en grande",
    rotateHint: "📱 Gira el móvil para verla mejor",
    closeImage: "Cerrar imagen",
    videoTitle: "🎬 Vídeo: cómo enseñarla",
    noVideo: "Todavía no hay vídeo para esta habilidad en español.",
    videoPlaceholder: "Pega aquí el enlace de YouTube",
    saveVideo: "Guardar vídeo",
    replaceVideo: "Cambiar vídeo",
    savingVideo: "Guardando…",
    removeVideo: "Quitar vídeo",
    confirmRemoveVideo: "¿Quitar el vídeo en español de esta habilidad?",
    invalidVideo: "El enlace no es de YouTube o no es válido.",
    videoSaveError: "No se pudo guardar el vídeo. Inténtalo de nuevo.",
    videoLanguageNote: "Se guarda para el idioma actual: español.",
  },
  en: {
    previous: "← Previous",
    next: "Next →",
    tapToEnlarge: "🔍 Tap the image to view it full size",
    rotateHint: "📱 Turn your phone to see it better",
    closeImage: "Close image",
    videoTitle: "🎬 Video: how to teach it",
    noVideo: "There is no English video for this skill yet.",
    videoPlaceholder: "Paste the YouTube link here",
    saveVideo: "Save video",
    replaceVideo: "Change video",
    savingVideo: "Saving…",
    removeVideo: "Remove video",
    confirmRemoveVideo: "Remove the English video from this skill?",
    invalidVideo: "The link is not a valid YouTube link.",
    videoSaveError: "The video could not be saved. Please try again.",
    videoLanguageNote: "It is saved for the current language: English.",
  },
};

const SWIPE_THRESHOLD = 50;

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

function getStepsImage(skill: Skill, locale: string): string | null {
  return locale === "en" ? skill.steps_image_en : skill.steps_image;
}

function getMistakesImage(skill: Skill, locale: string): string | null {
  return locale === "en" ? skill.mistakes_image_en : skill.mistakes_image;
}

function getVideoUrl(skill: Skill, locale: string): string | null {
  return locale === "en" ? skill.video_url_en : skill.video_url;
}

function getYouTubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else {
        const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        id = match ? match[2] : null;
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const KNOWN_CATEGORIES = [
  "Posiciones",
  "Control",
  "Llamada",
  "Paseo",
  "Obediencia FCI",
];

const ALL_CATEGORIES_VALUE = "__all__";

const PET_QUERY_PARAM = "pet";
const SKILL_QUERY_PARAM = "skill";
const TAB_QUERY_PARAM = "tab";
const GROUPS_TAB_VALUE = "groups";
const ORDER_TAB_VALUE = "order";

type Tab = "skills" | "groups" | "order";

type ImageKind = "steps" | "mistakes";

type Slide =
  | {
      kind: "video";
      title: string;
      videoId: string | null;
      emptyText: string;
    }
  | {
      kind: ImageKind;
      title: string;
      image: string | null;
      emptyText: string;
    };

type ZoomedImage = { src: string; alt: string };

export default function SkillsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("PetSkills");
  const tPet = useTranslations("PetProfile");
  const locale = useLocale();
  const viewerText = VIEWER_TEXT[locale === "en" ? "en" : "es"];
  const orderTabLabel = ORDER_TAB_LABEL[locale === "en" ? "en" : "es"];

  // Perro elegido en la dirección (?pet=ID). null = "Todas".
  const petParam = searchParams.get(PET_QUERY_PARAM);
  const parsedPetId = petParam ? Number(petParam) : null;
  const selectedPetId =
    parsedPetId !== null && !Number.isNaN(parsedPetId) ? parsedPetId : null;

  const tabParam = searchParams.get(TAB_QUERY_PARAM);
  const activeTab: Tab =
    selectedPetId !== null && tabParam === GROUPS_TAB_VALUE
      ? "groups"
      : selectedPetId !== null && tabParam === ORDER_TAB_VALUE
      ? "order"
      : "skills";

  const requestedSkillParam = searchParams.get(SKILL_QUERY_PARAM);

  function getDifficultyLabel(difficulty: string): string {
    if (difficulty === "baja") return t("difficultyLow");
    if (difficulty === "media") return t("difficultyMedium");
    if (difficulty === "alta") return t("difficultyHigh");
    return difficulty;
  }

  const [pets, setPets] = useState<Pet[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPetSkills, setLoadingPetSkills] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_VALUE);
  const [savingSkillId, setSavingSkillId] = useState<number | null>(null);
  const [openInfoId, setOpenInfoId] = useState<number | null>(null);

  const [slideIndex, setSlideIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const handledSkillParam = useRef<string | null>(null);

  const [zoomedImage, setZoomedImage] = useState<ZoomedImage | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState("");
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(KNOWN_CATEGORIES[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function openSkillInfo(skillId: number) {
    setOpenInfoId(skillId);
    setSlideIndex(0);
    setZoomedImage(null);
    setVideoInput("");
    setVideoError(null);
  }

  function closeSkillInfo() {
    setOpenInfoId(null);
    setZoomedImage(null);
    setVideoInput("");
    setVideoError(null);
  }

  // Cambia la dirección sin recargar la página
  const buildUrl = useCallback(
    (overrides: { pet?: number | null; tab?: Tab; skill?: number | null }) => {
      const url = new URL(window.location.href);

      if ("pet" in overrides) {
        if (overrides.pet !== null && overrides.pet !== undefined) {
          url.searchParams.set(PET_QUERY_PARAM, String(overrides.pet));
        } else {
          url.searchParams.delete(PET_QUERY_PARAM);
        }
      }

      if ("tab" in overrides) {
        if (overrides.tab === "groups") {
          url.searchParams.set(TAB_QUERY_PARAM, GROUPS_TAB_VALUE);
        } else if (overrides.tab === "order") {
          url.searchParams.set(TAB_QUERY_PARAM, ORDER_TAB_VALUE);
        } else {
          url.searchParams.delete(TAB_QUERY_PARAM);
        }
      }

      if ("skill" in overrides) {
        if (overrides.skill !== null && overrides.skill !== undefined) {
          url.searchParams.set(SKILL_QUERY_PARAM, String(overrides.skill));
        } else {
          url.searchParams.delete(SKILL_QUERY_PARAM);
        }
      }

      return `${url.pathname}${url.search}`;
    },
    []
  );

  function selectPet(petId: number | null) {
    router.replace(
      buildUrl({ pet: petId, tab: "skills", skill: null }),
      { scroll: false }
    );
  }

  function changeTab(tab: Tab) {
    router.replace(
      buildUrl({ tab, skill: null }),
      { scroll: false }
    );
  }

  // Carga inicial: usuario, perros y catálogo de habilidades
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

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, name, photo")
        .eq("user_id", user.id)
        .order("id", { ascending: true });

      setPets(petsData ?? []);

      const { data: skillsData } = await supabase
        .from("skills")
        .select(SKILL_COLUMNS)
        .order("id", { ascending: true });

      setSkills(skillsData ?? []);

      setLoading(false);
    }

    void loadData();
  }, [router]);

  // Cada vez que cambia el perro elegido, carga sus habilidades
  useEffect(() => {
    if (loading) return;

    if (selectedPetId === null) {
      setPetSkills([]);
      return;
    }

    let cancelled = false;

    async function loadPetSkills() {
      setLoadingPetSkills(true);

      const { data } = await supabase
        .from("pet_skills")
        .select(
          "id, skill_id, manual_progress, auto_progress, is_goal, updated_at"
        )
        .eq("pet_id", selectedPetId!);

      if (!cancelled) {
        setPetSkills(data ?? []);
        setLoadingPetSkills(false);
      }
    }

    void loadPetSkills();

    return () => {
      cancelled = true;
    };
  }, [selectedPetId, loading]);

  // Si la dirección pide una habilidad (?skill=ID), se abre
  useEffect(() => {
    if (loading) return;

    if (requestedSkillParam === null) {
      handledSkillParam.current = null;
      return;
    }

    if (handledSkillParam.current === requestedSkillParam) return;
    handledSkillParam.current = requestedSkillParam;

    const requestedSkillId = Number(requestedSkillParam);

    if (skills.some((skill) => skill.id === requestedSkillId)) {
      setOpenInfoId(requestedSkillId);
      setSlideIndex(0);
      setZoomedImage(null);
      setVideoInput("");
      setVideoError(null);
    }
  }, [requestedSkillParam, loading, skills]);

  const selectedPet = useMemo(
    () => pets.find((p) => p.id === selectedPetId) ?? null,
    [pets, selectedPetId]
  );

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
    if (selectedPetId === null) return;
    setSavingSkillId(skillId);

    const { data, error } = await supabase
      .from("pet_skills")
      .insert({
        pet_id: selectedPetId,
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
    if (selectedPetId === null) return;
    setSavingSkillId(skillId);

    const { error } = await supabase
      .from("pet_skills")
      .delete()
      .eq("pet_id", selectedPetId)
      .eq("skill_id", skillId);

    if (error) {
      console.error("Error eliminando habilidad:", error);
      setSavingSkillId(null);
      return;
    }

    setPetSkills((prev) => prev.filter((ps) => ps.skill_id !== skillId));
    setSavingSkillId(null);
  }

  async function handleUploadImage(
    skill: Skill,
    kind: ImageKind,
    file: File,
    uploadLocale: string
  ) {
    const key = `${skill.id}-${kind}`;
    setUploadingKey(key);

    try {
      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `skill-${skill.id}/${kind}-${uploadLocale}-${Date.now()}.${extension}`;

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

      const isEnglish = uploadLocale === "en";

      const updatePayload =
        kind === "steps"
          ? isEnglish
            ? { steps_image_en: publicUrl }
            : { steps_image: publicUrl }
          : isEnglish
          ? { mistakes_image_en: publicUrl }
          : { mistakes_image: publicUrl };

      const { error: updateError } = await supabase
        .from("skills")
        .update(updatePayload)
        .eq("id", skill.id);

      if (updateError) {
        console.error("Error guardando enlace de imagen:", updateError);
        alert(t("alertUploadSavedFailed"));
        setUploadingKey(null);
        return;
      }

      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id ? { ...s, ...updatePayload } : s
        )
      );
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleSaveVideo(skill: Skill, rawUrl: string | null) {
    setVideoError(null);

    let value: string | null = null;

    if (rawUrl !== null) {
      const videoId = getYouTubeId(rawUrl);

      if (!videoId) {
        setVideoError(viewerText.invalidVideo);
        return;
      }

      value = `https://www.youtube.com/watch?v=${videoId}`;
    }

    setSavingVideo(true);

    const updatePayload =
      locale === "en" ? { video_url_en: value } : { video_url: value };

    const { error } = await supabase
      .from("skills")
      .update(updatePayload)
      .eq("id", skill.id);

    setSavingVideo(false);

    if (error) {
      console.error("Error guardando el vídeo:", error);
      setVideoError(viewerText.videoSaveError);
      return;
    }

    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, ...updatePayload } : s))
    );
    setVideoInput("");
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
      .select(SKILL_COLUMNS)
      .single();

    if (skillError || !skillData) {
      console.error("Error creando habilidad:", skillError);
      setCreateError(t("errorCreateFailed"));
      setCreating(false);
      return;
    }

    // Si hay un perro seleccionado, añade la habilidad a ese perro
    if (selectedPetId !== null) {
      const { data: petSkillData, error: petSkillError } = await supabase
        .from("pet_skills")
        .insert({
          pet_id: selectedPetId,
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

      if (petSkillData) {
        setPetSkills((prev) => [...prev, petSkillData]);
      }
    }

    setSkills((prev) => [...prev, skillData]);
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

  const hasPet = selectedPetId !== null && selectedPet !== null;

  return (
    <main
      data-tour-section={loadingPetSkills ? undefined : activeTab === "groups" ? "skill-groups" : activeTab === "order" ? "skill-order" : "skills"}
      className="min-h-screen bg-slate-100 p-6 md:p-10"
    >
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {locale === "en" ? "← Dashboard" : "← Panel"}
          </Link>
          {activeTab === "skills" && (
            <button
              type="button"
              data-tour="skill-create"
              onClick={() => {
                setCreateOpen(true);
                setCreateError(null);
              }}
              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              {t("createSkillButton")}
            </button>
          )}
        </div>

        {/* SELECTOR DE PERRO: fila de fotos redondas */}
        <div className="mb-6 flex gap-4 overflow-x-auto p-3">
          {/* "Todas" */}
          <button
            type="button"
            onClick={() => selectPet(null)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl transition ${
                selectedPetId === null
                  ? "ring-4 ring-blue-500 bg-blue-100"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              📚
            </div>
            <span
              className={`text-xs font-semibold ${
                selectedPetId === null ? "text-blue-600" : "text-slate-500"
              }`}
            >
              {locale === "en" ? "All" : "Todas"}
            </span>
          </button>

          {pets.map((pet) => {
            const isSelected = selectedPetId === pet.id;
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => selectPet(pet.id)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                {pet.photo ? (
                  <img
                    src={pet.photo}
                    alt={pet.name}
                    className={`h-16 w-16 rounded-full object-cover transition ${
                      isSelected
                        ? "ring-4 ring-blue-500"
                        : "ring-2 ring-slate-200 hover:ring-slate-300"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl transition ${
                      isSelected
                        ? "ring-4 ring-blue-500 bg-blue-100"
                        : "bg-slate-100 ring-2 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    🐶
                  </div>
                )}
                <span
                  className={`max-w-[4.5rem] truncate text-xs font-semibold ${
                    isSelected ? "text-blue-600" : "text-slate-500"
                  }`}
                >
                  {pet.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* CABECERA CON DATOS DEL PERRO (solo si hay uno elegido) */}
        {hasPet && (
          <header className="mb-6 flex flex-col gap-6 rounded-3xl bg-white p-8 shadow md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              {selectedPet.photo ? (
                <img
                  src={selectedPet.photo}
                  alt={selectedPet.name}
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
                  {selectedPet.name}
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
        )}

        {/* CABECERA SIN PERRO ("Todas") */}
        {!hasPet && (
          <header className="mb-6 rounded-3xl bg-white p-8 shadow">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-4xl">
                📚
              </div>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">
                  {locale === "en" ? "All skills" : "Todas las habilidades"}
                </h1>
                <p className="mt-1 text-slate-500">
                  {locale === "en"
                    ? "Select a dog above to see its progress"
                    : "Elige un perro arriba para ver su progreso"}
                </p>
              </div>
            </div>
          </header>
        )}

        {/* CARGANDO HABILIDADES DEL PERRO */}
        {loadingPetSkills && (
          <div className="mb-6 rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-slate-500">{t("loading")}</p>
          </div>
        )}

        {/* PESTAÑAS (solo con perro elegido) */}
        {hasPet && !loadingPetSkills && (
          <div
            data-tour="skills-tabs"
            role="tablist"
            className="mb-8 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "skills"}
              onClick={() => changeTab("skills")}
              className={`rounded-xl px-2 py-3 text-sm font-semibold transition sm:px-4 sm:text-base ${
                activeTab === "skills"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tPet("skills")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "groups"}
              onClick={() => changeTab("groups")}
              className={`rounded-xl px-2 py-3 text-sm font-semibold transition sm:px-4 sm:text-base ${
                activeTab === "groups"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tPet("skillGroups")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "order"}
              onClick={() => changeTab("order")}
              className={`rounded-xl px-2 py-3 text-sm font-semibold transition sm:px-4 sm:text-base ${
                activeTab === "order"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {orderTabLabel}
            </button>
          </div>
        )}

        {/* PESTAÑA DE GRUPOS */}
        {hasPet && activeTab === "groups" ? (
          <PetGroupsManager petId={selectedPetId!} />
        ) : hasPet && activeTab === "order" ? (
          <TrainingOrderTab petId={selectedPetId!} petName={selectedPet!.name} />
        ) : (
          <>
            {/* FILTROS DE CATEGORÍA */}
            {skills.length > 0 && (
              <div data-tour="skills-filters" className="mb-8 flex flex-wrap gap-3">
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
                {filteredSkills.map((skill, skillIndex) => {
                  const difficulty = skill.difficulty ?? "baja";
                  const difficultyStyle =
                    DIFFICULTY_STYLES[difficulty] ??
                    "bg-slate-100 text-slate-700";
                  const icon = skill.category
                    ? CATEGORY_ICONS[skill.category] ?? "🐾"
                    : "🐾";
                  const isActive = hasPet && isSkillActive(skill.id);
                  const progress = hasPet ? getProgressForSkill(skill.id) : 0;
                  const isSaving = savingSkillId === skill.id;
                  const isInfoOpen = openInfoId === skill.id;
                  const isMine = skill.user_id !== null;

                  return (
                    <div
                      key={skill.id}
                      data-tour={skillIndex === 0 ? "skill-card" : undefined}
                      onClick={() => openSkillInfo(skill.id)}
                      className={`flex cursor-pointer flex-col rounded-2xl bg-white p-6 shadow transition hover:shadow-md hover:bg-slate-50 active:scale-[0.99] ${
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
                            onClick={(e) => {
                              e.stopPropagation();
                              openSkillInfo(skill.id);
                            }}
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

                      {/* Con perro elegido: progreso y añadir/quitar */}
                      {hasPet && isActive ? (
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
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRemoveSkill(skill.id);
                            }}
                            disabled={isSaving}
                            className="w-full rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                          >
                            {isSaving ? t("saving") : t("removeSkill")}
                          </button>
                        </div>
                      ) : hasPet && !isActive ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAddSkill(skill.id);
                          }}
                          disabled={isSaving}
                          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSaving ? t("adding") : t("addToMyPet")}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* VENTANA DE INFORMACIÓN DE HABILIDAD */}
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

        const skillName = getSkillName(infoSkill, locale);
        const description = getSkillDescription(infoSkill, locale);

        const videoUrl = getVideoUrl(infoSkill, locale);
        const videoId = videoUrl ? getYouTubeId(videoUrl) : null;

        const slides: Slide[] = [];

        if (videoId || canEditImages) {
          slides.push({
            kind: "video",
            title: viewerText.videoTitle,
            videoId,
            emptyText: viewerText.noVideo,
          });
        }

        slides.push(
          {
            kind: "steps",
            title: t("howToTrainTitle"),
            image: getStepsImage(infoSkill, locale),
            emptyText: t("noStepsImage"),
          },
          {
            kind: "mistakes",
            title: t("commonMistakesTitle"),
            image: getMistakesImage(infoSkill, locale),
            emptyText: t("noMistakesImage"),
          }
        );

        const currentIndex = Math.min(slideIndex, slides.length - 1);
        const slide = slides[currentIndex];
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === slides.length - 1;

        const goPrevious = () => {
          if (!isFirst) setSlideIndex(currentIndex - 1);
        };

        const goNext = () => {
          if (!isLast) setSlideIndex(currentIndex + 1);
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 sm:p-4"
            onClick={closeSkillInfo}
          >
            <div
              className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[95vh] sm:max-w-4xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold leading-tight sm:text-2xl">
                      {skillName}
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
                  onClick={closeSkillInfo}
                  aria-label={t("close")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              {/* Contenido */}
              <div
                className="flex-1 overflow-y-auto px-2 py-3 sm:px-6 sm:py-5"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  const start = touchStartX.current;
                  touchStartX.current = null;
                  const end = e.changedTouches[0]?.clientX;
                  if (start === null || end === undefined) return;
                  const distance = end - start;
                  if (distance <= -SWIPE_THRESHOLD) goNext();
                  if (distance >= SWIPE_THRESHOLD) goPrevious();
                }}
              >
                {description && currentIndex === 0 && (
                  <p className="mb-4 px-2 text-slate-700 sm:px-0">
                    {description}
                  </p>
                )}

                <div className="mb-3 flex items-center justify-between gap-3 px-2 sm:px-0">
                  <p className="text-lg font-bold text-slate-800">
                    {slide.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    {currentIndex + 1} / {slides.length}
                  </span>
                </div>

                {slide.kind === "video" ? (
                  <>
                    {slide.videoId ? (
                      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                        <iframe
                          key={slide.videoId}
                          src={`https://www.youtube-nocookie.com/embed/${slide.videoId}?rel=0&modestbranding=1&playsinline=1`}
                          title={`${skillName} — ${slide.title}`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <p className="px-2 py-10 text-center text-sm italic text-slate-400 sm:px-0">
                        {slide.emptyText}
                      </p>
                    )}

                    {canEditImages && (
                      <div className="mx-2 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:mx-0">
                        <p className="mb-2 text-xs font-semibold text-slate-500">
                          {viewerText.videoLanguageNote}
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="url"
                            value={videoInput}
                            onChange={(e) => setVideoInput(e.target.value)}
                            placeholder={viewerText.videoPlaceholder}
                            disabled={savingVideo}
                            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          />
                          <button
                            type="button"
                            disabled={savingVideo || videoInput.trim() === ""}
                            onClick={() =>
                              void handleSaveVideo(infoSkill, videoInput)
                            }
                            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingVideo
                              ? viewerText.savingVideo
                              : slide.videoId
                              ? viewerText.replaceVideo
                              : viewerText.saveVideo}
                          </button>
                        </div>

                        {slide.videoId && (
                          <button
                            type="button"
                            disabled={savingVideo}
                            onClick={() => {
                              if (window.confirm(viewerText.confirmRemoveVideo)) {
                                void handleSaveVideo(infoSkill, null);
                              }
                            }}
                            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                          >
                            {viewerText.removeVideo}
                          </button>
                        )}

                        {videoError && (
                          <p className="mt-2 text-sm font-semibold text-red-600">
                            ⚠️ {videoError}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {slide.image ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (slide.image) {
                              setZoomedImage({
                                src: slide.image,
                                alt: `${skillName} — ${slide.title}`,
                              });
                            }
                          }}
                          aria-label={viewerText.tapToEnlarge}
                          className="block w-full cursor-zoom-in"
                        >
                          <img
                            key={slide.image}
                            src={slide.image}
                            alt={`${skillName} — ${slide.title}`}
                            className="h-auto w-full rounded-xl border border-slate-200 object-contain"
                          />
                        </button>
                        <p className="mt-2 text-center text-sm font-semibold text-blue-600">
                          {viewerText.tapToEnlarge}
                        </p>
                      </>
                    ) : (
                      <p className="px-2 py-10 text-center text-sm italic text-slate-400 sm:px-0">
                        {slide.emptyText}
                      </p>
                    )}

                    {canEditImages && (
                      <label className="mx-2 mt-3 inline-block cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 sm:mx-0">
                        {uploadingKey === `${infoSkill.id}-${slide.kind}`
                          ? t("uploading")
                          : slide.image
                          ? t("replaceImage")
                          : t("uploadImage")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingKey === `${infoSkill.id}-${slide.kind}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleUploadImage(
                                infoSkill,
                                slide.kind,
                                file,
                                locale
                              );
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>

              {/* Navegación entre diapositivas */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={isFirst}
                  className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:invisible"
                >
                  {viewerText.previous}
                </button>

                <div className="flex items-center gap-2" aria-hidden="true">
                  {slides.map((s, index) => (
                    <span
                      key={s.kind}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        index === currentIndex ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={isLast}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:invisible"
                >
                  {viewerText.next}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIÑETA A PANTALLA COMPLETA */}
      {zoomedImage && (
        <ImageLightbox
          src={zoomedImage.src}
          alt={zoomedImage.alt}
          onClose={() => setZoomedImage(null)}
          closeLabel={viewerText.closeImage}
          rotateHint={viewerText.rotateHint}
        />
      )}

      {/* MODAL CREAR HABILIDAD */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h3 className="mb-2 text-2xl font-bold">{t("createSkillTitle")}</h3>
            <p className="mb-6 text-slate-500">
              {hasPet
                ? t("createSkillSubtitle", { name: selectedPet!.name })
                : locale === "en"
                ? "The skill will be added to the catalog."
                : "La habilidad se añadirá al catálogo."}
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
