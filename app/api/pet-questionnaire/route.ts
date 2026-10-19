import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";
import {
  MAX_PROPOSAL_GROUPS,
  MAX_SKILLS_PER_GROUP,
  buildLocalProposal,
  describeAnswers,
  sanitizeAnswers,
  sanitizeProposal,
  toQuestionnaireLocale,
  type CatalogSkill,
  type QuestionnaireAnswers,
  type QuestionnaireLocale,
  type QuestionnaireProposal,
} from "@/lib/pet-questionnaire";

// Se ejecuta en el servidor: la clave de la IA nunca llega al navegador.
export const runtime = "nodejs";

// La explicación no tiene límite de longitud y la IA puede tardar más de un
// minuto en escribirla. Vercel (Fluid) permite hasta 300 segundos.
export const maxDuration = 300;

// Tope de texto que puede escribir la IA. Si se alcanza, la respuesta llega
// cortada y se usa la propuesta local de respaldo.
const MAX_OUTPUT_TOKENS = 16000;

const IS_DEV = process.env.NODE_ENV !== "production";

const TOOL_NAME = "save_questionnaire_proposal";

type PetInfo = {
  name: string;
  breed: string | null;
  birthDate: string | null;
  sex: string | null;
  weight: string | null;
};

function describeAge(birthDate: string | null): string {
  if (!birthDate) return "sin datos";

  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();

  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());

  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) return "sin datos";
  if (months < 12) return `${months} meses`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years} años y ${rest} meses` : `${years} años`;
}

function buildPrompt(
  pet: PetInfo,
  answers: QuestionnaireAnswers,
  catalog: CatalogSkill[],
  existingGroupNames: string[],
  locale: QuestionnaireLocale,
  audience: string
): string {
  const catalogLines = catalog
    .map((skill) => {
      const nameEn = skill.nameEn ?? skill.name;
      const cat = skill.category ? ` | categoría: ${skill.category}` : "";
      const diff = skill.difficulty ? ` | dificultad: ${skill.difficulty}` : "";
      return `- id=${skill.id} | es: "${skill.name}" | en: "${nameEn}"${cat}${diff}`;
    })
    .join("\n");

  const languageRule =
    locale === "en"
      ? 'Escribe objective, summary, name y reason EN INGLÉS, usando los nombres "en" de las habilidades.'
      : 'Escribe objective, summary, name y reason EN ESPAÑOL, usando los nombres "es" de las habilidades.';

  const existing =
    existingGroupNames.length > 0
      ? existingGroupNames.map((name) => `"${name}"`).join(", ")
      : "ninguno";

  return `Eres un adiestrador canino experto en obediencia, incluido el reglamento FCI. Con las respuestas del cuestionario inicial, propón un plan de inicio para este perro.

Perro: ${pet.name}
Raza: ${pet.breed ?? "sin datos"}
Edad: ${describeAge(pet.birthDate)}
Sexo: ${pet.sex ?? "sin datos"}
Peso: ${pet.weight ?? "sin datos"}

Respuestas del cuestionario:
${describeAnswers(answers, "es")}

Catálogo de habilidades disponibles (SOLO puedes usar estos ids):
${catalogLines}

Grupos que ya tiene este perro (no repitas sus nombres): ${existing}

Qué debes proponer:
1. objective: el objetivo principal del perro en UNA frase clara (máximo 25 palabras), basado en las respuestas. Es un dato que se guarda en su ficha, así que debe ser breve.
2. groups: entre 1 y ${MAX_PROPOSAL_GROUPS} grupos de habilidades, cada uno con 1 a ${MAX_SKILLS_PER_GROUP} habilidades del catálogo, agrupadas con sentido (por ejemplo: posiciones básicas, paseo, control, problemas de conducta, ejercicios FCI).
3. Prioriza lo que el perro necesita según su objetivo, sus problemas, sus miedos y su relación con perros y personas.
4. Lo que ya sabe hacer no hace falta incluirlo, salvo que sea requisito de algo importante (como repaso).
5. Adapta la cantidad al tiempo disponible y a la experiencia de quien entrena: con poco tiempo o primera vez, menos grupos y más sencillos.
6. Si el objetivo es competición FCI, incluye las bases (junto, posiciones, quieto, llamada) antes que los ejercicios avanzados.
7. summary: explicación DETALLADA y completa del plan, sin límite de longitud. Explica qué has visto en las respuestas, por qué el plan empieza por donde empieza, en qué orden conviene avanzar, cómo aprovechar lo que le motiva, cómo encajar las sesiones en el tiempo disponible, y qué precauciones tener con sus miedos, problemas o reactividad. Termina siempre con frases completas.
8. Cada grupo lleva reason: explicación detallada, sin límite de longitud, de por qué ese grupo es importante para este perro, por qué esas habilidades y qué conseguirá al dominarlas. Dirígete de tú.
9. Nombres de grupo cortos (máximo 4 palabras) y distintos entre sí.

Formato de summary y reason:
- Separa cada idea o parte en su propio párrafo, con un salto de línea entre párrafos.
- Cuando una parte tenga título (por ejemplo, cada fase del plan), ponlo al principio de su párrafo entre dobles asteriscos, así: **Fase 1 (semanas 1-3): Posiciones básicas** y después el texto.
- No uses negrita para nada más. No uses listas con guiones, almohadillas ni otros símbolos.

A quién te diriges: ${audience}

Idioma: ${languageRule}

Guarda el resultado con la herramienta ${TOOL_NAME}. No inventes habilidades ni ids que no estén en el catálogo.`;
}

async function askAI(apiKey: string, prompt: string): Promise<unknown | null> {
  const anthropic = new Anthropic({ apiKey });

  const startedAt = Date.now();

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: MAX_OUTPUT_TOKENS,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Guarda la propuesta inicial: objetivo, explicación detallada y grupos de habilidades del catálogo.",
        input_schema: {
          type: "object",
          properties: {
            objective: {
              type: "string",
              description: "Objetivo principal del perro, una sola frase breve.",
            },
            summary: {
              type: "string",
              description:
                "Explicación detallada y completa del plan, en párrafos separados por saltos de línea, sin límite de longitud.",
            },
            groups: {
              type: "array",
              description: "Grupos propuestos, en el orden recomendado.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  reason: {
                    type: "string",
                    description:
                      "Explicación detallada de por qué este grupo, en párrafos separados por saltos de línea, sin límite de longitud.",
                  },
                  skill_ids: {
                    type: "array",
                    items: { type: "integer" },
                  },
                },
                required: ["name", "reason", "skill_ids"],
              },
            },
          },
          required: ["objective", "summary", "groups"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: prompt }],
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  // Siempre (también en producción): resumen de la llamada para los logs de Vercel.
  console.log(
    `[pet-questionnaire] stop_reason=${message.stop_reason} output_tokens=${message.usage.output_tokens} segundos=${seconds}`
  );

  // Si la IA llegó al tope, la respuesta está cortada y no se puede usar.
  if (message.stop_reason === "max_tokens") {
    console.error(
      `[pet-questionnaire] La IA alcanzó el tope de ${MAX_OUTPUT_TOKENS} tokens: respuesta cortada, se usa la propuesta de respaldo.`
    );
    return null;
  }

  const toolBlock = message.content.find((block) => block.type === "tool_use");

  // Solo en local: ver qué devuelve la IA exactamente
  if (IS_DEV) {
    console.log(
      "[pet-questionnaire] Respuesta de la IA:\n",
      toolBlock && toolBlock.type === "tool_use"
        ? JSON.stringify(toolBlock.input, null, 2)
        : "(sin respuesta de la herramienta)"
    );
  }

  if (!toolBlock || toolBlock.type !== "tool_use") {
    console.error("[pet-questionnaire] La IA no devolvió la herramienta.");
    return null;
  }

  return toolBlock.input;
}

export async function POST(request: Request) {
  let body: { petId?: unknown; answers?: unknown; locale?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const petId = Number(body.petId);

  if (!Number.isInteger(petId)) {
    return NextResponse.json({ error: "bad_pet_id" }, { status: 400 });
  }

  const answers = sanitizeAnswers(body.answers);

  if (!answers) {
    return NextResponse.json({ error: "bad_answers" }, { status: 400 });
  }

  const locale = toQuestionnaireLocale(
    typeof body.locale === "string" ? body.locale : "es"
  );

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, breed, birth_date, sex, weight")
    .eq("id", petId)
    .eq("user_id", user.id)
    .single();

  if (!pet) {
    return NextResponse.json({ error: "no_pet" }, { status: 404 });
  }

  // --- Catálogo de habilidades ---

  const { data: skillRows, error: skillsError } = await supabase
    .from("skills")
    .select("id, name, name_en, category, category_en, difficulty")
    .order("id", { ascending: true });

  if (skillsError) {
    console.error("Error cargando el catálogo de habilidades:", skillsError);
  }

  const catalog: CatalogSkill[] = (skillRows ?? []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    nameEn: skill.name_en ?? null,
    category: skill.category ?? null,
    categoryEn: skill.category_en ?? null,
    difficulty: skill.difficulty ?? null,
  }));

  if (catalog.length === 0) {
    return NextResponse.json({ error: "no_catalog" }, { status: 500 });
  }

  const { data: groupRows } = await supabase
    .from("skill_groups")
    .select("name")
    .eq("pet_id", petId);

  const existingGroupNames = (groupRows ?? []).map((group) => group.name);

  // --- IA, con propuesta local de respaldo ---

  let proposal: QuestionnaireProposal = buildLocalProposal(answers, catalog, locale);
  let usedFallback = true;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[pet-questionnaire] Falta ANTHROPIC_API_KEY.");
  } else {
    try {
      const accountType = await getCurrentAccountType();
      const audience = getAudienceInstructions(accountType, false);

      const raw = await askAI(
        apiKey,
        buildPrompt(
          {
            name: pet.name,
            breed: pet.breed ?? null,
            birthDate: pet.birth_date ?? null,
            sex: pet.sex ?? null,
            weight: pet.weight ?? null,
          },
          answers,
          catalog,
          existingGroupNames,
          locale,
          audience
        )
      );

      if (raw) {
        const sanitized = sanitizeProposal(raw, catalog, locale);

        if (sanitized) {
          proposal = sanitized;
          usedFallback = false;
        } else {
          console.error(
            "[pet-questionnaire] La respuesta de la IA no pasó la validación; se usa la propuesta de respaldo."
          );
        }
      }
    } catch (error) {
      console.error("Error llamando a la IA (pet-questionnaire):", error);
    }
  }

  // --- Guardar respuestas y propuesta (borrador hasta que se acepte) ---

  const { error: saveError } = await supabase
    .from("pet_questionnaires")
    .upsert(
      {
        pet_id: petId,
        user_id: user.id,
        answers,
        proposal,
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pet_id" }
    );

  if (saveError) {
    console.error("Error guardando el cuestionario:", saveError);
  }

  // La pantalla necesita los nombres para mostrar las habilidades.
  const proposalSkillIds = new Set(proposal.groups.flatMap((group) => group.skillIds));
  const skills = catalog.filter((skill) => proposalSkillIds.has(skill.id));

  return NextResponse.json({
    proposal,
    skills,
    usedFallback,
    saved: !saveError,
  });
}