import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

const SUPPORT_EMAIL = "soporte@pawscoach.app";

type Faq = { q: string; a: string };

type SupportTexts = {
  metaTitle: string;
  title: string;
  intro: string;
  contactTitle: string;
  contactText: string;
  faqTitle: string;
  faqs: Faq[];
  legalTitle: string;
  privacy: string;
  terms: string;
  notice: string;
  home: string;
};

const TEXTS: Record<"es" | "en", SupportTexts> = {
  es: {
    metaTitle: "Soporte · PAWS",
    title: "Soporte",
    intro: "¿Tienes una duda o un problema con PAWS? Aquí tienes las respuestas más habituales y cómo contactar con nosotros.",
    contactTitle: "Contacto",
    contactText: "Escríbenos y te responderemos lo antes posible:",
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Qué son los huesitos?",
        a: "Son las unidades que usan las funciones de inteligencia artificial de PAWS. Al crear tu cuenta recibes huesitos de regalo para probarlas. Puedes ver tu saldo y tus movimientos en Ajustes.",
      },
      {
        q: "¿Cómo cancelo PAWS PRO?",
        a: "Si lo contrataste en la web, entra en PAWS PRO y pulsa «Gestionar suscripción». Si lo contrataste desde el iPhone, cancélalo en los ajustes de suscripciones de tu cuenta de Apple. Seguirás siendo PRO hasta el final del periodo ya pagado.",
      },
      {
        q: "¿Cómo activo o desactivo la inteligencia artificial?",
        a: "En Ajustes, en la tarjeta «Inteligencia artificial», puedes dar o retirar el permiso en cualquier momento. Sin permiso, no se envía nada a la IA.",
      },
      {
        q: "He olvidado mi contraseña",
        a: "En la pantalla de inicio de sesión pulsa «¿Olvidaste tu contraseña?» y te enviaremos un correo para crear una nueva.",
      },
      {
        q: "¿Cómo borro mi cuenta?",
        a: "En Ajustes, al final, pulsa «Borrar cuenta». Se eliminan tus datos y los de tus perros. Esta acción no se puede deshacer.",
      },
    ],
    legalTitle: "Información legal",
    privacy: "Política de privacidad",
    terms: "Condiciones de uso",
    notice: "Aviso legal",
    home: "← Ir a PAWS",
  },
  en: {
    metaTitle: "Support · PAWS",
    title: "Support",
    intro: "Do you have a question or a problem with PAWS? Here are the most common answers and how to contact us.",
    contactTitle: "Contact",
    contactText: "Write to us and we will reply as soon as possible:",
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "What are bones (huesitos)?",
        a: "They are the units used by PAWS artificial intelligence features. You get free bones when you create your account so you can try them. You can see your balance and transactions in Settings.",
      },
      {
        q: "How do I cancel PAWS PRO?",
        a: "If you subscribed on the web, go to PAWS PRO and tap “Manage subscription”. If you subscribed from your iPhone, cancel it in the subscription settings of your Apple account. You will remain PRO until the end of the period already paid.",
      },
      {
        q: "How do I turn artificial intelligence on or off?",
        a: "In Settings, on the “Artificial intelligence” card, you can give or withdraw permission at any time. Without permission, nothing is sent to the AI.",
      },
      {
        q: "I forgot my password",
        a: "On the sign-in screen, tap “Forgot your password?” and we will send you an email to create a new one.",
      },
      {
        q: "How do I delete my account?",
        a: "In Settings, at the bottom, tap “Delete account”. Your data and your dogs' data are deleted. This cannot be undone.",
      },
    ],
    legalTitle: "Legal information",
    privacy: "Privacy policy",
    terms: "Terms of use",
    notice: "Legal notice",
    home: "← Go to PAWS",
  },
};

async function getTexts(): Promise<SupportTexts> {
  const locale = await getLocale();
  return locale === "en" ? TEXTS.en : TEXTS.es;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTexts();
  return { title: t.metaTitle };
}

// Página pública de soporte (la enlaza la ficha del App Store)
export default async function SupportPage() {
  const t = await getTexts();

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow md:p-10">
        <Link href="/" className="text-sm font-semibold text-blue-600 hover:underline">
          {t.home}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold text-[#1e3a5f] md:text-4xl">
          {t.title}
        </h1>
        <p className="mt-3 text-slate-700">{t.intro}</p>

        {/* CONTACTO */}
        <section className="mt-8 rounded-2xl bg-blue-50 p-6">
          <h2 className="text-xl font-bold text-[#1e3a5f]">{t.contactTitle}</h2>
          <p className="mt-2 text-slate-700">{t.contactText}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-3 inline-block rounded-xl bg-[#1e3a5f] px-5 py-3 font-semibold text-white transition hover:bg-[#16304f]"
          >
            ✉️ {SUPPORT_EMAIL}
          </a>
        </section>

        {/* PREGUNTAS FRECUENTES */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-[#1e3a5f]">{t.faqTitle}</h2>
          <div className="mt-4 space-y-3">
            {t.faqs.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  {faq.q}
                </summary>
                <p className="mt-2 leading-relaxed text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* LEGAL */}
        <nav className="mt-10 border-t border-slate-200 pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
            {t.legalTitle}
          </h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/legal/privacidad" className="text-blue-600 hover:underline">
              {t.privacy}
            </Link>
            <Link href="/legal/condiciones" className="text-blue-600 hover:underline">
              {t.terms}
            </Link>
            <Link href="/legal/aviso-legal" className="text-blue-600 hover:underline">
              {t.notice}
            </Link>
          </div>
        </nav>
      </article>
    </main>
  );
}