import OpenAI from "openai";
import { NextResponse } from "next/server";

const BREEDS = [
  "Mestizo",
  "Labrador Retriever",
  "Golden Retriever",
  "Pastor Alemán",
  "Bulldog Francés",
  "Bulldog Inglés",
  "Beagle",
  "Caniche",
  "Chihuahua",
  "Yorkshire Terrier",
  "Pomerania",
  "Border Collie",
  "Boxer",
  "Rottweiler",
  "Husky Siberiano",
  "Dálmata",
  "Cocker Spaniel",
  "Shih Tzu",
  "Teckel",
  "Bichón Maltés",
  "Bichón Frisé",
  "Jack Russell Terrier",
  "American Staffordshire Terrier",
  "Pitbull",
  "Doberman",
  "Gran Danés",
  "San Bernardo",
  "Akita Inu",
  "Shiba Inu",
];

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error(
        "OPENAI_API_KEY no está disponible."
      );

      return NextResponse.json(
        {
          error:
            "Falta OPENAI_API_KEY en las variables de entorno.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No se ha recibido ninguna imagen.",
        },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error:
            "El archivo recibido no es una imagen.",
        },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "La imagen no puede superar los 10 MB.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const base64 =
      Buffer.from(arrayBuffer).toString("base64");

    const imageDataUrl =
      `data:${file.type};base64,${base64}`;

    console.log(
      "Enviando imagen a OpenAI...",
      file.type,
      file.size
    );

    const response =
      await openai.responses.create({
        model: "gpt-5",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `
Analiza esta fotografía de un perro.

Determina cuál de estas razas es la más probable:

${BREEDS.join(", ")}

IMPORTANTE:
- Debes elegir únicamente una raza de la lista.
- Si el perro parece claramente mestizo o no puedes determinar una raza concreta, utiliza "Mestizo".
- No inventes una raza que no esté en la lista.
- La confianza debe representar tu seguridad real en la identificación.

Devuelve únicamente este JSON:

{
  "breed": "raza",
  "confidence": 0
}

"confidence" debe ser un número entero entre 0 y 100.
                `.trim(),
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "high",
              },
            ],
          },
        ],
      });

    const text = response.output_text.trim();

    console.log(
      "Respuesta de OpenAI:",
      text
    );

    let result: {
      breed?: string;
      confidence?: number;
    };

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "OpenAI no devolvió JSON válido:",
        parseError
      );

      return NextResponse.json(
        {
          error:
            "OpenAI respondió, pero no devolvió un JSON válido.",
          raw: text,
        },
        { status: 500 }
      );
    }

    const breed =
      typeof result.breed === "string" &&
      BREEDS.includes(result.breed)
        ? result.breed
        : "Mestizo";

    const confidence =
      typeof result.confidence === "number"
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(result.confidence)
            )
          )
        : 0;

    return NextResponse.json({
      breed,
      confidence,
    });
  } catch (error: any) {
    console.error(
      "========== ERROR OPENAI =========="
    );

    console.error(error);

    console.error(
      "Mensaje:",
      error?.message
    );

    console.error(
      "Status:",
      error?.status
    );

    console.error(
      "Código:",
      error?.code
    );

    console.error(
      "=================================="
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error desconocido al analizar la imagen con OpenAI.",
      },
      { status: 500 }
    );
  }
}