import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: locale === "es" ? "Aviso legal · PAWS" : "Legal notice · PAWS",
  };
}

// ---------------------------------------------------------------------------
// ESPAÑOL
// ---------------------------------------------------------------------------
const DOCUMENT_ES: LegalDocument = {
  title: "Aviso legal",
  intro:
    "En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web y aplicación.",
  sections: [
    {
      title: "1. Titular",
      bullets: [
        `Titular: ${LEGAL_OWNER.name}`,
        `NIF: ${LEGAL_OWNER.taxId}`,
        ...(LEGAL_OWNER.address ? [`Domicilio: ${LEGAL_OWNER.address}`] : []),
        `Correo electrónico: ${LEGAL_OWNER.email}`,
        `Nombre comercial: ${LEGAL_OWNER.brand}`,
        `Sitio web: ${LEGAL_OWNER.website}`,
      ],
    },
    {
      title: "2. Objeto",
      paragraphs: [
        "PAWS es una aplicación web y para móvil para la gestión del adiestramiento canino: permite a propietarios de perros y a adiestradores profesionales registrar perros, entrenamientos, sesiones, progreso y deberes, y ofrece herramientas de apoyo basadas en inteligencia artificial.",
        "El uso de la aplicación implica la aceptación de este aviso legal, de las Condiciones de uso y de la Política de privacidad.",
      ],
    },
    {
      title: "3. Propiedad intelectual e industrial",
      paragraphs: [
        "El diseño, el código, los textos, los gráficos, las ilustraciones, los vídeos, la mascota Pawsi, los logotipos y el resto de elementos de PAWS son titularidad del titular o se usan con licencia. Queda prohibida su reproducción, distribución o transformación sin autorización expresa.",
        "Las fuentes de contenido de terceros utilizadas en PAWS se reconocen en la página «Créditos y fuentes».",
        "Los contenidos que cada usuario sube a PAWS (fotos, notas, datos de sus perros) siguen siendo suyos. El usuario concede a PAWS únicamente el permiso necesario para guardarlos y mostrárselos a él y a las personas con las que decida compartirlos dentro de la aplicación.",
      ],
    },
    {
      title: "4. Responsabilidad",
      paragraphs: [
        "El titular trabaja para que PAWS funcione correctamente, pero no garantiza la ausencia de interrupciones o errores. Las indicaciones de la aplicación, incluidas las generadas por inteligencia artificial, son orientativas y no sustituyen el criterio de un adiestrador profesional ni el consejo de un veterinario.",
        "PAWS puede contener enlaces o servicios de terceros (por ejemplo, WhatsApp, YouTube, la App Store o la página de pago). El titular no es responsable de sus contenidos ni de sus políticas.",
      ],
    },
    {
      title: "5. Legislación aplicable",
      paragraphs: [
        "Este aviso legal se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa aplicable, en particular la de protección de consumidores cuando el usuario tenga esa condición.",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// ENGLISH
// ---------------------------------------------------------------------------
const DOCUMENT_EN: LegalDocument = {
  title: "Legal notice",
  intro:
    "In compliance with Spanish Law 34/2002 on Information Society Services and Electronic Commerce (LSSI-CE), the details of the owner of this website and app are set out below. If there is any discrepancy, the Spanish version prevails.",
  sections: [
    {
      title: "1. Owner",
      bullets: [
        `Owner: ${LEGAL_OWNER.name}`,
        `Tax ID (NIF): ${LEGAL_OWNER.taxId}`,
        ...(LEGAL_OWNER.address ? [`Address: ${LEGAL_OWNER.address}`] : []),
        `Email: ${LEGAL_OWNER.email}`,
        `Trade name: ${LEGAL_OWNER.brand}`,
        `Website: ${LEGAL_OWNER.website}`,
      ],
    },
    {
      title: "2. Purpose",
      paragraphs: [
        "PAWS is a web and mobile app for managing dog training: it lets dog owners and professional trainers record dogs, trainings, sessions, progress and homework, and offers support tools based on artificial intelligence.",
        "Using the app implies acceptance of this legal notice, the Terms of use and the Privacy policy.",
      ],
    },
    {
      title: "3. Intellectual and industrial property",
      paragraphs: [
        "The design, code, texts, graphics, illustrations, videos, the Pawsi mascot, the logos and all other elements of PAWS belong to the owner or are used under licence. Their reproduction, distribution or transformation without express permission is prohibited.",
        "Third-party content sources used in PAWS are acknowledged on the “Credits and sources” page.",
        "Content that each user uploads to PAWS (photos, notes, data about their dogs) remains theirs. The user grants PAWS only the permission needed to store it and show it to them and to the people they choose to share it with inside the app.",
      ],
    },
    {
      title: "4. Liability",
      paragraphs: [
        "The owner works to keep PAWS working properly but does not guarantee that it will be free of interruptions or errors. The app's guidance, including that generated by artificial intelligence, is for information only and does not replace the judgement of a professional trainer or the advice of a veterinarian.",
        "PAWS may contain links to or services from third parties (for example, WhatsApp, YouTube, the App Store or the checkout page). The owner is not responsible for their content or policies.",
      ],
    },
    {
      title: "5. Governing law",
      paragraphs: [
        "This legal notice is governed by Spanish law. Any dispute will be heard by the courts that have jurisdiction under the applicable rules, in particular consumer protection rules where the user is a consumer.",
      ],
    },
  ],
};

export default function AvisoLegalPage() {
  return (
    <LegalDocumentView
      document={DOCUMENT_ES}
      documentEn={DOCUMENT_EN}
      currentHref="/legal/aviso-legal"
    />
  );
}