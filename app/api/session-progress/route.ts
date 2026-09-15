import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Se ejecuta en el servidor de Next.js. La clave queda oculta aquí.
export const runtime = "nodejs";

type Answers = {
  attempts: number;
  successes: number;
  distraction: "baja" | "media" | "alta";
  mood: "bajo" | "normal" | "alto";
};

type Body = {
  skillName?: string;
  category?: string | null;
  currentProgress?: number;
  petName?: string;
  petBreed?: string | null;
  petAge?: string | null;
  duration?: number | null;
  answers?: Answers;
};

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

  if (!skillName || !answers) {
    return NextResponse.json({ error: "missing_data" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  const catText = category ? `${category} — ` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Eres un experto en adiestramiento canino. Tienes que decidir el nuevo nivel de progreso (0 a 100) de una habilidad después de una sesión de entrenamiento.

Perro: ${body.petName ?? "sin nombre"}
Raza: ${body.petBreed ?? "sin datos"}
Edad: ${body.petAge ?? "sin datos"}
Habilidad entrenada: ${catText}${skillName}
Progreso actual de la habilidad: ${current}%
Duración de la sesión: ${body.duration != null ? `${body.duration} minutos` : "sin datos"}

Cómo ha ido la sesión:
- Intentos totales: ${answers.attempts}
- Aciertos: ${answers.successes}
- Nivel de distracción del entorno: ${answers.distraction}
- Estado de ánimo del perro: ${answers.mood}

Reglas:
- El progreso evoluciona poco a poco. Sube si la sesión fue buena, se mantiene o baja ligeramente si fue mala. Nunca des saltos enormes en una sola sesión (máximo unos 15 puntos arriba o abajo).
- Una buena tasa de aciertos con distracción alta vale más que con distracción baja.
- El resultado debe estar entre 0 y 100.

Responde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código. Formato exacto:
{"newProgress": número entero entre 0 y 100, "comentario": "una frase corta con el siguiente paso a trabajar"}

Escribe el comentario en español, dirigiéndote al adiestrador de tú.`,
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