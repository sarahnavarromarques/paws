"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";
import { buildGroupSignature } from "@/lib/skill-group-names";
import {
  EMPTY_ANSWERS,
  NOTES_MAX_LENGTH,
  QUESTIONS,
  isQuestionAnswered,
  questionnaireText,
  sanitizeAnswers,
  toQuestionnaireLocale,
  type CatalogSkill,
  type MultiQuestionId,
  type QuestionnaireAnswers,
  type QuestionnaireProposal,
  type QuestionnaireTextKey,
  type QuestionOption,
  type SingleQuestionId,
} from "@/lib/pet-questionnaire";

const supabase = createClient();

type Stage = "loading" | "notFound" | "questions" | "generating" | "review" | "saving";

type ReviewGroup = {
  name: string;
  reason: string;
  skillIds: number[];
  included: boolean;
  removed: number[];
};

type ProposalResponse = {
  proposal: QuestionnaireProposal;
  skills: CatalogSkill[];
  usedFallback: boolean;
};

// Muestra el texto de la IA con párrafos y **negritas**, sin asteriscos visibles.
function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);

        return (
          <p key={paragraphIndex} className={paragraphIndex > 0 ? "mt-3" : ""}>
            {parts.map((part, partIndex) => {
              if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
              }
              return <Fragment key={partIndex}>{part.replace(/\*\*/g, "")}</Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function PetQuestionnairePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = toQuestionnaireLocale(useLocale());
  const petId = Number(params.id);

  const tx = (key: QuestionnaireTextKey, values?: Record<string, string | number>) =>
    questionnaireText(locale, key, values);

  const [stage, setStage] = useState<Stage>("loading");
  const [petName, setPetName] = useState("");
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(EMPTY_ANSWERS);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [objective, setObjective] = useState("");
  const [summary, setSummary] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [skillsById, setSkillsById] = useState<Map<number, CatalogSkill>>(new Map());

  // --- Cargar la mascota (y respuestas anteriores, si las hay) ---

  useEffect(() => {
    async function load() {
      if (!Number.isInteger(petId)) {
        setStage("notFound");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: pet } = await supabase
        .from("pets")
        .select("id, name")
        .eq("id", petId)
        .eq("user_id", user.id)
        .single();

      if (!pet) {
        setStage("notFound");
        return;
      }

      setPetName(pet.name);

      const { data: previous } = await supabase
        .from("pet_questionnaires")
        .select("answers")
        .eq("pet_id", petId)
        .maybeSingle();

      const previousAnswers = previous ? sanitizeAnswers(previous.answers) : null;

      if (previousAnswers) {
        setAnswers(previousAnswers);
      }

      setStage("questions");
    }

    void load();
  }, [petId, router]);

  const question = QUESTIONS[index];
  const total = QUESTIONS.length;
  const isLast = index === total - 1;
  const canContinue = question ? isQuestionAnswered(question, answers) : false;

  // --- Guardar el objetivo en la ficha del perro ("Goal") ---
  // Se llama en cuanto la IA genera el objetivo, y otra vez al aceptar o saltar
  // (por si el usuario lo ha editado). Si falla, no bloquea el cuestionario.

  async function saveObjectiveToPet(text: string): Promise<boolean> {
    const clean = text.trim();
    if (!clean) return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { error: updateError } = await supabase
      .from("pets")
      .update({ objective: clean })
      .eq("id", petId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error guardando el objetivo en la ficha:", updateError);
      return false;
    }

    return true;
  }

  // --- Respuestas ---

  function setSingle(id: SingleQuestionId, value: string) {
    setAnswers((prev) => {
      const next = { ...prev };
      next[id] = value;
      return next;
    });
  }

  function toggleMulti(id: MultiQuestionId, option: QuestionOption, options: QuestionOption[]) {
    setAnswers((prev) => {
      const current = prev[id];
      let updated: string[];

      if (current.includes(option.value)) {
        updated = current.filter((value) => value !== option.value);
      } else if (option.exclusive) {
        updated = [option.value];
      } else {
        const exclusiveValues = options
          .filter((item) => item.exclusive)
          .map((item) => item.value);
        updated = [
          ...current.filter((value) => !exclusiveValues.includes(value)),
          option.value,
        ];
      }

      const next = { ...prev };
      next[id] = updated;
      return next;
    });
  }

  async function handleSkip() {
    // Si ya hay un objetivo generado (pantalla de revisión), se guarda antes de salir.
    if (stage === "review") {
      await saveObjectiveToPet(objective);
    }
    router.push(`/pets/${petId}`);
  }

  function handleBack() {
    setError(null);
    if (index > 0) setIndex(index - 1);
  }

  async function handleNext() {
    setError(null);
    if (!canContinue) return;

    if (!isLast) {
      setIndex(index + 1);
      return;
    }

    await generateProposal();
  }

  // --- Pedir la propuesta a la IA ---

  async function generateProposal() {
    setStage("generating");
    setError(null);

    try {
      const response = await fetch("/api/pet-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId, answers, locale }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ProposalResponse;

      setObjective(data.proposal.objective);
      setSummary(data.proposal.summary);
      setUsedFallback(data.usedFallback);
      setSkillsById(new Map(data.skills.map((skill) => [skill.id, skill])));
      setReviewGroups(
        data.proposal.groups.map((group) => ({
          name: group.name,
          reason: group.reason,
          skillIds: group.skillIds,
          included: true,
          removed: [],
        }))
      );

      // El objetivo pasa a la ficha automáticamente, sin esperar a "Aceptar".
      await saveObjectiveToPet(data.proposal.objective);

      setStage("review");
    } catch (err) {
      console.error("Error generando la propuesta:", err);
      setError(tx("errorGenerate"));
      setStage("questions");
    }
  }

  // --- Revisión ---

  function toggleGroup(groupIndex: number) {
    setReviewGroups((prev) =>
      prev.map((group, i) =>
        i === groupIndex ? { ...group, included: !group.included } : group
      )
    );
  }

  function toggleSkill(groupIndex: number, skillId: number) {
    setReviewGroups((prev) =>
      prev.map((group, i) => {
        if (i !== groupIndex) return group;
        const removed = group.removed.includes(skillId)
          ? group.removed.filter((id) => id !== skillId)
          : [...group.removed, skillId];
        return { ...group, removed };
      })
    );
  }

  function skillLabel(skillId: number): string {
    const skill = skillsById.get(skillId);
    if (!skill) return `#${skillId}`;
    return locale === "en" ? skill.nameEn ?? skill.name : skill.name;
  }

  const finalGroups = useMemo(
    () =>
      reviewGroups
        .filter((group) => group.included)
        .map((group) => ({
          name: group.name,
          skillIds: group.skillIds.filter((id) => !group.removed.includes(id)),
        }))
        .filter((group) => group.skillIds.length > 0),
    [reviewGroups]
  );

  // --- Aceptar: guardar objetivo, crear grupos, añadir habilidades y calcular el primer orden ---

  async function handleAccept() {
    setError(null);

    const cleanObjective = objective.trim();

    if (!cleanObjective) {
      setError(tx("errorObjective"));
      return;
    }

    if (finalGroups.length === 0) {
      setError(tx("errorNoGroups"));
      return;
    }

    setStage("saving");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error: petError } = await supabase
        .from("pets")
        .update({ objective: cleanObjective })
        .eq("id", petId)
        .eq("user_id", user.id);

      if (petError) throw petError;

      const { data: existingRows, error: existingError } = await supabase
        .from("skill_groups")
        .select("name, signature")
        .eq("pet_id", petId);

      if (existingError) throw existingError;

      const usedNames = new Set(
        (existingRows ?? []).map((group) => group.name.trim().toLowerCase())
      );
      const usedSignatures = new Set(
        (existingRows ?? []).map((group) => group.signature)
      );

      let skipped = 0;

      for (const group of finalGroups) {
        const signature = buildGroupSignature(group.skillIds);

        // Mismo conjunto de habilidades que un grupo existente: no se duplica.
        if (usedSignatures.has(signature)) {
          skipped++;
          continue;
        }

        // Nombre repetido: se añade un número ("Bases 2").
        let name = group.name.trim();
        let suffix = 2;
        while (usedNames.has(name.toLowerCase())) {
          name = `${group.name.trim()} ${suffix}`;
          suffix++;
        }

        const { data: groupData, error: groupError } = await supabase
          .from("skill_groups")
          .insert({
            pet_id: petId,
            user_id: user.id,
            name,
            signature,
          })
          .select("id")
          .single();

        if (groupError || !groupData) {
          const message = groupError?.message ?? "";
          if (
            message.includes("skill_groups_pet_signature_unique") ||
            message.includes("skill_groups_pet_name_unique")
          ) {
            skipped++;
            continue;
          }
          throw groupError ?? new Error("No se creó el grupo");
        }

        const { error: itemsError } = await supabase
          .from("skill_group_items")
          .insert(
            group.skillIds.map((skillId) => ({
              group_id: groupData.id,
              skill_id: skillId,
            }))
          );

        if (itemsError) throw itemsError;

        usedNames.add(name.toLowerCase());
        usedSignatures.add(signature);
      }

      // Añadir al perro las habilidades de los grupos elegidos (progreso 0).
      // Las que ya tiene no se tocan, para no perder su progreso.
      const planSkillIds = Array.from(
        new Set(finalGroups.flatMap((group) => group.skillIds))
      );

      const { data: currentPetSkills, error: petSkillsError } = await supabase
        .from("pet_skills")
        .select("skill_id")
        .eq("pet_id", petId);

      if (petSkillsError) throw petSkillsError;

      const alreadyHas = new Set(
        (currentPetSkills ?? []).map((row) => row.skill_id)
      );

      const missingSkillIds = planSkillIds.filter((id) => !alreadyHas.has(id));

      if (missingSkillIds.length > 0) {
        const { error: addSkillsError } = await supabase
          .from("pet_skills")
          .insert(
            missingSkillIds.map((skillId) => ({
              pet_id: petId,
              skill_id: skillId,
              manual_progress: 0,
              auto_progress: 0,
            }))
          );

        if (addSkillsError) throw addSkillsError;
      }

      await supabase
        .from("pet_questionnaires")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("pet_id", petId);

      // Primer orden recomendado (si falla, se puede recalcular desde Habilidades).
      try {
        await fetch("/api/training-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petId }),
        });
      } catch (orderError) {
        console.error("Error calculando el primer orden:", orderError);
      }

      if (skipped > 0) {
        alert(tx("skippedDuplicates"));
      }

      router.push(`/pets/${petId}`);
    } catch (err) {
      console.error("Error guardando el plan del cuestionario:", err);
      setError(tx("errorSave"));
      setStage("review");
    }
  }

  // --- Pantallas ---

  if (stage === "loading") {
    return <PawsiLoading text={tx("loading")} />;
  }

  if (stage === "notFound") {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl bg-white p-8 text-center shadow">
          <Pawsi pose="triste" size={120} />
          <p className="mb-6 mt-4 text-slate-600">{tx("noPet")}</p>
          <Link
            href="/pets"
            className="rounded-xl bg-slate-700 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            {tx("backToPets")}
          </Link>
        </div>
      </main>
    );
  }

  if (stage === "generating" || stage === "saving") {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
          {/* Pawsi piensa mientras la IA prepara el plan, y celebra al guardarlo */}
          <Pawsi
            pose={stage === "generating" ? "piensa" : "celebra"}
            size={150}
            float
          />
          <p className="mt-4 text-lg font-semibold text-blue-700">
            {stage === "generating" ? tx("generating") : tx("accepting")}
          </p>
        </div>
      </main>
    );
  }

  if (stage === "review") {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold text-blue-700 md:text-4xl">
            {tx("reviewTitle", { name: petName })}
          </h1>
          <p className="mt-2 text-slate-600">{tx("reviewSubtitle")}</p>

          {usedFallback && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              ⚠️ {tx("fallbackNotice")}
            </div>
          )}

          {summary && (
            <RichText
              text={summary}
              className="mt-4 rounded-xl bg-blue-50 p-4 leading-relaxed text-blue-900"
            />
          )}

          <div className="mt-6 rounded-2xl bg-white p-5 shadow">
            <label className="mb-2 block font-semibold">{tx("objectiveLabel")}</label>
            <textarea
              className="w-full rounded-lg border p-3"
              rows={3}
              maxLength={200}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          <h2 className="mt-8 text-2xl font-bold">{tx("groupsLabel")}</h2>
          <p className="mb-4 text-sm text-slate-500">{tx("tapToRemove")}</p>

          <div className="space-y-4">
            {reviewGroups.map((group, groupIndex) => (
              <div
                key={`${group.name}-${groupIndex}`}
                className={`rounded-2xl bg-white p-5 shadow transition ${
                  group.included ? "" : "opacity-50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={group.included}
                    onChange={() => toggleGroup(groupIndex)}
                    aria-label={tx("includeGroup")}
                  />
                  <div>
                    <h3 className="text-xl font-bold">{group.name}</h3>
                    {group.reason && (
                      <RichText
                        text={group.reason}
                        className="mt-1 text-sm leading-relaxed text-slate-600"
                      />
                    )}
                  </div>
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  {group.skillIds.map((skillId) => {
                    const removed = group.removed.includes(skillId);
                    return (
                      <button
                        key={skillId}
                        type="button"
                        disabled={!group.included}
                        onClick={() => toggleSkill(groupIndex, skillId)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          removed
                            ? "bg-slate-100 text-slate-400 line-through"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        }`}
                      >
                        {skillLabel(skillId)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
              ⚠️ {error}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={() => void handleAccept()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              {tx("accept")}
            </button>
            <button
              type="button"
              onClick={() => void generateProposal()}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 shadow transition hover:bg-blue-50"
            >
              {tx("retry")}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIndex(0);
                setStage("questions");
              }}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-700 shadow transition hover:bg-slate-50"
            >
              {tx("editAnswers")}
            </button>
            <button
              type="button"
              onClick={() => void handleSkip()}
              className="rounded-xl px-6 py-3 font-semibold text-slate-500 transition hover:text-slate-700"
            >
              {tx("skip")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- Preguntas ---

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-700 md:text-4xl">
              {tx("title", { name: petName })}
            </h1>
            <p className="mt-2 text-slate-600">{tx("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSkip()}
            className="shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-slate-600 shadow transition hover:bg-slate-50"
          >
            {tx("skip")}
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>{tx("stepOf", { current: index + 1, total })}</span>
        </div>
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-2 text-2xl font-bold">{question[locale]}</h2>

          {question.kind === "multi" && (
            <p className="mb-4 text-sm text-slate-500">{tx("multiHint")}</p>
          )}

          {question.kind === "single" && (
            <div className="mt-4 grid gap-3">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSingle(question.id, option.value)}
                    className={`rounded-xl border-2 p-4 text-left font-semibold transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 text-blue-800"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {option[locale]}
                  </button>
                );
              })}
            </div>
          )}

          {question.kind === "multi" && (
            <div className="grid gap-3">
              {question.options.map((option) => {
                const selected = answers[question.id].includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleMulti(question.id, option, question.options)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left font-semibold transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 text-blue-800"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs ${
                        selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    {option[locale]}
                  </button>
                );
              })}
            </div>
          )}

          {question.kind === "text" && (
            <textarea
              className="mt-4 w-full rounded-lg border p-3"
              rows={4}
              maxLength={NOTES_MAX_LENGTH}
              placeholder={tx("notesPlaceholder")}
              value={answers.notes}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={index === 0}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-700 shadow transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tx("back")}
          </button>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canContinue}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLast ? tx("finish") : tx("next")}
          </button>
        </div>
      </div>
    </main>
  );
}