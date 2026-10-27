import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";
import { getAiUser, recordAiUsage } from "@/lib/ai-usage";
import { hasHuesitosFor, spendHuesitos, type SpendResult } from "@/lib/huesitos";
import {
  MASTERED_THRESHOLD,
  buildLocalOrder,
  sanitizeOrder,
  type OrderInputGroup,
  type TrainingOrderData,
} from "@/lib/training-order";

// Se ejecuta en el servidor: la clave de la IA nunca llega al navegador.
export const runtime = "nodejs";

// La IA tarda unos 20-30 s en ordenar muchos grupos (y puede haber un
// segundo intento): margen para Vercel.
export const maxDuration = 120;

// Intentos con la IA si la respuesta llega con un formato que no se puede usar.
const MAX_ATTEMPTS = 2;

const MODEL = "claude-haiku-4-5";
const FEATURE = "training-order" as const;

const IS_DEV = process.env.NODE_ENV !== "production";

const TOOL_NAME = "save_training_order";

// Aviso que se añade en el segundo intento
const RETRY_NOTE = `

IMPORTANTE: en el intento anterior la respuesta llegó con un formato que no se pudo usar. "groups" debe ser una LISTA (array) de objetos y, dentro de cada grupo, "skills" también debe ser una LISTA de objetos, nunca un texto. Incluye todos los grupos y todas las habilidades. Dentro de los textos no uses comillas dobles: usa comillas angulares « ».`;

type AiUser = NonNullable<Awaited<ReturnType<typeof getAiUser>>>;

type PetInfo = {
  name: string;
  breed: string | null;
  objective: string | null;
  level: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Si la IA devuelve una lista como texto, intenta convertirla en lista real.
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

// Repara el formato de la respuesta antes de validarla
function normalizeOrderInput(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const groups = parseMaybeJson(input.groups);

  return {
    ...input,
    groups: Array.isArray(groups)
      ? groups.map((group) => {
          const parsedGroup = parseMaybeJson(group);
          if (!isRecord(parsedGroup)) return parsedGroup;

          const skills = parseMaybeJson(parsedGroup.skills);

          return {
            ...parsedGroup,
            skills: Array.isArray(skills)
              ? skills.map((skill) => parseMaybeJson(skill))
              : skills,
          };
        })
      : groups,
  };
}

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
- Dentro de los textos NO uses comillas dobles. Para citar una habilidad usa comillas angulares, así: «Sentado».
- "groups" es una LISTA (array) de objetos y "skills" de cada grupo también es una LISTA de objetos. Nunca los envíes como texto.
- No inventes datos que no aparezcan arriba.`;
}

async function askAI(
  apiKey: string,
  prompt: string,
  aiUser: AiUser
): Promise<unknown | null> {
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: MODEL,
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
              description:
                "Todos los grupos, en el orden recomendado. Lista (array) de objetos, nunca un texto.",
              items: {
                type: "object",
                properties: {
                  group_id: { type: "integer" },
                  reason_es: { type: "string" },
                  reason_en: { type: "string" },
                  skills: {
                    type: "array",
                    description:
                      "Todas las habilidades del grupo, en el orden recomendado. Lista (array) de objetos, nunca un texto.",
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

  // Registramos el coste real de esta llamada, aunque luego la respuesta no sirva.
  await recordAiUsage({
    supabase: aiUser.supabase,
    userId: aiUser.userId,
    feature: FEATURE,
    model: MODEL,
    usage: message.usage,
  });

  // Siempre (también en producción): resumen de la llamada para los logs de Vercel.
  console.log(
    `[training-order] stop_reason=${message.stop_reason} output_tokens=${message.usage.output_tokens}`
  );

  if (message.stop_reason === "max_tokens") {
    console.error("[training-order] La IA alcanzó el tope de tokens: respuesta cortada.");
    return null;
  }

  const toolBlock = message.content.find((block) => block.type === "tool_use");

  // Solo en local: ver qué devuelve la IA exactamente
  if (IS_DEV) {
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

  return normalizeOrderInput(toolBlock.input);
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

  // Solo usuarios conectados pueden usar la IA.
  const aiUser = await getAiUser();

  if (!aiUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { supabase, userId } = aiUser;

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, breed, objective, level")
    .eq("id", petId)
    .eq("user_id", userId)
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
    .eq("user_id", userId)
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

  // --- ¿Es el primer orden de este perro hecho por la IA? Entonces es gratis ---

  const { data: existingOrder } = await supabase
    .from("training_order_recommendations")
    .select("used_fallback")
    .eq("pet_id", petId)
    .maybeSingle();

  const isFirstAiOrder = !existingOrder || existingOrder.used_fallback === true;

  // --- IA, con orden local de respaldo ---

  let order: TrainingOrderData = buildLocalOrder(inputGroups);
  let usedFallback = true;
  let huesitos: SpendResult | null = null;

  // Sin huesitos suficientes (y sin ser el primero gratis): orden local.
  const canPay =
    isFirstAiOrder || (await hasHuesitosFor(supabase, userId, FEATURE));
  const noHuesitos = !canPay;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && canPay) {
    const accountType = await getCurrentAccountType();
    const audience = getAudienceInstructions(accountType, false);

    const prompt = buildPrompt(
      {
        name: pet.name,
        breed: pet.breed ?? null,
        objective: pet.objective ?? null,
        level: pet.level ?? null,
      },
      inputGroups,
      audience
    );

    // Hasta 2 intentos: si la primera respuesta no se puede usar, se repite
    // avisando a la IA del problema. Solo se cobra una vez, si sale bien.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await askAI(
          apiKey,
          attempt === 1 ? prompt : `${prompt}${RETRY_NOTE}`,
          aiUser
        );

        const sanitized = raw ? sanitizeOrder(raw, inputGroups) : null;

        if (sanitized) {
          order = sanitized;
          usedFallback = false;
          break;
        }

        console.error(
          `[training-order] Intento ${attempt}: la respuesta de la IA no se pudo usar.`
        );
      } catch (error) {
        console.error(
          `[training-order] Intento ${attempt}: error llamando a la IA:`,
          error
        );
      }
    }

    // La IA ha respondido bien: se cobran los huesitos (una sola vez),
    // salvo que sea el primer orden de este perro, que es gratis.
    if (!usedFallback && !isFirstAiOrder) {
      huesitos = await spendHuesitos(supabase, FEATURE);
    }
  }

  // --- Guardar (uno por mascota: se sobrescribe al recalcular) ---

  const updatedAt = new Date().toISOString();

  const { error: saveError } = await supabase
    .from("training_order_recommendations")
    .upsert(
      {
        pet_id: petId,
        user_id: userId,
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
    noHuesitos,
    huesitos,
    freeFirstOrder: isFirstAiOrder && !usedFallback,
    updatedAt,
    saved: !saveError,
  });
}