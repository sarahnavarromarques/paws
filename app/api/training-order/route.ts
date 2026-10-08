import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";
import {
  MASTERED_THRESHOLD,
  buildLocalOrder,
  sanitizeOrder,
  type OrderInputGroup,
  type TrainingOrderData,
} from "@/lib/training-order";

// Se ejecuta en el servidor: la clave de la IA nunca llega al navegador.
export const runtime = "nodejs";

// La IA tarda unos 20-30 s en ordenar muchos grupos: margen para Vercel.
export const maxDuration = 60;

const IS_DEV = process.env.NODE_ENV !== "production";

const TOOL_NAME = "save_training_order";

type PetInfo = {
  name: string;
  breed: string | null;
  objective: string | null;
  level: string | null;
};

function buildPrompt(
  pet: PetInfo,
  groups: OrderInputGroup[],
  audience: string
): string {
  const groupLines = groups
    .map((group) => {
      const skillLines =
        group.skills.length > 0
          ? group.skills
              .map((skill) => {
                const nameEn = skill.nameEn ?? skill.name;
                const cat = skill.category ? ` | categoría: ${skill.category}` : "";
                const goal = skill.isGoal ? " | OBJETIVO" : "";
                return `  - id=${skill.skillId} | es: "${skill.name}" | en: "${nameEn}"${cat} | progreso: ${skill.progress}% | ${skill.sessionCount} sesiones completadas${goal}`;
              })
              .join("\n")
          : "  (sin habilidades)";

      return `Grupo id=${group.groupId} "${group.name}":\n${skillLines}`;
    })
    .join("\n\n");

  return `Eres un adiestrador canino experto en obediencia, incluido el reglamento FCI. Decide en qué ORDEN conviene entrenar los grupos de habilidades de este perro y, dentro de cada grupo, sus habilidades.

Perro: ${pet.name}
Raza: ${pet.breed ?? "sin datos"}
Objetivo principal: ${pet.objective ?? "sin datos"}
Nivel: ${pet.level ?? "sin datos"}

Grupos y habilidades:
${groupLines}

Criterios, por orden de importancia:
1. Requisitos: una habilidad que es base de otra va antes. Por ejemplo: Sentado y Tumbado antes que Quieto; Quieto y la atención antes que la Llamada; las posiciones y el junto antes que los ejercicios de competición FCI.
2. Progreso: una habilidad con ${MASTERED_THRESHOLD}% o más se considera dominada y va al final de su grupo, como repaso.
3. Objetivo: si dos opciones son equivalentes, prioriza lo que acerca al objetivo principal del perro.
Ordena los grupos con la misma lógica: primero el grupo con lo que el perro necesita aprender antes.

A quién te diriges: ${audience}

Guarda el resultado con la herramienta ${TOOL_NAME}. Reglas:
- Incluye TODOS los grupos y TODAS sus habilidades, usando solo los ids de arriba.
- Cada grupo y cada habilidad llevan SIEMPRE dos motivos: reason_es (en español) y reason_en (en inglés).
- En reason_es y summary_es usa los nombres "es" de las habilidades; en reason_en y summary_en usa los nombres "en".
- Cada motivo: una sola frase, de 20 palabras como máximo, clara y práctica, dirigiéndote de tú.
- No inventes datos que no aparezcan arriba.`;
}

async function askAI(apiKey: string, prompt: string): Promise<unknown | null> {
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 6000,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Guarda el orden de entrenamiento recomendado, con motivos en español y en inglés.",
        input_schema: {
          type: "object",
          properties: {
            summary_es: {
              type: "string",
              description: "1-2 frases en español con la lógica general del orden.",
            },
            summary_en: {
              type: "string",
              description: "The same summary, in English.",
            },
            next_skill_id: {
              type: "integer",
              description: "Id de la habilidad a trabajar en la próxima sesión.",
            },
            groups: {
              type: "array",
              description: "Todos los grupos, en el orden recomendado.",
              items: {
                type: "object",
                properties: {
                  group_id: { type: "integer" },
                  reason_es: { type: "string" },
                  reason_en: { type: "string" },
                  skills: {
                    type: "array",
                    description:
                      "Todas las habilidades del grupo, en el orden recomendado.",
                    items: {
                      type: "object",
                      properties: {
                        skill_id: { type: "integer" },
                        reason_es: { type: "string" },
                        reason_en: { type: "string" },
                      },
                      required: ["skill_id", "reason_es", "reason_en"],
                    },
                  },
                },
                required: ["group_id", "reason_es", "reason_en", "skills"],
              },
            },
          },
          required: ["summary_es", "summary_en", "next_skill_id", "groups"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = message.content.find((block) => block.type === "tool_use");

  // Solo en local: ver qué devuelve la IA exactamente
  if (IS_DEV) {
    console.log("[training-order] stop_reason:", message.stop_reason);
    console.log(
      "[training-order] Respuesta de la IA:\n",
      toolBlock && toolBlock.type === "tool_use"
        ? JSON.stringify(toolBlock.input, null, 2)
        : "(sin respuesta de la herramienta)"
    );
  }

  if (!toolBlock || toolBlock.type !== "tool_use") {
    return null;
  }

  return toolBlock.input;
}

export async function POST(request: Request) {
  let body: { petId?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const petId = Number(body.petId);

  if (!Number.isInteger(petId)) {
    return NextResponse.json({ error: "bad_pet_id" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, breed, objective, level")
    .eq("id", petId)
    .eq("user_id", user.id)
    .single();

  if (!pet) {
    return NextResponse.json({ error: "no_pet" }, { status: 404 });
  }

  // --- Grupos y habilidades de la mascota ---

  const { data: groupRows } = await supabase
    .from("skill_groups")
    .select("id, name")
    .eq("pet_id", petId)
    .order("created_at", { ascending: true });

  const groupsList = groupRows ?? [];

  if (groupsList.length === 0) {
    return NextResponse.json({ error: "no_groups" }, { status: 400 });
  }

  const { data: itemRows } = await supabase
    .from("skill_group_items")
    .select("group_id, skill_id")
    .in(
      "group_id",
      groupsList.map((group) => group.id)
    );

  const items = itemRows ?? [];
  const skillIds = Array.from(new Set(items.map((item) => item.skill_id)));

  const { data: skillRows } =
    skillIds.length > 0
      ? await supabase
          .from("skills")
          .select("id, name, name_en, category")
          .in("id", skillIds)
      : { data: [] };

  const { data: petSkillRows } = await supabase
    .from("pet_skills")
    .select("skill_id, auto_progress, is_goal")
    .eq("pet_id", petId);

  const { data: completedRows } = await supabase
    .from("trainings")
    .select("skill_id")
    .eq("pet_id", petId)
    .eq("user_id", user.id)
    .eq("status", "completed");

  const skillsById = new Map((skillRows ?? []).map((skill) => [skill.id, skill]));
  const petSkillById = new Map(
    (petSkillRows ?? []).map((row) => [row.skill_id, row])
  );

  const sessionsBySkill = new Map<number, number>();
  for (const row of completedRows ?? []) {
    if (row.skill_id === null || row.skill_id === undefined) {
      continue;
    }
    sessionsBySkill.set(row.skill_id, (sessionsBySkill.get(row.skill_id) ?? 0) + 1);
  }

  const inputGroups: OrderInputGroup[] = groupsList.map((group) => ({
    groupId: group.id,
    name: group.name,
    skills: items
      .filter((item) => item.group_id === group.id)
      .map((item) => {
        const skill = skillsById.get(item.skill_id);
        const petSkill = petSkillById.get(item.skill_id);

        return {
          skillId: item.skill_id,
          name: skill?.name ?? `#${item.skill_id}`,
          nameEn: skill?.name_en ?? null,
          category: skill?.category ?? null,
          progress: petSkill?.auto_progress ?? 0,
          sessionCount: sessionsBySkill.get(item.skill_id) ?? 0,
          isGoal: petSkill?.is_goal ?? false,
        };
      }),
  }));

  // --- IA, con orden local de respaldo ---

  let order: TrainingOrderData = buildLocalOrder(inputGroups);
  let usedFallback = true;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const accountType = await getCurrentAccountType();
      const audience = getAudienceInstructions(accountType, false);

      const raw = await askAI(
        apiKey,
        buildPrompt(
          {
            name: pet.name,
            breed: pet.breed ?? null,
            objective: pet.objective ?? null,
            level: pet.level ?? null,
          },
          inputGroups,
          audience
        )
      );

      const sanitized = sanitizeOrder(raw, inputGroups);

      if (sanitized) {
        order = sanitized;
        usedFallback = false;
      }
    } catch (error) {
      console.error("Error llamando a la IA (training-order):", error);
    }
  }

  // --- Guardar (uno por mascota: se sobrescribe al recalcular) ---

  const updatedAt = new Date().toISOString();

  const { error: saveError } = await supabase
    .from("training_order_recommendations")
    .upsert(
      {
        pet_id: petId,
        user_id: user.id,
        data: order,
        used_fallback: usedFallback,
        updated_at: updatedAt,
      },
      { onConflict: "pet_id" }
    );

  if (saveError) {
    console.error("Error guardando el orden recomendado:", saveError);
  }

  return NextResponse.json({
    order,
    usedFallback,
    updatedAt,
    saved: !saveError,
  });
}