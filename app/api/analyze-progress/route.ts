import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Esta ruta se ejecuta en el servidor de Next.js, nunca en el navegador.
// La clave de la API queda oculta y segura aquí.
export const runtime = "nodejs";

type SkillInput = {
  name: string;
  category: string | null;
  progress: number;
  sessionCount: number;
  lastTrainedDays: number | null;
  isGoal: boolean;
};

type TrainingInput = {
  title: string | null;
  date: string | null;
  duration: number | null;
  notes: string | null;
};

type PetInput = {
  name: string;
  breed: string | null;
  objective: string | null;
  level: string | null;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Si no hay clave, avisamos para que el frontend use su resumen local.
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: {
    pet?: PetInput;
    skills?: SkillInput[];
    trainings?: TrainingInput[];
    locale?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const pet = body.pet;
  const skills = Array.isArray(body.skills) ? body.skills : [];
  const trainings = Array.isArray(body.trainings) ? body.trainings : [];
  const isEn = body.locale === "en";

  if (!pet || !pet.name) {
    return NextResponse.json({ error: "no_pet" }, { status: 400 });
  }

  const noSkillsText = isEn ? "No skills recorded." : "Sin habilidades registradas.";
  const noSessionsRecordedText = isEn
    ? "No sessions recorded."
    : "Sin sesiones registradas.";
  const noSessionsForSkillText = isEn ? "no sessions" : "sin sesiones";
  const daysAgoText = (days: number) =>
    isEn ? `${days} days ago` : `hace ${days} días`;
  const goalTag = isEn ? " [MAIN GOAL]" : " [OBJETIVO PRINCIPAL]";
  const noDateText = isEn ? "no date" : "sin fecha";
  const noDurationText = isEn ? "no duration" : "sin duración";
  const notesPrefix = isEn ? " — Notes: " : " — Notas: ";
  const defaultSessionTitle = isEn ? "Session" : "Sesión";
  const noDataText = isEn ? "no data" : "sin datos";
  const fallbackText = isEn
    ? "Could not generate the analysis."
    : "No se pudo generar el análisis.";

  const skillLines =
    skills.length > 0
      ? skills
          .map((s) => {
            const cat = s.category ? `${s.category} — ` : "";
            const last =
              s.lastTrainedDays === null
                ? noSessionsForSkillText
                : daysAgoText(s.lastTrainedDays);
            const goal = s.isGoal ? goalTag : "";
            return isEn
              ? `- ${cat}${s.name}: ${s.progress}%, ${s.sessionCount} sessions, last ${last}${goal}`
              : `- ${cat}${s.name}: ${s.progress}%, ${s.sessionCount} sesiones, última ${last}${goal}`;
          })
          .join("\n")
      : noSkillsText;

  const trainingLines =
    trainings.length > 0
      ? trainings
          .map((t) => {
            const d = t.date ?? noDateText;
            const dur =
              t.duration != null ? `${t.duration} min` : noDurationText;
            const notes = t.notes ? `${notesPrefix}${t.notes}` : "";
            return `- ${d}: ${t.title ?? defaultSessionTitle} (${dur})${notes}`;
          })
          .join("\n")
      : noSessionsRecordedText;

  const anthropic = new Anthropic({ apiKey });

  const promptEs = `Eres un analista experto en adiestramiento canino. Analiza el progreso de este perro basándote SOLO en los datos que te doy.

Perro: ${pet.name}
Raza: ${pet.breed ?? noDataText}
Objetivo principal: ${pet.objective ?? noDataText}
Nivel: ${pet.level ?? noDataText}

Habilidades:
${skillLines}

Sesiones recientes (de más nueva a más antigua):
${trainingLines}

Responde SOLO con un objeto JSON válido, sin texto adicional y sin bloques de código. Formato exacto:
{"resumen":"2-3 frases sobre el estado general del progreso","patrones":"qué está funcionando y qué se resiste, según los datos","recomendacion":"el siguiente paso concreto a trabajar"}

Escribe en español, dirigiéndote al adiestrador de tú, claro y práctico. No inventes datos que no aparezcan arriba.`;

  const promptEn = `You are an expert dog training analyst. Analyze this dog's progress based ONLY on the data provided.

Dog: ${pet.name}
Breed: ${pet.breed ?? noDataText}
Main goal: ${pet.objective ?? noDataText}
Level: ${pet.level ?? noDataText}

Skills:
${skillLines}

Recent sessions (newest to oldest):
${trainingLines}

Reply ONLY with a valid JSON object, no extra text and no code blocks. Exact format:
{"resumen":"2-3 sentences on the overall state of progress","patrones":"what's working and what's resisting, based on the data","recomendacion":"the concrete next step to work on"}

Write in English, addressing the trainer directly, clear and practical. Don't invent data that isn't listed above.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: isEn ? promptEn : promptEs,
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

    let parsed: {
      resumen?: unknown;
      patrones?: unknown;
      recomendacion?: unknown;
    } | null = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed.resumen !== "string") {
      // Modo degradado: si la IA no devolvió JSON, mostramos su texto tal cual.
      return NextResponse.json({
        analysis: {
          resumen: raw || fallbackText,
          patrones: "",
          recomendacion: "",
        },
      });
    }

    return NextResponse.json({
      analysis: {
        resumen: String(parsed.resumen ?? ""),
        patrones: typeof parsed.patrones === "string" ? parsed.patrones : "",
        recomendacion:
          typeof parsed.recomendacion === "string" ? parsed.recomendacion : "",
      },
    });
  } catch (error) {
    console.error("Error llamando a la IA (analyze-progress):", error);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}