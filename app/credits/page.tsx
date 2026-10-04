import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CreditsPage() {
  const t = await getTranslations("Credits");

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">

        {/* CABECERA */}
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            {t("back")}
          </Link>

          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            {t("title")}
          </h1>

          <p className="mt-2 text-slate-600">{t("subtitle")}</p>
        </header>

        {/* TARJETA: FCI */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-xl font-bold">{t("fciTitle")}</h2>

          <p className="mt-4 leading-relaxed text-slate-700">
            {t.rich("fciBody1", {
              doc: (chunks) => (
                <span className="font-semibold">{chunks}</span>
              ),
              org: (chunks) => (
                <span className="font-semibold italic">{chunks}</span>
              ),
            })}
          </p>

          <p className="mt-4 leading-relaxed text-slate-700">
            {t("fciBody2")}
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-5">
            <p className="text-sm leading-relaxed text-slate-500">
              {t("disclaimer")}
            </p>
          </div>
        </section>

        {/* PIE */}
        <p className="mt-8 text-center text-xs text-slate-400">
          {t("footer")}
        </p>

      </div>
    </main>
  );
}