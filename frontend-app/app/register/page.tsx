"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

console.log("DATA:", data);
console.log("ERROR:", error);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Cuenta creada correctamente. Revisa tu correo para confirmar tu dirección de email."
    );

    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={handleRegister}
        className="bg-white rounded-2xl shadow-xl p-10 w-[420px]"
      >
        <h1 className="text-3xl font-bold mb-8 text-center">
          🐾 Crear cuenta
        </h1>

        <input
          className="border rounded-lg w-full p-3 mb-4"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border rounded-lg w-full p-3 mb-6"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white w-full rounded-lg py-3"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}