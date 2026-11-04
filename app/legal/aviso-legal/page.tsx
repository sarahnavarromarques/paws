import type { Metadata } from "next";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso legal · PAWS" };

const DOCUMENT: LegalDocument = {
  title: "Aviso legal",
  intro:
    "En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web y aplicación.",
  sections: [
    {
      title: "1. Titular",
      bullets: [
        `Titular: ${LEGAL_OWNER.name}`,
        `NIF: ${LEGAL_OWNER.taxId}`,
        `Domicilio: ${LEGAL_OWNER.address}`,
        `Correo electrónico: ${LEGAL_OWNER.email}`,
        `Nombre comercial: ${LEGAL_OWNER.brand}`,
        `Sitio web: ${LEGAL_OWNER.website}`,
      ],
    },
    {
      title: "2. Objeto",
      paragraphs: [
        "PAWS es una aplicación web para la gestión del adiestramiento canino: permite a propietarios de perros y a adiestradores profesionales registrar perros, entrenamientos, sesiones, progreso y deberes, y ofrece herramientas de apoyo basadas en inteligencia artificial.",
        "El uso de la aplicación implica la aceptación de este aviso legal, de las Condiciones de uso y de la Política de privacidad.",
      ],
    },
    {
      title: "3. Propiedad intelectual e industrial",
      paragraphs: [
        "El diseño, el código, los textos, los gráficos, la mascota Pawsi, los logotipos y el resto de elementos de PAWS son titularidad del titular o se usan con licencia. Queda prohibida su reproducción, distribución o transformación sin autorización expresa.",
        "Los contenidos que cada usuario sube a PAWS (fotos, notas, datos de sus perros) siguen siendo suyos. El usuario concede a PAWS únicamente el permiso necesario para guardarlos y mostrárselos a él y a las personas con las que decida compartirlos dentro de la aplicación.",
      ],
    },
    {
      title: "4. Responsabilidad",
      paragraphs: [
        "El titular trabaja para que PAWS funcione correctamente, pero no garantiza la ausencia de interrupciones o errores. Las indicaciones de la aplicación, incluidas las generadas por inteligencia artificial, son orientativas y no sustituyen el criterio de un adiestrador profesional ni el consejo de un veterinario.",
        "PAWS puede contener enlaces a sitios de terceros (por ejemplo, WhatsApp o la página de pago). El titular no es responsable de sus contenidos ni de sus políticas.",
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

export default function AvisoLegalPage() {
  return <LegalDocumentView document={DOCUMENT} currentHref="/legal/aviso-legal" />;
}
