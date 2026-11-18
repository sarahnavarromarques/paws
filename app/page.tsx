import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createServerClient } from "@supabase/ssr";

import WaitlistForm, { type WaitlistTexts } from "@/components/WaitlistForm";
import type { Database } from "@/lib/supabase/database.types";

const CONTACT_EMAIL = "soporte@pawscoach.app";

type Item = { icon: string; title: string; text: string };

type LandingTexts = {
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  waitlist: WaitlistTexts;
  pawsiGreeting: string;
  pawsiAlt: string;
  howTitle: string;
  steps: Item[];
  featuresTitle: string;
  features: Item[];
  trainersTitle: string;
  trainersText: string;
  trainersBullets: string[];
  trainersCta: string;
  finalTitle: string;
  finalText: string;
  contact: string;
  legalNotice: string;
  terms: string;
  privacy: string;
};

const texts: Record<"es" | "en", LandingTexts> = {
  es: {
    badge: "🚀 Próximamente",
    heroTitle: "El entrenador inteligente para tu perro",
    heroSubtitle:
      "PAWS organiza los entrenamientos, mide el progreso y te dice qué practicar cada día. La IA aprende de cada sesión y adapta el plan a tu perro.",
    waitlist: {
      placeholder: "Tu correo electrónico",
      button: "Avisarme",
      sending: "Enviando...",
      success: "¡Listo! Te avisaremos en cuanto PAWS esté disponible. 🐾",
      already: "Ya estabas en la lista. Te avisaremos en cuanto salga. 🐾",
      invalid: "Revisa el correo: parece que no es válido.",
      error: "No se ha podido guardar. Inténtalo de nuevo en un momento.",
      privacyNote:
        "Solo usaremos tu correo para avisarte del lanzamiento. Más información en",
      privacyLink: "Privacidad",
    },
    pawsiGreeting: "¡Hola! Soy Pawsi",
    pawsiAlt: "Pawsi, la mascota de PAWS, saludando",
    howTitle: "Cómo funciona",
    steps: [
      {
        icon: "1",
        title: "Cuéntanos cómo es tu perro",
        text: "Responde un cuestionario corto y PAWS crea su plan: objetivo, grupos de habilidades y orden de entrenamiento.",
      },
      {
        icon: "2",
        title: "Entrena con una guía",
        text: "Cada sesión tiene un plan paso a paso, vídeos de cada habilidad y un clicker en el móvil.",
      },
      {
        icon: "3",
        title: "La IA mide el progreso",
        text: "Al terminar respondes cuatro preguntas y la IA actualiza el progreso y te dice el siguiente paso.",
      },
    ],
    featuresTitle: "Todo en un solo sitio",
    features: [
      {
        icon: "🎯",
        title: "Habilidades con vídeos",
        text: "Sentado, quieto, llamada, junto y más, con vídeos y viñetas paso a paso.",
      },
      {
        icon: "🤖",
        title: "Sesión guiada por IA",
        text: "Un plan para hoy con calentamiento, ejercicios y cuándo subir o bajar la dificultad.",
      },
      {
        icon: "📈",
        title: "Progreso e historial",
        text: "Mira cómo avanza cada habilidad y todos los entrenamientos de tu perro.",
      },
      {
        icon: "🔔",
        title: "Clicker en el móvil",
        text: "Varios sonidos, volumen y tono ajustables. Siempre en el bolsillo.",
      },
      {
        icon: "📅",
        title: "Calendario",
        text: "Planifica los entrenamientos y llévalos al calendario de tu móvil.",
      },
      {
        icon: "🩺",
        title: "Salud",
        text: "Vacunas y desparasitaciones con avisos para que no se te pase ninguna.",
      },
    ],
    trainersTitle: "¿Eres adiestrador?",
    trainersText:
      "PAWS también será tu herramienta de trabajo. Lleva a todos los perros de tus clientes en un solo lugar.",
    trainersBullets: [
      "Gestiona clientes y perros",
      "Invita a los dueños con un enlace",
      "Los dueños apuntan los deberes entre sesiones",
      "La IA te ayuda a preparar cada sesión",
    ],
    trainersCta: "Avísame del lanzamiento",
    finalTitle: "Sé de los primeros en probar PAWS",
    finalText: "Déjanos tu correo y te avisamos el día del lanzamiento.",
    contact: "Contacto",
    legalNotice: "Aviso legal",
    terms: "Condiciones",
    privacy: "Privacidad",
  },
  en: {
    badge: "🚀 Coming soon",
    heroTitle: "The smart trainer for your dog",
    heroSubtitle:
      "PAWS organizes your training, measures progress and tells you what to practice each day. The AI learns from every session and adapts the plan to your dog.",
    waitlist: {
      placeholder: "Your email",
      button: "Notify me",
      sending: "Sending...",
      success: "Done! We'll let you know as soon as PAWS is available. 🐾",
      already: "You were already on the list. We'll let you know when it's out. 🐾",
      invalid: "Please check your email: it doesn't look valid.",
      error: "We couldn't save it. Please try again in a moment.",
      privacyNote:
        "We'll only use your email to tell you about the launch. More info in",
      privacyLink: "Privacy",
    },
    pawsiGreeting: "Hi! I'm Pawsi",
    pawsiAlt: "Pawsi, the PAWS mascot, waving hello",
    howTitle: "How it works",
    steps: [
      {
        icon: "1",
        title: "Tell us about your dog",
        text: "Answer a short questionnaire and PAWS builds a plan: goal, skill groups and training order.",
      },
      {
        icon: "2",
        title: "Train with a guide",
        text: "Every session has a step-by-step plan, videos for each skill and a clicker on your phone.",
      },
      {
        icon: "3",
        title: "The AI tracks progress",
        text: "Answer four quick questions after training and the AI updates progress and tells you the next step.",
      },
    ],
    featuresTitle: "Everything in one place",
    features: [
      {
        icon: "🎯",
        title: "Skills with videos",
        text: "Sit, stay, recall, heel and more, with step-by-step videos and illustrations.",
      },
      {
        icon: "🤖",
        title: "AI-guided sessions",
        text: "A plan for today with warm-up, exercises and when to make it easier or harder.",
      },
      {
        icon: "📈",
        title: "Progress and history",
        text: "See how each skill improves and every training session your dog has done.",
      },
      {
        icon: "🔔",
        title: "Clicker on your phone",
        text: "Several sounds with adjustable volume and pitch. Always in your pocket.",
      },
      {
        icon: "📅",
        title: "Calendar",
        text: "Plan your training and sync it with your phone's calendar.",
      },
      {
        icon: "🩺",
        title: "Health",
        text: "Vaccines and deworming with reminders so you never miss one.",
      },
    ],
    trainersTitle: "Are you a dog trainer?",
    trainersText:
      "PAWS will also be your work tool. Keep all your clients' dogs in one place.",
    trainersBullets: [
      "Manage clients and dogs",
      "Invite owners with a link",
      "Owners log homework between sessions",
      "The AI helps you prepare every session",
    ],
    trainersCta: "Notify me at launch",
    finalTitle: "Be among the first to try PAWS",
    finalText: "Leave us your email and we'll let you know on launch day.",
    contact: "Contact",
    legalNotice: "Legal notice",
    terms: "Terms",
    privacy: "Privacy",
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // En una página no se pueden escribir cookies; proxy.ts ya refresca la sesión.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión iniciada: directo al panel, como antes.
  if (user) {
    redirect("/dashboard");
  }

  const currentLocale = await getLocale();
  const locale: "es" | "en" = currentLocale.startsWith("en") ? "en" : "es";
  const t = texts[locale];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Cabecera (deja hueco a la derecha para la bandera de idioma).
          Sin enlace a "Iniciar sesión" mientras PAWS está en "Próximamente":
          quien ya tiene cuenta entra escribiendo /login. */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 pr-24">
        <span className="text-xl font-bold">🐾 PAWS</span>
      </header>

      {/* Portada */}
      <section
        id="avisarme"
        className="mx-auto max-w-4xl scroll-mt-6 px-4 pb-10 pt-10 text-center sm:pt-16"
      >
        <span className="inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700">
          {t.badge}
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight text-[#1e3a5f] sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          {t.heroSubtitle}
        </p>
        <div className="mt-8">
          <WaitlistForm locale={locale} texts={t.waitlist} />
        </div>
      </section>

      {/* Pawsi */}
      <section className="flex flex-col items-center px-4 pb-12">
        <div className="relative mb-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-lg font-semibold text-[#1e3a5f] shadow-sm">
          {t.pawsiGreeting}
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
        </div>
        <Image
          src="/mascot/pawsi-hola.png"
          alt={t.pawsiAlt}
          width={512}
          height={512}
          priority
          className="h-auto w-44 sm:w-56"
        />
      </section>

      {/* Cómo funciona */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-[#1e3a5f]">
            {t.howTitle}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {t.steps.map((step) => (
              <div
                key={step.icon}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                  {step.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-[#1e3a5f]">
            {t.featuresTitle}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="text-3xl">{feature.icon}</div>
                <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-slate-600">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Adiestradores */}
      <section className="bg-[#1e3a5f] py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold">{t.trainersTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
            {t.trainersText}
          </p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            {t.trainersBullets.map((bullet) => (
              <li key={bullet} className="rounded-xl bg-white/10 px-4 py-3">
                ✔ {bullet}
              </li>
            ))}
          </ul>
          <a
            href="#avisarme"
            className="mt-8 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-[#1e3a5f] hover:bg-blue-50"
          >
            {t.trainersCta}
          </a>
        </div>
      </section>

      {/* Llamada final con segundo formulario */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-bold text-[#1e3a5f]">{t.finalTitle}</h2>
          <p className="mt-3 text-slate-600">{t.finalText}</p>
          <div className="mt-6">
            <WaitlistForm locale={locale} texts={t.waitlist} />
          </div>
        </div>
      </section>

      {/* Pie */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <span>© 2026 PAWS</span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">
              {t.contact}
            </a>
            <Link href="/legal/aviso-legal" className="hover:underline">
              {t.legalNotice}
            </Link>
            <Link href="/legal/condiciones" className="hover:underline">
              {t.terms}
            </Link>
            <Link href="/legal/privacidad" className="hover:underline">
              {t.privacy}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}