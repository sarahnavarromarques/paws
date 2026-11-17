import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: locale === "es" ? "Política de privacidad · PAWS" : "Privacy policy · PAWS",
  };
}

// ---------------------------------------------------------------------------
// ESPAÑOL
// ---------------------------------------------------------------------------
const DOCUMENT_ES: LegalDocument = {
  title: "Política de privacidad",
  intro:
    "Esta política explica qué datos personales trata PAWS, para qué, durante cuánto tiempo y qué derechos tienes, conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).",
  sections: [
    {
      title: "1. Responsable del tratamiento",
      bullets: [
        `Responsable: ${LEGAL_OWNER.name}, titular de ${LEGAL_OWNER.brand}.`,
        `Correo de contacto para privacidad: ${LEGAL_OWNER.email}`,
        "El resto de datos identificativos del titular figuran en el Aviso legal.",
      ],
    },
    {
      title: "2. Qué datos tratamos",
      bullets: [
        "Datos de cuenta: correo electrónico, contraseña (guardada cifrada), nombre, apellidos o nombre de usuario, foto de perfil, idioma y tipo de cuenta (particular, adiestrador, centro o refugio).",
        "Datos de tus perros: nombre, raza, edad, fecha de nacimiento, sexo, peso, color, fotos, objetivos, nivel, respuestas del cuestionario inicial, vacunas, desparasitaciones y notas de salud que decidas añadir.",
        "Datos de entrenamiento: sesiones, entrenamientos, calendario, habilidades, grupos, progreso, deberes y registros de práctica.",
        "Relación adiestrador–cliente: qué perros compartes con qué adiestrador, el nombre con el que el adiestrador identifica a su cliente y las invitaciones.",
        "Uso de la inteligencia artificial: los datos y textos que se envían a las herramientas de IA, sus respuestas y el consumo de huesitos (ver apartado 4).",
        "Datos de suscripción y compras: estado de PAWS PRO, fechas de renovación, saldo y movimientos de huesitos, e identificadores de cliente y suscripción de Stripe. PAWS no ve ni guarda los datos de tu tarjeta.",
        "Comunicaciones con soporte: tu dirección de correo y el contenido de los mensajes que nos envíes.",
        "Datos técnicos imprescindibles: cookies de sesión y preferencias (ver apartado 10).",
      ],
    },
    {
      title: "3. Para qué los usamos y base legal",
      bullets: [
        "Prestarte el servicio de PAWS (crear tu cuenta, guardar tus perros y entrenamientos, mostrar tu progreso): ejecución del contrato (art. 6.1.b RGPD).",
        "Compartir datos de tus perros con el adiestrador que tú elijas al aceptar su invitación: ejecución del contrato y tu decisión expresa. Puedes dejar de compartirlos en cualquier momento.",
        "Generar respuestas con inteligencia artificial cuando usas esas herramientas: ejecución del contrato.",
        "Enviarte los correos necesarios para el servicio (confirmar tu cuenta, recuperar tu contraseña): ejecución del contrato.",
        "Gestionar la suscripción PAWS PRO, las compras de huesitos y la facturación: ejecución del contrato y cumplimiento de obligaciones legales (art. 6.1.c RGPD).",
        "Mantener la seguridad, evitar abusos y controlar el coste de la IA: interés legítimo (art. 6.1.f RGPD).",
        "Atender tus consultas y el ejercicio de tus derechos: obligación legal e interés legítimo.",
      ],
      paragraphs: [
        "No usamos tus datos para publicidad ni los vendemos a terceros. No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti.",
      ],
    },
    {
      title: "4. Inteligencia artificial",
      paragraphs: [
        "Algunas funciones de PAWS usan inteligencia artificial de Anthropic (modelos Claude): el cuestionario inicial, la sesión guiada y su chat, el cálculo del progreso, el análisis de progreso, el orden recomendado y las sugerencias de nombres de grupos.",
        "Cuando usas una de estas funciones, PAWS envía a Anthropic solo los datos necesarios para esa respuesta: por ejemplo, la raza, edad y objetivos de tu perro, sus habilidades y progreso, los datos de sus entrenamientos y lo que escribes en el chat. No se envían tu correo electrónico, tu contraseña ni tus datos de pago.",
        "Anthropic trata estos datos como encargado del tratamiento para generar la respuesta y, según sus condiciones comerciales, no los utiliza para entrenar sus modelos.",
        "Las respuestas de la IA son orientativas y pueden contener errores. No sustituyen el criterio de un adiestrador profesional ni de un veterinario.",
      ],
    },
    {
      title: "5. Con quién se comparten",
      paragraphs: [
        "Solo con los proveedores necesarios para que PAWS funcione, que actúan como encargados del tratamiento con contrato y garantías:",
      ],
      bullets: [
        "Supabase Inc.: base de datos, inicio de sesión y almacenamiento de fotos.",
        "Vercel Inc.: alojamiento de la aplicación web.",
        "Anthropic PBC: procesamiento de las peticiones a las herramientas de inteligencia artificial (ver apartado 4).",
        "Resend (Plus Five Five, Inc.): envío de los correos de la aplicación, como la confirmación de cuenta y la recuperación de contraseña.",
        "ImprovMX y Google LLC (Gmail): recepción y gestión de los correos que envías a soporte.",
        "Google LLC (YouTube): alojamiento y reproducción de los vídeos explicativos de las habilidades.",
        "Stripe (y su servicio Link): gestión de los pagos de PAWS PRO y de los huesitos. En las compras, Stripe/Link actúa como vendedor y trata tus datos de pago como responsable independiente según su propia política de privacidad.",
      ],
    },
    {
      title: "6. Transferencias internacionales",
      paragraphs: [
        "Algunos de estos proveedores tienen sede o servidores en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE–EE. UU. o en las cláusulas contractuales tipo aprobadas por la Comisión Europea.",
      ],
    },
    {
      title: "7. Cuánto tiempo los guardamos",
      bullets: [
        "Mientras tengas la cuenta abierta.",
        "Si borras tu cuenta desde Ajustes, se eliminan tus datos y los de tus perros. Pueden conservarse bloqueados los datos estrictamente necesarios para obligaciones legales (por ejemplo, fiscales) durante los plazos que marque la ley.",
        "Los registros técnicos y de uso de la IA se conservan como máximo el tiempo necesario para la seguridad y el control de costes.",
        "Los correos de soporte se conservan mientras sean necesarios para atender tu consulta y sus posibles seguimientos.",
      ],
    },
    {
      title: "8. Tus derechos",
      paragraphs: [
        `Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación del tratamiento y la portabilidad de tus datos escribiendo a ${LEGAL_OWNER.email}. También puedes borrar tu cuenta en cualquier momento desde Ajustes.`,
        "Si consideras que no hemos atendido bien tu petición, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
      ],
    },
    {
      title: "9. Menores de edad",
      paragraphs: [
        "PAWS está dirigido exclusivamente a personas mayores de 18 años. Si tienes menos de 18 años, no debes crear una cuenta ni usar PAWS. Si detectamos una cuenta de un menor, la eliminaremos junto con sus datos.",
      ],
    },
    {
      title: "10. Cookies y almacenamiento en tu navegador",
      paragraphs: [
        "PAWS solo usa cookies y almacenamiento local técnicos, imprescindibles para funcionar: mantener tu sesión iniciada, recordar tu idioma y recordar qué tutoriales has visto. No usamos cookies de publicidad ni de analítica.",
        "Los vídeos explicativos de las habilidades se reproducen desde YouTube. Al verlos, YouTube (Google) puede usar sus propias cookies según su política de privacidad.",
      ],
    },
    {
      title: "11. Seguridad",
      paragraphs: [
        "Aplicamos medidas técnicas y organizativas para proteger tus datos: conexiones cifradas, contraseñas cifradas y reglas de acceso en la base de datos para que cada usuario solo vea sus datos y los que otros han decidido compartir con él.",
      ],
    },
    {
      title: "12. Cambios en esta política",
      paragraphs: [
        "Si cambiamos esta política de forma importante, te avisaremos dentro de la aplicación o por correo electrónico.",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// ENGLISH
// ---------------------------------------------------------------------------
const DOCUMENT_EN: LegalDocument = {
  title: "Privacy policy",
  intro:
    "This policy explains what personal data PAWS processes, why, for how long and what rights you have, in accordance with the General Data Protection Regulation (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD). If there is any discrepancy, the Spanish version prevails.",
  sections: [
    {
      title: "1. Data controller",
      bullets: [
        `Controller: ${LEGAL_OWNER.name}, owner of ${LEGAL_OWNER.brand}.`,
        `Privacy contact email: ${LEGAL_OWNER.email}`,
        "The owner's remaining identification details are listed in the Legal notice.",
      ],
    },
    {
      title: "2. What data we process",
      bullets: [
        "Account data: email address, password (stored encrypted), first name, last name or username, profile photo, language and account type (individual, trainer, centre or shelter).",
        "Your dogs' data: name, breed, age, date of birth, sex, weight, colour, photos, goals, level, answers to the initial questionnaire, vaccinations, deworming treatments and any health notes you choose to add.",
        "Training data: sessions, trainings, calendar, skills, groups, progress, homework and practice records.",
        "Trainer–client relationship: which dogs you share with which trainer, the name the trainer uses to identify their client, and invitations.",
        "Use of artificial intelligence: the data and text sent to the AI tools, their answers and your huesitos usage (see section 4).",
        "Subscription and purchase data: PAWS PRO status, renewal dates, huesitos balance and transactions, and Stripe customer and subscription identifiers. PAWS never sees or stores your card details.",
        "Communications with support: your email address and the content of the messages you send us.",
        "Essential technical data: session and preference cookies (see section 10).",
      ],
    },
    {
      title: "3. Why we use it and legal basis",
      bullets: [
        "Providing the PAWS service (creating your account, saving your dogs and trainings, showing your progress): performance of a contract (Art. 6.1.b GDPR).",
        "Sharing your dogs' data with the trainer you choose when you accept their invitation: performance of a contract and your explicit decision. You can stop sharing at any time.",
        "Generating answers with artificial intelligence when you use those tools: performance of a contract.",
        "Sending you the emails needed for the service (confirming your account, recovering your password): performance of a contract.",
        "Managing your PAWS PRO subscription, huesitos purchases and invoicing: performance of a contract and compliance with legal obligations (Art. 6.1.c GDPR).",
        "Keeping the service secure, preventing abuse and controlling AI costs: legitimate interest (Art. 6.1.f GDPR).",
        "Answering your enquiries and requests to exercise your rights: legal obligation and legitimate interest.",
      ],
      paragraphs: [
        "We do not use your data for advertising and we do not sell it to third parties. We do not make automated decisions that have legal effects on you.",
      ],
    },
    {
      title: "4. Artificial intelligence",
      paragraphs: [
        "Some PAWS features use artificial intelligence from Anthropic (Claude models): the initial questionnaire, the guided session and its chat, progress calculation, progress analysis, the recommended order and skill group name suggestions.",
        "When you use one of these features, PAWS sends Anthropic only the data needed for that answer: for example, your dog's breed, age and goals, its skills and progress, its training data and what you type in the chat. Your email address, password and payment details are never sent.",
        "Anthropic processes this data as a processor to generate the answer and, under its commercial terms, does not use it to train its models.",
        "AI answers are for guidance only and may contain mistakes. They do not replace the judgement of a professional trainer or a veterinarian.",
      ],
    },
    {
      title: "5. Who we share it with",
      paragraphs: [
        "Only with the providers needed for PAWS to work, who act as processors under contract and with appropriate safeguards:",
      ],
      bullets: [
        "Supabase Inc.: database, sign-in and photo storage.",
        "Vercel Inc.: hosting of the web application.",
        "Anthropic PBC: processing of requests to the artificial intelligence tools (see section 4).",
        "Resend (Plus Five Five, Inc.): sending the app's emails, such as account confirmation and password recovery.",
        "ImprovMX and Google LLC (Gmail): receiving and managing the emails you send to support.",
        "Google LLC (YouTube): hosting and playback of the skill explainer videos.",
        "Stripe (and its Link service): processing payments for PAWS PRO and huesitos. For purchases, Stripe/Link acts as the seller and processes your payment data as an independent controller under its own privacy policy.",
      ],
    },
    {
      title: "6. International transfers",
      paragraphs: [
        "Some of these providers are based in, or have servers in, the United States. These transfers are covered by the EU–US Data Privacy Framework or by the standard contractual clauses approved by the European Commission.",
      ],
    },
    {
      title: "7. How long we keep it",
      bullets: [
        "For as long as your account is open.",
        "If you delete your account from Settings, your data and your dogs' data are deleted. Data strictly required for legal obligations (for example, tax) may be kept blocked for the periods required by law.",
        "Technical and AI usage logs are kept only as long as needed for security and cost control.",
        "Support emails are kept for as long as needed to handle your enquiry and any follow-ups.",
      ],
    },
    {
      title: "8. Your rights",
      paragraphs: [
        `You can request access, rectification, erasure, objection, restriction of processing and portability of your data by writing to ${LEGAL_OWNER.email}. You can also delete your account at any time from Settings.`,
        "If you believe we have not handled your request properly, you can lodge a complaint with the Spanish Data Protection Agency (www.aepd.es).",
      ],
    },
    {
      title: "9. Minors",
      paragraphs: [
        "PAWS is intended exclusively for people aged 18 or over. If you are under 18, you must not create an account or use PAWS. If we detect an account belonging to a minor, we will delete it together with its data.",
      ],
    },
    {
      title: "10. Cookies and storage in your browser",
      paragraphs: [
        "PAWS only uses technical cookies and local storage that are essential for it to work: keeping you signed in, remembering your language and remembering which tutorials you have seen. We do not use advertising or analytics cookies.",
        "The skill explainer videos are played from YouTube. When you watch them, YouTube (Google) may use its own cookies under its privacy policy.",
      ],
    },
    {
      title: "11. Security",
      paragraphs: [
        "We apply technical and organisational measures to protect your data: encrypted connections, encrypted passwords and database access rules so that each user only sees their own data and the data others have chosen to share with them.",
      ],
    },
    {
      title: "12. Changes to this policy",
      paragraphs: [
        "If we make significant changes to this policy, we will let you know within the app or by email.",
      ],
    },
  ],
};

export default function PrivacidadPage() {
  return (
    <LegalDocumentView
      document={DOCUMENT_ES}
      documentEn={DOCUMENT_EN}
      currentHref="/legal/privacidad"
    />
  );
}