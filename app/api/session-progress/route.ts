import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";

// Se ejecuta en el servidor de Next.js. La clave queda oculta aquí.
export const runtime = "nodejs";

// Cuántas preguntas del chat se pasan como contexto, y su longitud máxima
const CHAT_CONTEXT_LIMIT = 10;
const CHAT_CONTEXT_MAX_CHARS = 300;

type Answers = {
  attempts: number;
  successes: number;
  distraction: "baja" | "media" | "alta";
  mood: "bajo" | "normal" | "alto";
};

type Body = {
  trainingId?: number;
  skillName?: string;
  category?: string | null;
  currentProgress?: number;
  petName?: string;
  petBreed?: string | null;
  petAge?: string | null;
  duration?: number | null;
  locale?: string;
  answers?: Answers;
};

const DISTRACTION_LABELS: Record<string, { es: string; en: string }> = {
  baja: { es: "baja", en: "low" },
  media: { es: "media", en: "medium" },
  alta: { es: "alta", en: "high" },
};

const MOOD_LABELS: Record<string, { es: string; en: string }> = {
  bajo: { es: "bajo", en: "low" },
  normal: { es: "normal", en: "normal" },
  alto: { es: "alto", en: "high" },
};

// Preguntas que el usuario hizo en el chat de esta sesión (solo las suyas).
// Si algo falla, devuelve una lista vacía: el progreso se calcula igual.
async function loadChatQuestions(trainingId: number | undefined): Promise<string[]> {
  if (typeof trainingId !== "number" || !Number.isInteger(trainingId)) {
    return [];
  }

  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("training_chat_messages")
      .select("content")
      .eq("training_id", trainingId)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(CHAT_CONTEXT_LIMIT);

    return (data ?? []).map((row) =>
      row.content.length > CHAT_CONTEXT_MAX_CHARS
        ? `${row.content.slice(0, CHAT_CONTEXT_MAX_CHARS)}…`
        : row.content
    );
  } catch (error) {
    console.error("Error leyendo el chat (session-progress):", error);
    return [];
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const skillName = body.skillName ?? "";
  const category = body.category ?? null;
  const current =
    typeof body.currentProgress === "number" ? body.currentProgress : 0;
  const answers = body.answers;
  const locale = body.locale === "en" ? "en" : "es";

  if (!skillName || !answers) {
    return NextResponse.json({ error: "missing_data" }, { status: 400 });
  }

  // Tipo de cuenta del usuario: solo cambia el tono del comentario
  const accountType = await getCurrentAccountType();
  const audience = getAudienceInstructions(accountType, locale === "en");

  const chatQuestions = await loadChatQuestions(body.trainingId);

  const anthropic = new Anthropic({ apiKey });

  const catText = category ? `${category} — ` : "";
  const distractionLabel =
    DISTRACTION_LABELS[answers.distraction]?.[locale] ?? answers.distraction;
  const moodLabel = MOOD_LABELS[answers.mood]?.[locale] ?? answers.mood;

  const chatBlockEn =
    chatQuestions.length > 0
      ? `

Questions the reader asked during the session (context only):
${chatQuestions.map((q) => `- ${q}`).join("\n")}
Use them only as context (for example, to understand difficulties). The progress is based mainly on the answers above.`
      : "";

  const chatBlockEs =
    chatQuestions.length > 0
      ? `

Preguntas que hizo durante la sesión (solo como contexto):
${chatQuestions.map((q) => `- ${q}`).join("\n")}
Úsalas solo como contexto (por ejemplo, para entender las dificultades). El progreso se basa sobre todo en las respuestas de arriba.`
      : "";

  const prompt =
    locale === "en"
      ? `You are an expert in dog training. You need to decide the new progress level (0 to 100) for a skill after a training session.

Dog: ${body.petName ?? "no name"}
Breed: ${body.petBreed ?? "no data"}
Age: ${body.petAge ?? "no data"}
Skill trained: ${catText}${skillName}
Current skill progress: ${current}%
Session duration: ${body.duration != null ? `${body.duration} minutes` : "no data"}

How the session went:
- Total attempts: ${answers.attempts}
- Successes: ${answers.successes}
- Environment distraction level: ${distractionLabel}
- Dog's mood: ${moodLabel}${chatBlockEn}

Rules:
- Progress evolves gradually. It goes up if the session was good, stays about the same, or drops slightly if it was bad. Never make huge jumps in a single session (max about 15 points up or down).
- A good success rate with high distraction is worth more than the same rate with low distraction.
- The result must be between 0 and 100.

Who you are writing the comment for: ${audience}
This only affects how the comment is written, never how progress is calculated.

Respond ONLY with a valid JSON object, no extra text or code blocks. Exact format:
{"newProgress": integer between 0 and 100, "comentario": "a short sentence with the next step to work on"}

Write the comment in English, addressing the reader directly as "you".`
      : `Eres un experto en adiestramiento canino. Tienes que decidir el nuevo nivel de progreso (0 a 100) de una habilidad después de una sesión de entrenamiento.

Perro: ${body.petName ?? "sin nombre"}
Raza: ${body.petBreed ?? "sin datos"}
Edad: ${body.petAge ?? "sin datos"}
Habilidad entrenada: ${catText}${skillName}
Progreso actual de la habilidad: ${current}%
Duración de la sesión: ${body.duration != null ? `${body.duration} minutos` : "sin datos"}

Cómo ha ido la sesión:
- Intentos totales: ${answers.attempts}
- Aciertos: ${answers.successes}
- Nivel de distracción del entorno: ${distractionLabel}
- Estado de ánimo del perro: ${moodLabel}${chatBlockEs}

Reglas:
- El progreso evoluciona poco a poco. Sube si la sesión fue buena, se mantiene o baja ligeramente si fue mala. Nunca des saltos enormes en una sola sesión (máximo unos 15 puntos arriba o abajo).
- Una buena tasa de aciertos con distracción alta vale más que con distracción baja.
- El resultado debe estar entre 0 y 100.

Para quién escribes el comentario: ${audience}
Esto solo afecta a cómo está escrito el comentario, nunca a cómo se calcula el progreso.

Responde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código. Formato exacto:
{"newProgress": número entero entre 0 y 100, "comentario": "una frase corta con el siguiente paso a trabajar"}

Escribe el comentario en español, dirigiéndote de tú a quien lo lee.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed: { newProgress?: unknown; comentario?: unknown } | null = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed.newProgress !== "number") {
      return NextResponse.json({ error: "bad_ai_response" }, { status: 502 });
    }

    let newProgress = Math.round(parsed.newProgress);
    if (newProgress < 0) newProgress = 0;
    if (newProgress > 100) newProgress = 100;

    return NextResponse.json({
      result: {
        newProgress,
        comentario:
          typeof parsed.comentario === "string" ? parsed.comentario : "",
      },
    });
  } catch (error) {
    console.error("Error llamando a la IA (session-progress):", error);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}