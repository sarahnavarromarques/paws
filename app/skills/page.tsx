"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Skill = {
  id: number;
  name: string;
  category: string | null;
  difficulty: string | null;
};

const DIFFICULTY_STYLES: Record<string, string> = {
  baja: "bg-green-100 text-green-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-red-100 text-red-800",
};

const CATEGORY_ICONS: Record<string, string> = {
  Posiciones: "🐕",
  Control: "🎯",
  Llamada: "📢",
  Paseo: "🚶",
};

export default function SkillsPage() {
  const router = useRouter();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Todas");

  useEffect(() => {
    async function loadSkills() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("skills")
        .select("id, name, category, difficulty")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error cargando habilidades:", error);
      }

      setSkills(data ?? []);
      setLoading(false);
    }

    void loadSkills();
  }, [router]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    skills.forEach((skill) => {
      if (skill.category) unique.add(skill.category);
    });
    return ["Todas", ...Array.from(unique)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    if (activeCategory === "Todas") return skills;
    return skills.filter((skill) => skill.category === activeCategory);
  }, [skills, activeCategory]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">Cargando habilidades...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* CABECERA */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Volver al dashboard
            </Link>

            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
              🎯 Biblioteca de habilidades
            </h1>

            <p className="mt-2 text-slate-600">
              Explora todas las habilidades que puedes enseñar a tu mascota.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-6 py-4 text-center shadow">
            <p className="text-3xl font-bold">{skills.length}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              habilidades
            </p>
          </div>
        </header>

        {/* FILTROS DE CATEGORÍA */}
        <div className="mb-8 flex flex-wrap gap-3">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={
                  isActive
                    ? "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                    : "rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                }
              >
                {category !== "Todas" && CATEGORY_ICONS[category]
                  ? `${CATEGORY_ICONS[category]} `
                  : ""}
                {category}
              </button>
            );
          })}
        </div>

        {/* LISTA DE HABILIDADES */}
        {filteredSkills.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow">
            <p className="text-slate-500">
              No hay habilidades en esta categoría.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((skill) => {
              const difficulty = skill.difficulty ?? "baja";
              const difficultyStyle =
                DIFFICULTY_STYLES[difficulty] ??
                "bg-slate-100 text-slate-700";
              const icon = skill.category
                ? CATEGORY_ICONS[skill.category] ?? "🐾"
                : "🐾";

              return (
                <div
                  key={skill.id}
                  className="flex flex-col rounded-2xl bg-white p-6 shadow transition hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-3xl">{icon}</span>
                    <h2 className="text-xl font-bold">{skill.name}</h2>
                  </div>

                  <p className="mb-4 text-sm text-slate-500">
                    {skill.category ?? "Sin categoría"}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${difficultyStyle}`}
                    >
                      {difficulty}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}