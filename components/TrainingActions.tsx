"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  id: number;
  status: string;
};

export default function TrainingActions({ id, status }: Props) {
  const router = useRouter();

  async function completeTraining() {
    const { error } = await supabase
      .from("trainings")
      .update({
        status: "completed",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  async function deleteTraining() {
    if (!confirm("¿Eliminar entrenamiento?")) return;

    const { error } = await supabase
      .from("trainings")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }  return (
    <div className="flex flex-col gap-2">
      {status !== "completed" && (
        <button
          onClick={completeTraining}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
        >
          ✓ Completar
        </button>
      )}

      <button
        onClick={deleteTraining}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
      >
        🗑 Eliminar
      </button>
    </div>
  );
}