import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";
import {
  buildLocalGuide,
  sanitizeGuide,
  type SessionGuideData,
} from "@/lib/session-guide";

// Se ejecuta en el servidor: la clave de la IA nunca llega al navegador.
export const runtime = "nodejs";
export const maxDuration = 60;

const IS_DEV = process.env.NODE_ENV !== "production";
const TOOL_NAME = "save_session_guide";

function ageText(birthDate: string | null, isEn: boolean): string {
  if (!birthDate) {
    return isEn ? "no data" : "sin datos";
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (now.getDate() < birth.getDate()) {
    months--;
  }

  if (months < 12) {
    return isEn ? `${Math.max(months, 0)} months` : `${Math.max(months, 0)} meses`;
  }

  const years = Math.floor(months / 12);
  return isEn ? `${years} years` : `${years} años`;
}

export async function POST(request: Request) {
  let body: { trainingId?: unknown; locale?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const trainingId = Number(body.trainingId);
  const isEn = body.locale === "en";
  const locale = isEn ? "en" : "es";

  if (!Number.isInteger(trainingId)) {
    return NextResponse.json({ error: "bad_training_id" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- Entrenamiento, perro y habilidad ---

  const { data: training } = await supabase
    .from("trainings")
    .select("id, pet_id, skill_id, duration, notes")
    .eq("id", trainingId)
    .eq("user_id", user.id)
    .single();

  if (!training || training.pet_id === null || training.skill_id === null) {
    return NextResponse.json({ error: "no_training" }, { status: 404 });
  }

  const petId = training.pet_id;
  const skillId = training.skill_id;

  const { data: pet } = await supabase
    .from("pets")
    .select("name, breed, birth_date, objective, level")
    .eq("id", petId)
    .eq("user_id", user.id)
    .single();

  const { data: skill } = await supabase
    .from("skills")
    .select("name, name_en, category, category_en, description, description_en")
    .eq("id", skillId)
    .single();

  if (!pet || !skill) {
    return NextResponse.json({ error: "no_data" }, { status: 404 });
  }

  const { data: petSkill } = await supabase
    .from("pet_skills")
    .select("auto_progress")
    .eq("pet_id", petId)
    .eq("skill_id", skillId)
    .maybeSingle();

  const { data: recentRows } = await supabase
    .from("trainings")
    .select("date, duration, notes")
    .eq("pet_id", petId)
    .eq("skill_id", skillId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(5);

  const progress = petSkill?.auto_progress ?? 0;
  const skillName = isEn && skill.name_en ? skill.name_en : skill.name;
  const category = isEn && skill.category_en ? skill.category_en : skill.category;
  const description =
    isEn && skill.description_en ? skill.description_en : skill.description;

  const noData = isEn ? "no data" : "sin datos";

  const recentLines =
    (recentRows ?? []).length > 0
      ? (recentRows ?? [])
          .map((row) => {
            const dur = row.duration != null ? `${row.duration} min` : noData;
            const notes = row.notes ? ` — ${row.notes}` : "";
            return `- ${row.date ?? noData}: ${dur}${notes}`;
          })
          .join("\n")
      : isEn
      ? "No previous sessions of this skill."
      : "Sin sesiones anteriores de esta habilidad.";

  // --- IA, con guía local de respaldo ---

  let guide: SessionGuideData = buildLocalGuide(
    skillName,
    progress,
    training.duration ?? null,
    isEn
  );
  let usedFallback = true;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const accountType = await getCurrentAccountType();
      const audience = getAudienceInstructions(accountType, isEn);

      const prompt = isEn
        ? `You are an expert dog trainer in positive reinforcement and obedience (including FCI regulations). Prepare TODAY's session for this dog.

Dog: ${pet.name}
Breed: ${pet.breed ?? noData}
Age: ${ageText(pet.birth_date, true)}
Level: ${pet.level ?? noData}
Main goal: ${pet.objective ?? noData}

Today's skill: ${skillName}${category ? ` (${category})` : ""}
Skill description: ${description ?? noData}
Current progress: ${progress}% (0 = doesn't know it, 80 or more = mastered)
Planned duration: ${training.duration != null ? `${training.duration} minutes` : noData}
Training notes: ${training.notes ?? noData}

Last sessions of this skill (most recent first):
${recentLines}

Who you are writing for: ${audience}

Save the guide with the ${TOOL_NAME} tool. Rules:
- Adapt the difficulty to the progress: if it's low, very easy steps in a quiet place; if it's high, add distance, duration or distractions.
- Between 3 and 5 steps, in order, that fit in the planned duration.
- In each step, give concrete repetitions or time in "reps".
- Positive reinforcement only: no punishment or physical corrections.
- Short, practical sentences, addressing the reader as "you". Write in English.
- Don't invent data that isn't listed above.`
        : `Eres un adiestrador canino experto en refuerzo positivo y en obediencia (incluido el reglamento FCI). Prepara la sesión de HOY para este perro.

Perro: ${pet.name}
Raza: ${pet.breed ?? noData}
Edad: ${ageText(pet.birth_date, false)}
Nivel: ${pet.level ?? noData}
Objetivo principal: ${pet.objective ?? noData}

Habilidad de hoy: ${skillName}${category ? ` (${category})` : ""}
Descripción de la habilidad: ${description ?? noData}
Progreso actual: ${progress}% (0 = no la conoce, 80 o más = dominada)
Duración prevista: ${training.duration != null ? `${training.duration} minutos` : noData}
Notas del entrenamiento: ${training.notes ?? noData}

Últimas sesiones de esta habilidad (la más reciente primero):
${recentLines}

A quién te diriges: ${audience}

Guarda la guía con la herramienta ${TOOL_NAME}. Reglas:
- Adapta la dificultad al progreso: si es bajo, pasos muy fáciles en un lugar tranquilo; si es alto, añade distancia, duración o distracciones.
- Entre 3 y 5 pasos, en orden, que quepan en la duración prevista.
- En cada paso indica repeticiones o tiempo concretos en "reps".
- Solo refuerzo positivo: nada de castigos ni correcciones físicas.
- Frases cortas y prácticas, dirigiéndote de tú. Escribe en español.
- No inventes datos que no aparezcan arriba.`;

      const anthropic = new Anthropic({ apiKey });

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        tools: [
          {
            name: TOOL_NAME,
            description: "Saves today's training session guide.",
            input_schema: {
              type: "object",
              properties: {
                objective: {
                  type: "string",
                  description: "Today's goal for this skill, in one sentence.",
                },
                warmup: {
                  type: "string",
                  description: "Short warm-up, in one or two sentences.",
                },
                steps: {
                  type: "array",
                  description: "Between 3 and 5 steps, in order.",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      reps: {
                        type: "string",
                        description: "Concrete repetitions or time.",
                      },
                    },
                    required: ["title", "detail", "reps"],
                  },
                },
                level_up: {
                  type: "string",
                  description: "When and how to make it harder.",
                },
                level_down: {
                  type: "string",
                  description: "When and how to make it easier.",
                },
                finish: {
                  type: "string",
                  description: "How to end the session.",
                },
              },
              required: [
                "objective",
                "warmup",
                "steps",
                "level_up",
                "level_down",
                "finish",
              ],
            },
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: prompt }],
      });

      const toolBlock = message.content.find((block) => block.type === "tool_use");

      if (IS_DEV) {
        console.log("[session-guide] stop_reason:", message.stop_reason);
      }

      if (toolBlock && toolBlock.type === "tool_use") {
        const sanitized = sanitizeGuide(toolBlock.input);

        if (sanitized) {
          guide = sanitized;
          usedFallback = false;
        }
      }
    } catch (error) {
      console.error("Error llamando a la IA (session-guide):", error);
    }
  }

  // --- Guardar (una por entrenamiento: se sobrescribe al regenerar) ---

  const updatedAt = new Date().toISOString();

  const { error: saveError } = await supabase
    .from("training_guides")
    .upsert(
      {
        training_id: trainingId,
        user_id: user.id,
        locale,
        data: guide,
        used_fallback: usedFallback,
        updated_at: updatedAt,
      },
      { onConflict: "training_id" }
    );

  if (saveError) {
    console.error("Error guardando la guía de sesión:", saveError);
  }

  return NextResponse.json({
    guide,
    locale,
    usedFallback,
    saved: !saveError,
  });
}