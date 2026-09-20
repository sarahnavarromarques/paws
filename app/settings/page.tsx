"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Language = "es" | "en";

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations("Settings");

  const [language, setLanguage] = useState<Language>("es");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single();

      if (profile?.language === "en" || profile?.language === "es") {
        setLanguage(profile.language);
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  async function handleSave(newLanguage: Language) {
    if (saving || newLanguage === language) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      language: newLanguage,
      updated_at: new Date().toISOString(),
    });

    // Recarga completa para que el servidor sirva el nuevo idioma
    window.location.reload();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-500">...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm font-semibold text-slate-400 hover:text-slate-600"
        >
          {t("back")}
        </Link>

        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight">
            {t("title")}
          </h1>

          <p className="mb-3 text-sm font-semibold text-slate-600">
            {t("languageLabel")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave("es")}
              className={`rounded-xl border-2 p-4 text-center font-semibold transition ${
                language === "es"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              🇪🇸 {t("spanish")}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave("en")}
              className={`rounded-xl border-2 p-4 text-center font-semibold transition ${
                language === "en"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              🇬🇧 {t("english")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}