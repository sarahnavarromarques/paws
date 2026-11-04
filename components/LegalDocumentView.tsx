import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { LEGAL_LINKS, LEGAL_UPDATED_AT, type LegalDocument } from "@/lib/legal";

type Props = {
  document: LegalDocument;
  // Ruta de esta página, para resaltarla en los enlaces de abajo
  currentHref: string;
};

// Muestra un texto legal (aviso legal, privacidad, condiciones)
export default async function LegalDocumentView({ document, currentHref }: Props) {
  const t = await getTranslations("Legal");
  const locale = await getLocale();

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow md:p-10">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-600 hover:underline">
          ← {t("back")}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold text-[#1e3a5f] md:text-4xl">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("updatedAt", { date: LEGAL_UPDATED_AT })}
        </p>

        {locale !== "es" && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {t("spanishOnly")}
          </p>
        )}

        {document.intro && <p className="mt-6 text-slate-700">{document.intro}</p>}

        {document.sections.map((section) => (
          <section key={section.title} className="mt-8">
            <h2 className="text-xl font-bold text-[#1e3a5f]">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-relaxed text-slate-700">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="leading-relaxed">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.href === currentHref
                  ? "font-semibold text-slate-800"
                  : "text-blue-600 hover:underline"
              }
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
