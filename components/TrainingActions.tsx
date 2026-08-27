"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  id: number;
  status: string;
};

export default function TrainingActions({
  id,
  status,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function completeTraining() {
    if (loading) return;

    setLoading(true);

    const { error } = await supabase
      .from("trainings")
      .update({
        status: "completed",
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  async function deleteTraining() {
    if (loading) return;

    if (!confirm("¿Eliminar entrenamiento?")) {
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("trainings")
      .delete()
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">

      <Link
        href={`/trainings/${id}/edit`}
        className="rounded-lg bg-blue-600 px-4 py-2 text-center font-semibold text-white transition hover:bg-blue-700"
      >
        ✏️ Editar
      </Link>

      {status !== "completed" && (
        <button
          type="button"
          onClick={completeTraining}
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "..." : "✓ Completar"}
        </button>
      )}

      <button
        type="button"
        onClick={deleteTraining}
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "..." : "🗑 Eliminar"}
      </button>

    </div>
  );
}