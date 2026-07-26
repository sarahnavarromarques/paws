"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");
    }

    loadUser();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-10">

          <div>
            <h1 className="text-4xl font-bold">
              🐾 PAWS
            </h1>

            <p className="text-gray-600 mt-2">
              Bienvenido {email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg"
          >
            Cerrar sesión
          </button>

        </div>

        <div className="grid grid-cols-3 gap-6">

          <div className="bg-white rounded-xl shadow p-8">
            <h2 className="font-bold text-xl mb-3">
              🐶 Mascotas
            </h2>

            <p className="text-gray-600">
              Gestiona tus mascotas.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-8">
            <h2 className="font-bold text-xl mb-3">
              🏋️ Entrenamientos
            </h2>

            <p className="text-gray-600">
              Historial y progreso.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-8">
            <h2 className="font-bold text-xl mb-3">
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