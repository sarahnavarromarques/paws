"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
    }

    void loadUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">🐾 PAWS</h1>

            <p className="mt-2 text-gray-600">
              Bienvenido {email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-5 py-3 text-white transition hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div
            onClick={() => router.push("/pets")}
            className="cursor-pointer rounded-xl bg-white p-8 shadow transition hover:shadow-lg"
          >
            <h2 className="mb-3 text-xl font-bold">
              🐶 Mascotas
            </h2>

            <p className="text-gray-600">
              Gestiona tus mascotas.
            </p>
          </div>

          <div
            onClick={() => router.push("/training")}
            className="cursor-pointer rounded-xl bg-white p-8 shadow transition hover:shadow-lg"
          >
            <h2 className="mb-3 text-xl font-bold">
              🏋️ Entrenamientos
            </h2>

            <p className="text-gray-600">
              Historial y progreso.
            </p>
          </div>

          <div
            onClick={() => router.push("/ai")}
            className="cursor-pointer rounded-xl bg-white p-8 shadow transition hover:shadow-lg"
          >
            <h2 className="mb-3 text-xl font-bold">
              🤖 IA
            </h2>

            <p className="text-gray-600">
              Recomendaciones inteligentes.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}