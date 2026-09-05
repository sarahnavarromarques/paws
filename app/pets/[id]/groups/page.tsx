"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  buildAvailableGroupNames,
  buildGroupSignature,
  type GroupSkillInput,
} from "@/lib/skill-group-names";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  category: string | null;
};

type Pet = {
  id: number;
  name: string;
  photo: string | null;
};

type GroupWithSkills = {
  id: number;
  name: string;
  skillIds: number[];
};

type OtherPet = {
  id: number;
  name: string;
};

type CopyableGroup = {
  id: number;
  name: string;
  skillIds: number[];
};

const CATEGORY_ICONS: Record<string, string> = {
  Posiciones: "🐕",
  Control: "🎯",
  Llamada: "📢",
  Paseo: "🚶",
  "Obediencia FCI": "🏆",
};

export default function PetGroupsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const petId = Number(params.id);

  const [pet, setPet] = useState<Pet | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [groups, setGroups] = useState<GroupWithSkills[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("Todas");

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [nameIndex, setNameIndex] = useState(0);
  const [namingOpen, setNamingOpen] = useState(false);
  const [namingMode, setNamingMode] = useState<"create" | "rename">("create");

  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Copiar grupo de otro perro
  const [copyOpen, setCopyOpen] = useState(false);
  const [otherPets, setOtherPets] = useState<OtherPet[]>([]);
  const [copyPetId, setCopyPetId] = useState<string>("");
  const [copyableGroups, setCopyableGroups] = useState<CopyableGroup[]>([]);
  const [loadingCopyGroups, setLoadingCopyGroups] = useState(false);
  const [copyingGroupId, setCopyingGroupId] = useState<number | null>(null);
  const [copyWarning, setCopyWarning] = useState<string | null>(null);

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
        .select("id, name, category")
        .order("id", { ascending: true });

      setSkills(skillsData ?? []);

      const { data: otherPetsData } = await supabase
        .from("pets")
        .select("id, name")
        .eq("user_id", user.id)
        .neq("id", petId)
        .order("name", { ascending: true });

      setOtherPets(otherPetsData ?? []);

      await loadGroups();

      setLoading(false);
    }

    async function loadGroups() {
      const { data: groupsData } = await supabase
        .from("skill_groups")
        .select("id, name")
        .eq("pet_id", petId)
        .order("created_at", { ascending: true });

      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = groupsData.map((g) => g.id);

      const { data: itemsData } = await supabase
        .from("skill_group_items")
        .select("group_id, skill_id")
        .in("group_id", groupIds);

      const combined: GroupWithSkills[] = groupsData.map((g) => ({
        id: g.id,
        name: g.name,
        skillIds:
          itemsData
            ?.filter((it) => it.group_id === g.id)
            .map((it) => it.skill_id) ?? [],
      }));

      setGroups(combined);
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
    return ["Todas", ...Array.from(unique)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    if (activeCategory === "Todas") return skills;
    return skills.filter((skill) => skill.category === activeCategory);
  }, [skills, activeCategory]);

  const editingGroup = useMemo(
    () => groups.find((g) => g.id === editingGroupId) ?? null,
    [groups, editingGroupId]
  );

  function toggleSkill(skillId: number) {
    setWarning(null);
    setSelectedIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  }

  function skillNameById(id: number): string {
    return skills.find((s) => s.id === id)?.name ?? "?";
  }

  function buildNameOptionsFor(
    ids: number[],
    excludeGroupId: number | null
  ): string[] {
    const selectedSkills: GroupSkillInput[] = ids.map((id) => {
      const s = skills.find((sk) => sk.id === id);
      return {
        id,
        name: s?.name ?? "",
        category: s?.category ?? null,
      };
    });

    const takenNames = groups
      .filter((g) => g.id !== excludeGroupId)
      .map((g) => g.name);

    return buildAvailableGroupNames(selectedSkills, takenNames);
  }

  function handleStartNaming() {
    setWarning(null);

    if (selectedIds.length === 0) {
      setWarning("Selecciona al menos una habilidad para crear un grupo.");
      return;
    }

    const newSignature = buildGroupSignature(selectedIds);
    const duplicateSet = groups.some(
      (g) => buildGroupSignature(g.skillIds) === newSignature
    );
    if (duplicateSet) {
      setWarning("Ya tienes un grupo con estas mismas habilidades creado");
      return;
    }

    setNameOptions(buildNameOptionsFor(selectedIds, null));
    setNameIndex(0);
    setNamingMode("create");
    setNamingOpen(true);
  }

  function handleNextName() {
    setNameIndex((prev) => (prev + 1) % nameOptions.length);
  }

  function handleCancelNaming() {
    setNamingOpen(false);
    setNameOptions([]);
    setNameIndex(0);
  }

  async function handleAcceptName() {
    if (nameOptions.length === 0) return;

    const chosenName = nameOptions[nameIndex];

    if (namingMode === "rename") {
      await renameGroup(chosenName);
      return;
    }

    setSaving(true);
    setWarning(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const signature = buildGroupSignature(selectedIds);

    const { data: groupData, error: groupError } = await supabase
      .from("skill_groups")
      .insert({
        pet_id: petId,
        user_id: user.id,
        name: chosenName,
        signature,
      })
      .select("id, name")
      .single();

    if (groupError || !groupData) {
      const message = groupError?.message ?? "";
      if (message.includes("skill_groups_pet_name_unique")) {
        setWarning("Ya tienes un grupo de habilidades con este nombre");
      } else if (message.includes("skill_groups_pet_signature_unique")) {
        setWarning("Ya tienes un grupo con estas mismas habilidades creado");
      } else {
        setWarning("No se pudo crear el grupo. Inténtalo de nuevo.");
        console.error("Error creando grupo:", groupError);
      }
      setSaving(false);
      return;
    }

    const items = selectedIds.map((skillId) => ({
      group_id: groupData.id,
      skill_id: skillId,
    }));

    const { error: itemsError } = await supabase
      .from("skill_group_items")
      .insert(items);

    if (itemsError) {
      console.error("Error añadiendo habilidades al grupo:", itemsError);
      setWarning("El grupo se creó pero hubo un problema con las habilidades.");
      setSaving(false);
      return;
    }

    setGroups((prev) => [
      ...prev,
      { id: groupData.id, name: groupData.name, skillIds: [...selectedIds] },
    ]);

    resetForm();
  }

  function handleStartEdit(group: GroupWithSkills) {
    setWarning(null);
    setEditingGroupId(group.id);
    setSelectedIds([...group.skillIds]);
    setActiveCategory("Todas");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleSaveEdit() {
    if (!editingGroupId) return;
    setWarning(null);

    if (selectedIds.length === 0) {
      setWarning("Selecciona al menos una habilidad.");
      return;
    }

    const newSignature = buildGroupSignature(selectedIds);
    const duplicateSet = groups.some(
      (g) =>
        g.id !== editingGroupId &&
        buildGroupSignature(g.skillIds) === newSignature
    );
    if (duplicateSet) {
      setWarning("Ya tienes un grupo con estas mismas habilidades creado");
      return;
    }

    setSaving(true);

    const { error: sigError } = await supabase
      .from("skill_groups")
      .update({ signature: newSignature })
      .eq("id", editingGroupId);

    if (sigError) {
      const message = sigError.message ?? "";
      if (message.includes("skill_groups_pet_signature_unique")) {
        setWarning("Ya tienes un grupo con estas mismas habilidades creado");
      } else {
        setWarning("No se pudieron guardar los cambios. Inténtalo de nuevo.");
        console.error("Error actualizando firma:", sigError);
      }
      setSaving(false);
      return;
    }

    const { error: delError } = await supabase
      .from("skill_group_items")
      .delete()
      .eq("group_id", editingGroupId);

    if (delError) {
      console.error("Error limpiando habilidades:", delError);
      setWarning("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }

    const items = selectedIds.map((skillId) => ({
      group_id: editingGroupId,
      skill_id: skillId,
    }));

    const { error: insError } = await supabase
      .from("skill_group_items")
      .insert(items);

    if (insError) {
      console.error("Error guardando habilidades:", insError);
      setWarning("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }

    setGroups((prev) =>
      prev.map((g) =>
        g.id === editingGroupId ? { ...g, skillIds: [...selectedIds] } : g
      )
    );

    resetForm();
  }

  function handleStartRename() {
    if (!editingGroupId) return;
    setWarning(null);

    if (selectedIds.length === 0) {
      setWarning("Selecciona al menos una habilidad.");
      return;
    }

    setNameOptions(buildNameOptionsFor(selectedIds, editingGroupId));
    setNameIndex(0);
    setNamingMode("rename");
    setNamingOpen(true);
  }

  async function renameGroup(chosenName: string) {
    if (!editingGroupId) return;
    setSaving(true);
    setWarning(null);

    const { error } = await supabase
      .from("skill_groups")
      .update({ name: chosenName })
      .eq("id", editingGroupId);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("skill_groups_pet_name_unique")) {
        setWarning("Ya tienes un grupo de habilidades con este nombre");
      } else {
        setWarning("No se pudo cambiar el nombre. Inténtalo de nuevo.");
        console.error("Error renombrando grupo:", error);
      }
      setSaving(false);
      return;
    }

    setGroups((prev) =>
      prev.map((g) =>
        g.id === editingGroupId ? { ...g, name: chosenName } : g
      )
    );

    setNamingOpen(false);
    setNameOptions([]);
    setNameIndex(0);
    setSaving(false);
  }

  async function handleDeleteGroup(groupId: number) {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar este grupo? Los entrenamientos ya creados no se verán afectados."
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("skill_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      console.error("Error eliminando grupo:", error);
      return;
    }

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (editingGroupId === groupId) resetForm();
  }

  function resetForm() {
    setSelectedIds([]);
    setEditingGroupId(null);
    setNamingOpen(false);
    setNameOptions([]);
    setNameIndex(0);
    setNamingMode("create");
    setSaving(false);
    setWarning(null);
  }

  // ---- COPIAR GRUPO DE OTRO PERRO ----

  function handleOpenCopy() {
    setCopyOpen(true);
    setCopyPetId("");
    setCopyableGroups([]);
    setCopyWarning(null);
  }

  function handleCloseCopy() {
    setCopyOpen(false);
    setCopyPetId("");
    setCopyableGroups([]);
    setCopyWarning(null);
    setCopyingGroupId(null);
  }

  async function handleSelectCopyPet(value: string) {
    setCopyPetId(value);
    setCopyableGroups([]);
    setCopyWarning(null);

    if (!value) return;

    setLoadingCopyGroups(true);

    const { data: groupsData } = await supabase
      .from("skill_groups")
      .select("id, name")
      .eq("pet_id", Number(value))
      .order("created_at", { ascending: true });

    if (!groupsData || groupsData.length === 0) {
      setCopyableGroups([]);
      setLoadingCopyGroups(false);
      return;
    }

    const groupIds = groupsData.map((g) => g.id);

    const { data: itemsData } = await supabase
      .from("skill_group_items")
      .select("group_id, skill_id")
      .in("group_id", groupIds);

    const combined: CopyableGroup[] = groupsData.map((g) => ({
      id: g.id,
      name: g.name,
      skillIds:
        itemsData
          ?.filter((it) => it.group_id === g.id)
          .map((it) => it.skill_id) ?? [],
    }));

    setCopyableGroups(combined);
    setLoadingCopyGroups(false);
  }

  async function handleCopyGroup(source: CopyableGroup) {
    setCopyWarning(null);

    const sourceSignature = buildGroupSignature(source.skillIds);
    const duplicateSet = groups.some(
      (g) => buildGroupSignature(g.skillIds) === sourceSignature
    );
    if (duplicateSet) {
      setCopyWarning("Ya tienes un grupo con estas mismas habilidades creado");
      return;
    }

    const existingNames = groups.map((g) => g.name.toLowerCase());
    let finalName = source.name;
    if (existingNames.includes(finalName.toLowerCase())) {
      let counter = 2;
      while (existingNames.includes(`${source.name} ${counter}`.toLowerCase())) {
        counter++;
      }
      finalName = `${source.name} ${counter}`;
    }

    setCopyingGroupId(source.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: groupData, error: groupError } = await supabase
      .from("skill_groups")
      .insert({
        pet_id: petId,
        user_id: user.id,
        name: finalName,
        signature: sourceSignature,
      })
      .select("id, name")
      .single();

    if (groupError || !groupData) {
      const message = groupError?.message ?? "";
      if (message.includes("skill_groups_pet_signature_unique")) {
        setCopyWarning("Ya tienes un grupo con estas mismas habilidades creado");
      } else if (message.includes("skill_groups_pet_name_unique")) {
        setCopyWarning("Ya tienes un grupo de habilidades con este nombre");
      } else {
        setCopyWarning("No se pudo copiar el grupo. Inténtalo de nuevo.");
        console.error("Error copiando grupo:", groupError);
      }
      setCopyingGroupId(null);
      return;
    }

    const items = source.skillIds.map((skillId) => ({
      group_id: groupData.id,
      skill_id: skillId,
    }));

    const { error: itemsError } = await supabase
      .from("skill_group_items")
      .insert(items);

    if (itemsError) {
      console.error("Error copiando habilidades:", itemsError);
      setCopyWarning("El grupo se copió pero hubo un problema con las habilidades.");
      setCopyingGroupId(null);
      return;
    }

    setGroups((prev) => [
      ...prev,
      { id: groupData.id, name: groupData.name, skillIds: [...source.skillIds] },
    ]);

    setCopyingGroupId(null);
    setCopyWarning(`Grupo "${finalName}" copiado correctamente.`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">Cargando grupos...</p>
        </div>
      </main>
    );
  }

  const isEditing = editingGroupId !== null;

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/pets/${petId}`}
            className="rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Volver a la mascota
          </Link>
          <Link
            href={`/pets/${petId}/skills`}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            🎯 Habilidades de la mascota
          </Link>
        </div>

        <header className="mb-8 flex items-center gap-5 rounded-3xl bg-white p-8 shadow">
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
              Grupos de habilidades de
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {pet?.name}
            </h1>
          </div>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Tus grupos</h2>
            {otherPets.length > 0 && (
              <button
                type="button"
                onClick={handleOpenCopy}
                className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-700"
              >
                📋 Copiar grupo de otro perro
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <div className="text-4xl">📂</div>
              <p className="mt-3 text-slate-500">
                Todavía no has creado ningún grupo. Selecciona habilidades abajo
                para crear el primero.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => {
                const isThisEditing = group.id === editingGroupId;
                return (
                  <div
                    key={group.id}
                    className={`rounded-2xl bg-white p-6 shadow ${
                      isThisEditing ? "ring-2 ring-blue-500" : ""
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="text-xl font-bold">{group.name}</h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(group)}
                          className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 transition hover:bg-red-200"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.skillIds.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                        >
                          {skillNameById(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">
            {isEditing
              ? `Editando: ${editingGroup?.name ?? ""}`
              : "Crear un grupo nuevo"}
          </h2>

          {warning && (
            <div className="mb-4 rounded-xl bg-amber-100 px-5 py-4 font-semibold text-amber-900">
              {warning}
            </div>
          )}

          {skills.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-3">
              {categories.map((category) => {
                const isActive = category === activeCategory;
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
                    {category !== "Todas" && CATEGORY_ICONS[category]
                      ? `${CATEGORY_ICONS[category]} `
                      : ""}
                    {category}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {filteredSkills.map((skill) => {
              const isSelected = selectedIds.includes(skill.id);
              const icon = skill.category
                ? CATEGORY_ICONS[skill.category] ?? "🐾"
                : "🐾";
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`flex items-center gap-3 rounded-xl p-4 text-left transition ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="font-semibold">{skill.name}</span>
                  {isSelected && (
                    <span className="ml-auto text-lg font-bold">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <p className="text-slate-600">
              {selectedIds.length === 0
                ? "Ninguna habilidad seleccionada"
                : `${selectedIds.length} habilidad(es) seleccionada(s)`}
            </p>

            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={selectedIds.length === 0 || saving}
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={handleStartRename}
                  disabled={selectedIds.length === 0 || saving}
                  className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                >
                  Cambiar nombre
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartNaming}
                disabled={selectedIds.length === 0 || saving}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Crear grupo
              </button>
            )}
          </div>
        </section>
      </div>

      {/* MODAL DE NOMBRADO */}
      {namingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h3 className="mb-2 text-2xl font-bold">
              {namingMode === "rename"
                ? "Nuevo nombre del grupo"
                : "Nombre del grupo"}
            </h3>
            <p className="mb-6 text-slate-500">
              Esta es la sugerencia para tu grupo. Si no te convence, pide otra.
            </p>

            <div className="mb-6 rounded-2xl bg-slate-100 p-6 text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                {nameOptions[nameIndex]}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleAcceptName}
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Aceptar este nombre"}
              </button>
              <button
                type="button"
                onClick={handleNextName}
                disabled={saving || nameOptions.length <= 1}
                className="w-full rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
              >
                Sugerir otro nombre
              </button>
              <button
                type="button"
                onClick={handleCancelNaming}
                disabled={saving}
                className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COPIAR GRUPO DE OTRO PERRO */}
      {copyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-xl">

            {/* CABECERA FIJA CON X */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <h3 className="text-2xl font-bold">
                  Copiar grupo de otro perro
                </h3>
                <p className="mt-1 text-slate-500">
                  Elige un perro y copia uno de sus grupos a {pet?.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCopy}
                aria-label="Cerrar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* CONTENIDO CON SCROLL */}
            <div className="overflow-y-auto p-6">
              {copyWarning && (
                <div className="mb-4 rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-900">
                  {copyWarning}
                </div>
              )}

              <div className="mb-6">
                <label className="mb-2 block font-semibold">Perro</label>
                <select
                  value={copyPetId}
                  onChange={(e) => handleSelectCopyPet(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Selecciona un perro</option>
                  {otherPets.map((op) => (
                    <option key={op.id} value={String(op.id)}>
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>

              {copyPetId && (
                <div>
                  <p className="mb-2 font-semibold">Grupos disponibles</p>

                  {loadingCopyGroups ? (
                    <p className="text-slate-500">Cargando grupos...</p>
                  ) : copyableGroups.length === 0 ? (
                    <p className="text-slate-500">
                      Este perro no tiene grupos para copiar.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {copyableGroups.map((cg) => (
                        <div
                          key={cg.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <h4 className="font-bold">{cg.name}</h4>
                            <button
                              type="button"
                              onClick={() => handleCopyGroup(cg)}
                              disabled={copyingGroupId === cg.id}
                              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                            >
                              {copyingGroupId === cg.id ? "Copiando..." : "Copiar"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {cg.skillIds.map((id) => (
                              <span
                                key={id}
                                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                              >
                                {skillNameById(id)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PIE FIJO */}
            <div className="border-t border-slate-200 p-6">
              <button
                type="button"
                onClick={handleCloseCopy}
                className="w-full rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}