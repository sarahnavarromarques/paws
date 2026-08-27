"use client";

import { useState } from "react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIPage() {
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola 👋 Soy PAWS IA. Pregúntame cualquier cosa sobre el entrenamiento de tu mascota.",
    },
  ]);

  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const text = message.trim();

    if (!text || loading) return;

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: text,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Error al contactar con la IA."
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.message,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "No he podido responder ahora mismo. Comprueba la configuración de la API.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">

        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-block rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">

          {/* CABECERA */}

          <div className="bg-blue-600 p-8 text-white">

            <h1 className="text-4xl font-bold">
              🤖 PAWS IA
            </h1>

            <p className="mt-2 text-blue-100">
              Tu asistente para el entrenamiento de mascotas.
            </p>

          </div>

          {/* CHAT */}

          <div className="min-h-[500px] p-6">

            <div className="space-y-4">

              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`flex ${
                    item.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-5 py-4 ${
                      item.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {item.content}
                  </div>

                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-5 py-4 text-slate-500">
                    🤖 Pensando...
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* INPUT */}

          <div className="border-t bg-slate-50 p-6">

            <div className="flex gap-3">

              <input
                type="text"
                value={message}
                disabled={loading}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void sendMessage();
                  }
                }}
                placeholder="Escribe tu pregunta..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={loading || !message.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "..." : "Enviar"}
              </button>

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}