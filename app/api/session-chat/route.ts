import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { getAudienceInstructions } from "@/lib/account-type";
import { getCurrentAccountType } from "@/lib/account-type-server";
import {
  CHAT_MAX_LENGTH,
  guideToPlainText,
  parseStoredGuide,
  type ChatMessage,
} from "@/lib/session-guide";

// Se ejecuta en el servidor: la clave de la IA nunca llega al navegador.
export const runtime = "nodejs";
export const maxDuration = 60;

// Cuántos mensajes anteriores se mandan a la IA como contexto
const HISTORY_LIMIT = 20;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: { trainingId?: unknown; message?: unknown; locale?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const trainingId = Number(body.trainingId);
  const isEn = body.locale === "en";
  const question = typeof body.message === "string" ? body.message.trim() : "";

  if (!Number.isInteger(trainingId)) {
    return NextResponse.json({ error: "bad_training_id" }, { status: 400 });
  }

  if (question.length === 0 || question.length > CHAT_MAX_LENGTH) {
    return NextResponse.json({ error: "bad_message" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- Contexto: entrenamiento, perro, habilidad, progreso y guía ---

  const { data: training } = await supabase
    .from("trainings")
    .select("id, pet_id, skill_id, duration")
    .eq("id", trainingId)
    .eq("user_id", user.id)
    .single();

  if (!training || training.pet_id === null || training.skill_id === null) {
    return NextResponse.json({ error: "no_training" }, { status: 404 });
  }

  const { data: pet } = await supabase
    .from("pets")
    .select("name, breed, level, objective")
    .eq("id", training.pet_id)
    .eq("user_id", user.id)
    .single();

  const { data: skill } = await supabase
    .from("skills")
    .select("name, name_en")
    .eq("id", training.skill_id)
    .single();

  if (!pet || !skill) {
    return NextResponse.json({ error: "no_data" }, { status: 404 });
  }

  const { data: petSkill } = await supabase
    .from("pet_skills")
    .select("auto_progress")
    .eq("pet_id", training.pet_id)
    .eq("skill_id", training.skill_id)
    .maybeSingle();

  const { data: guideRow } = await supabase
    .from("training_guides")
    .select("data")
    .eq("training_id", trainingId)
    .maybeSingle();

  const guide = guideRow ? parseStoredGuide(guideRow.data) : null;

  // Últimos mensajes, en orden cronológico
  const { data: historyRows } = await supabase
    .from("training_chat_messages")
    .select("role, content")
    .eq("training_id", trainingId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = (historyRows ?? [])
    .reverse()
    .filter(
      (row): row is { role: "user" | "assistant"; content: string } =>
        row.role === "user" || row.role === "assistant"
    );

  // La conversación con la IA debe empezar por un mensaje del usuario
  while (history.length > 0 && history[0].role !== "user") {
    history.shift();
  }

  const skillName = isEn && skill.name_en ? skill.name_en : skill.name;
  const progress = petSkill?.auto_progress ?? 0;
  const noData = isEn ? "no data" : "sin datos";

  const accountType = await getCurrentAccountType();
  const audience = getAudienceInstructions(accountType, isEn);

  const system = isEn
    ? `You are an expert dog trainer helping during a training session. Answer the doubts the reader has about this session.

Dog: ${pet.name}
Breed: ${pet.breed ?? noData}
Level: ${pet.level ?? noData}
Main goal: ${pet.objective ?? noData}
Skill being trained: ${skillName}
Current progress: ${progress}% (80 or more = mastered)
Planned duration: ${training.duration != null ? `${training.duration} minutes` : noData}

Today's session guide:
${guide ? guideToPlainText(guide) : "No guide generated yet."}

Who you are writing for: ${audience}

Rules:
- Short, practical answers (maximum about 120 words), addressing the reader as "you". Write in English.
- Positive reinforcement only: never recommend punishment or physical corrections.
- If the doubt is about health, pain or serious aggression, recommend seeing a vet or a qualified professional.
- If you don't know something or it isn't in the data, say so; don't invent it.`
    : `Eres un adiestrador canino experto que ayuda durante una sesión de entrenamiento. Responde las dudas de quien te escribe sobre esta sesión.

Perro: ${pet.name}
Raza: ${pet.breed ?? noData}
Nivel: ${pet.level ?? noData}
Objetivo principal: ${pet.objective ?? noData}
Habilidad que se entrena: ${skillName}
Progreso actual: ${progress}% (80 o más = dominada)
Duración prevista: ${training.duration != null ? `${training.duration} minutos` : noData}

Guía de la sesión de hoy:
${guide ? guideToPlainText(guide) : "Todavía no se ha generado la guía."}

A quién te diriges: ${audience}

Reglas:
- Respuestas cortas y prácticas (máximo unas 120 palabras), dirigiéndote de tú. Escribe en español.
- Solo refuerzo positivo: nunca recomiendes castigos ni correcciones físicas.
- Si la duda es de salud, dolor o agresividad seria, recomienda acudir al veterinario o a un profesional cualificado.
- Si no sabes algo o no está en los datos, dilo; no lo inventes.`;

  let answer = "";

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system,
      messages: [
        ...history.map((row) => ({ role: row.role, content: row.content })),
        { role: "user" as const, content: question },
      ],
    });

    answer = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  } catch (error) {
    console.error("Error llamando a la IA (session-chat):", error);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }

  if (!answer) {
    return NextResponse.json({ error: "empty_answer" }, { status: 502 });
  }

  // --- Guardar la pregunta y la respuesta (solo si la IA ha respondido) ---

  const { data: savedRows, error: saveError } = await supabase
    .from("training_chat_messages")
    .insert([
      {
        training_id: trainingId,
        user_id: user.id,
        role: "user",
        content: question,
      },
      {
        training_id: trainingId,
        user_id: user.id,
        role: "assistant",
        content: answer.slice(0, 4000),
      },
    ])
    .select("id, role, content, created_at");

  if (saveError) {
    console.error("Error guardando el chat:", saveError);
  }

  const messages: ChatMessage[] = (savedRows ?? [])
    .filter(
      (row): row is typeof row & { role: "user" | "assistant" } =>
        row.role === "user" || row.role === "assistant"
    )
    .sort((a, b) => a.id - b.id)
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));

  return NextResponse.json({
    messages,
    saved: !saveError,
  });
}