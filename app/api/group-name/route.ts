import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAiUser, recordAiUsage } from "@/lib/ai-usage";
import { hasHuesitosFor, spendHuesitos } from "@/lib/huesitos";

// Esta ruta se ejecuta en el servidor de Next.js, nunca en el navegador.
// Por eso la clave de la API queda oculta y segura aquí.
export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";
const FEATURE = "group-name" as const;

type SkillInput = {
  id: number;
  name: string;
  category: string | null;
};

export async function POST(request: Request) {
  // Solo usuarios conectados pueden usar la IA.
  const aiUser = await getAiUser();
  if (!aiUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { supabase, userId } = aiUser;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Si todavía no hay clave configurada, avisamos al frontend
  // para que use su generador de reserva. La app nunca se rompe.
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: { skills?: SkillInput[]; avoid?: string[]; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const skills = Array.isArray(body.skills) ? body.skills : [];
  const avoid = Array.isArray(body.avoid) ? body.avoid : [];
  const locale = body.locale === "en" ? "en" : "es";

  if (skills.length === 0) {
    return NextResponse.json({ error: "no_skills" }, { status: 400 });
  }

  // Sin huesitos suficientes: el frontend usa su generador local.
  if (!(await hasHuesitosFor(supabase, userId, FEATURE))) {
    return NextResponse.json({ error: "no_huesitos" }, { status: 402 });
  }

  const skillList = skills
    .map((s) => (s.category ? `${s.name} (${s.category})` : s.name))
    .join(", ");

  const avoidList =
    avoid.length > 0 ? avoid.join(", ") : locale === "en" ? "none" : "ninguno";

  const anthropic = new Anthropic({ apiKey });

  const prompt =
    locale === "en"
      ? `You are an assistant that comes up with short, appealing names for dog-training skill groups.

Skills in this group: ${skillList}

Names already used that you must NOT repeat: ${avoidList}

Return ONLY a name for this group, in English, 1 to 3 words, no quotes, no trailing period and no explanations. It should be clear and reflect the content of the group.`
      : `Eres un asistente que inventa nombres cortos y atractivos para grupos de habilidades de adiestramiento canino.

Habilidades del grupo: ${skillList}

Nombres ya usados que NO puedes repetir: ${avoidList}

Devuelve SOLO un nombre para este grupo, en español, de 1 a 3 palabras, sin comillas, sin punto final y sin explicaciones. Que sea claro y refleje el contenido del grupo.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 30,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Registramos el coste real de esta llamada.
    await recordAiUsage({
      supabase,
      userId,
      feature: FEATURE,
      model: MODEL,
      usage: message.usage,
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

    // La IA ha respondido bien: se cobran los huesitos.
    const huesitos = await spendHuesitos(supabase, FEATURE);

    return NextResponse.json({ name: text, huesitos });
  } catch (error) {
    console.error("Error llamando a la IA:", error);
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}