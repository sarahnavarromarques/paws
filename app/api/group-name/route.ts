import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Esta ruta se ejecuta en el servidor de Next.js, nunca en el navegador.
// Por eso la clave de la API queda oculta y segura aquí.
export const runtime = "nodejs";

type SkillInput = {
  id: number;
  name: string;
  category: string | null;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Si todavía no hay clave configurada, avisamos al frontend
  // para que use su generador de reserva. La app nunca se rompe.
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: { skills?: SkillInput[]; avoid?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const skills = Array.isArray(body.skills) ? body.skills : [];
  const avoid = Array.isArray(body.avoid) ? body.avoid : [];

  if (skills.length === 0) {
    return NextResponse.json({ error: "no_skills" }, { status: 400 });
  }

  const skillList = skills
    .map((s) => (s.category ? `${s.name} (${s.category})` : s.name))
    .join(", ");

  const avoidList = avoid.length > 0 ? avoid.join(", ") : "ninguno";

  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 30,
      messages: [
        {
          role: "user",
          content: `Eres un asistente que inventa nombres cortos y atractivos para grupos de habilidades de adiestramiento canino.

Habilidades del grupo: ${skillList}

Nombres ya usados que NO puedes repetir: ${avoidList}

Devuelve SOLO un nombre para este grupo, en español, de 1 a 3 palabras, sin comillas, sin punto final y sin explicaciones. Que sea claro y refleje el contenido del grupo.`,
        },
      ],
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "");

    if (!text) {
      return NextResponse.json({ error: "empty" }, { status: 502 });
    }

    return NextResponse.json({ name: text });
  } catch (error) {
    console.error("Error llamando a la IA:", error);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}