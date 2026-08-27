"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!password) {
      alert("Introduce una contraseña nueva.");
      return;
    }

    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-[420px] rounded-2xl bg-white p-10 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          🐾 Nueva contraseña
        </h1>

        {done ? (
          <div className="mt-6 text-center">
            <p className="mb-6 text-slate-600">
              Tu contraseña se ha actualizado correctamente. Ya
              puedes iniciar sesión con ella.
            </p>

            <button
              type="button"
              onClick={() => {
                router.replace("/login");
                router.refresh();
              }}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700"
            >
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate}>
            <p className="mb-6 mt-2 text-center text-sm text-slate-500">
              Escribe tu nueva contraseña.
            </p>

            <input
              type="password"
              autoComplete="new-password"
              className="mb-4 w-full rounded-lg border p-3"
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <input
              type="password"
              autoComplete="new-password"
              className="mb-6 w-full rounded-lg border p-3"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>

            <p className="mt-6 text-center text-sm text-slate-500">
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}