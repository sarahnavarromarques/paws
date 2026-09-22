"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import SearchableSelect from "@/components/SearchableSelect";

const supabase = createClient();

type Props = {
  petId: number;
};

type Skill = {
  id: number;
  name: string;
  name_en: string | null;
  category: string | null;
  category_en: string | null;
};

type Group = {
  id: number;
  name: string;
  skillIds: number[];
};

const ALL_GROUPS_VALUE = "all";

export default function AddTrainingForm({ petId }: Props) {
  const router = useRouter();
  const t = useTranslations("AddTrainingForm");
  const locale = useLocale();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [groupChoice, setGroupChoice] = useState<string>(ALL_GROUPS_VALUE);
  const [skillId, setSkillId] = useState<string>("");

  function skillName(skill: Skill): string {
    return locale === "en" && skill.name_en ? skill.name_en : skill.name;
  }

  function skillCategory(skill: Skill): string | null {
    if (locale === "en" && skill.category_en) return skill.category_en;
    return skill.category;
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: skillsData } = await supabase
        .from("skills")
        .select("id, name, name_en, category, category_en")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      setSkills(skillsData ?? []);

      const { data: groupsData } = await supabase
        .from("skill_groups")
        .select("id, name")
        .eq("pet_id", petId)
        .order("created_at", { ascending: true });

      if (groupsData && groupsData.length > 0) {
        const groupIds = groupsData.map((g) => g.id);

        const { data: itemsData } = await supabase
          .from("skill_group_items")
          .select("group_id, skill_id")
          .in("group_id", groupIds);

        const combined: Group[] = groupsData.map((g) => ({
          id: g.id,
          name: g.name,
          skillIds:
            itemsData
              ?.filter((it) => it.group_id === g.id)
              .map((it) => it.skill_id) ?? [],
        }));

        setGroups(combined);
      } else {
        setGroups([]);
      }

      setLoading(false);
    }

    loadData();
  }, [petId]);

  const visibleSkills = useMemo(() => {
    if (groupChoice === ALL_GROUPS_VALUE) {
      return skills;
    }

    const group = groups.find((g) => String(g.id) === groupChoice);
    if (!group) return [];

    return skills.filter((skill) => group.skillIds.includes(skill.id));
  }, [groupChoice, groups, skills]);

  // Opciones del buscador de grupo: nombres de grupos + "Todas"/"All"
  const groupSelectOptions = useMemo(() => {
    return [...groups.map((g) => g.name), t("allGroupsLabel")];
  }, [groups, t]);

  // Valor mostrado en el buscador de grupo (nombre o "Todas"/"All")
  const groupSelectValue = useMemo(() => {
    if (groupChoice === ALL_GROUPS_VALUE) return t("allGroupsLabel");
    const group = groups.find((g) => String(g.id) === groupChoice);
    return group?.name ?? t("allGroupsLabel");
  }, [groupChoice, groups, t]);

  // Opciones del buscador de habilidad (etiquetas visibles)
  const skillLabelToId = useMemo(() => {
    const map = new Map<string, string>();
    visibleSkills.forEach((skill) => {
      const category = skillCategory(skill);
      const label = category
        ? `${category} — ${skillName(skill)}`
        : skillName(skill);
      map.set(label, String(skill.id));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSkills, locale]);

  const skillSelectOptions = useMemo(
    () => Array.from(skillLabelToId.keys()),
    [skillLabelToId]
  );

  const skillSelectValue = useMemo(() => {
    if (!skillId) return "";
    const skill = visibleSkills.find((s) => String(s.id) === skillId);
    if (!skill) return "";
    const category = skillCategory(skill);
    return category ? `${category} — ${skillName(skill)}` : skillName(skill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, visibleSkills, locale]);

  function handleGroupChange(groupName: string) {
    if (groupName === t("allGroupsLabel")) {
      setGroupChoice(ALL_GROUPS_VALUE);
    } else {
      const group = groups.find((g) => g.name === groupName);
      setGroupChoice(group ? String(group.id) : ALL_GROUPS_VALUE);
    }
    setSkillId("");
  }

  function handleSkillChange(label: string) {
    const id = skillLabelToId.get(label);
    setSkillId(id ?? "");
  }

  async function handleSave() {
    if (!skillId) {
      alert(t("alertSelectSkill"));
      return;
    }

    if (!date) {
      alert(t("alertSelectDate"));
      return;
    }

    const numericDuration = duration ? Number(duration) : null;

    if (
      numericDuration !== null &&
      (!Number.isFinite(numericDuration) || numericDuration < 0)
    ) {
      alert(t("alertInvalidDuration"));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(t("alertNoUser"));
      return;
    }

    const chosenSkill = skills.find((s) => String(s.id) === skillId);
    const chosenSkillName = chosenSkill
      ? skillName(chosenSkill)
      : t("defaultTrainingTitle");

    let generatedTitle = chosenSkillName;
    if (groupChoice !== ALL_GROUPS_VALUE) {
      const group = groups.find((g) => String(g.id) === groupChoice);
      if (group) {
        generatedTitle = `${group.name} — ${chosenSkillName}`;
      }
    }

    setSaving(true);

    const { error } = await supabase.from("trainings").insert({
      user_id: user.id,
      pet_id: petId,
      title: generatedTitle,
      date,
      time: time || null,
      duration: numericDuration,
      status,
      notes: notes.trim() || null,
      skill_id: Number(skillId),
      skill_group_id:
        groupChoice === ALL_GROUPS_VALUE ? null : Number(groupChoice),
    });

    if (error) {
      console.error("Error guardando entrenamiento:", error);
      setSaving(false);
      alert(t("alertSaveError"));
      return;
    }

    setSaving(false);

    setDate("");
    setTime("");
    setDuration("");
    setStatus("pending");
    setNotes("");
    setGroupChoice(ALL_GROUPS_VALUE);
    setSkillId("");

    router.refresh();
  }

  if (loading) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">

        {/* GRUPO */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            {t("skillGroupLabel")}
          </label>

          {groups.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-600">
                {t("noGroupsMessage")}
              </p>
              <Link
                href={`/pets/${petId}/groups`}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-center font-semibold text-white transition hover:bg-blue-700"
              >
                {t("createGroups")}
              </Link>
            </div>
          ) : (
            <SearchableSelect
              options={groupSelectOptions}
              value={groupSelectValue}
              onChange={handleGroupChange}
              placeholder={t("selectGroupPlaceholder")}
              disabled={saving}
            />
          )}
        </div>

        {/* HABILIDAD */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            {t("skillWorkedLabel")}
          </label>

          <SearchableSelect
            options={skillSelectOptions}
            value={skillSelectValue}
            onChange={handleSkillChange}
            placeholder={t("selectSkillPlaceholder")}
            disabled={saving}
          />

          {groupChoice !== ALL_GROUPS_VALUE && visibleSkills.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              {t("groupHasNoSkills")}
            </p>
          )}
        </div>

        {/* FECHA */}

        <div>
          <label className="mb-2 block font-semibold">
            {t("dateLabel")}
          </label>

          <input
            type="date"
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* HORA */}

        <div>
          <label className="mb-2 block font-semibold">
            {t("timeLabel")}
          </label>

          <input
            type="time"
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={saving}
          />
        </div>

        {/* DURACIÓN */}

        <div>
          <label className="mb-2 block font-semibold">
            {t("durationLabel")}
          </label>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder={t("durationLabel")}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={saving}
            />

            <span className="whitespace-nowrap text-slate-500">
              {t("minSuffix")}
            </span>
          </div>
        </div>

        {/* ESTADO */}

        <div>
          <label className="mb-2 block font-semibold">
            {t("statusLabel")}
          </label>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="pending">
              {t("pendingOption")}
            </option>

            <option value="completed">
              {t("completedOption")}
            </option>
          </select>
        </div>

        {/* NOTAS */}

        <div className="md:col-span-2">
          <label className="mb-2 block font-semibold">
            {t("notesLabel")}
          </label>

          <textarea
            rows={5}
            className="w-full rounded-xl border border-slate-300 p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      {/* BOTÓN */}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}