import type { Metadata } from "next";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad · PAWS" };

const DOCUMENT: LegalDocument = {
  title: "Política de privacidad",
  intro:
    "Esta política explica qué datos personales trata PAWS, para qué, durante cuánto tiempo y qué derechos tienes, conforme al Reglamento General de Protección de Datos (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).",
  sections: [
    {
      title: "1. Responsable del tratamiento",
      bullets: [
        `Responsable: ${LEGAL_OWNER.name}`,
        `NIF: ${LEGAL_OWNER.taxId}`,
        ...(LEGAL_OWNER.address ? [`Domicilio: ${LEGAL_OWNER.address}`] : []),
        `Correo de contacto para privacidad: ${LEGAL_OWNER.email}`,
      ],
    },
    {
      title: "2. Qué datos tratamos",
      bullets: [
        "Datos de cuenta: correo electrónico, contraseña (guardada cifrada), nombre o nombre de usuario, idioma y tipo de cuenta (particular, adiestrador, centro o refugio).",
        "Datos de tus perros: nombre, raza, edad, fecha de nacimiento, sexo, peso, color, fotos, objetivos, nivel, vacunas, desparasitaciones y notas de salud que decidas añadir.",
        "Datos de entrenamiento: sesiones, entrenamientos, calendario, habilidades, progreso, deberes y registros de práctica.",
        "Relación adiestrador–cliente: qué perros compartes con qué adiestrador, el nombre con el que el adiestrador identifica a su cliente y las invitaciones.",
        "Uso de la inteligencia artificial: los textos y datos que envías a las herramientas de IA, sus respuestas y el consumo de huesitos.",
        "Datos de suscripción: estado de PAWS PRO, fechas de renovación e identificadores de cliente y suscripción de Stripe. PAWS no ve ni guarda los datos de tu tarjeta.",
        "Datos técnicos imprescindibles: cookies de sesión y preferencias (ver apartado 9).",
      ],
    },
    {
      title: "3. Para qué los usamos y base legal",
      bullets: [
        "Prestarte el servicio de PAWS (crear tu cuenta, guardar tus perros y entrenamientos, mostrar tu progreso): ejecución del contrato (art. 6.1.b RGPD).",
        "Compartir datos de tus perros con el adiestrador que tú elijas al aceptar su invitación: ejecución del contrato y tu decisión expresa. Puedes dejar de compartirlos en cualquier momento.",
        "Generar respuestas con inteligencia artificial cuando usas esas herramientas: ejecución del contrato.",
        "Gestionar la suscripción PAWS PRO y la facturación: ejecución del contrato y cumplimiento de obligaciones legales (art. 6.1.c RGPD).",
        "Mantener la seguridad, evitar abusos y controlar el coste de la IA: interés legítimo (art. 6.1.f RGPD).",
        "Atender tus consultas y el ejercicio de tus derechos: obligación legal e interés legítimo.",
      ],
      paragraphs: [
        "No usamos tus datos para publicidad ni los vendemos a terceros. No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti.",
      ],
    },
    {
      title: "4. Con quién se comparten",
      paragraphs: [
        "Solo con los proveedores necesarios para que PAWS funcione, que actúan como encargados del tratamiento con contrato y garantías:",
      ],
      bullets: [
        "Supabase Inc.: base de datos, inicio de sesión y almacenamiento de fotos.",
        "Vercel Inc.: alojamiento de la aplicación web.",
        "Anthropic PBC: procesamiento de las peticiones a las herramientas de inteligencia artificial. Solo se envían los datos necesarios para cada respuesta.",
        "Stripe (y su servicio Link): gestión de los pagos de PAWS PRO. En las compras, Stripe/Link actúa como vendedor y trata tus datos de pago como responsable independiente según su propia política de privacidad.",
      ],
    },
    {
      title: "5. Transferencias internacionales",
      paragraphs: [
        "Algunos de estos proveedores tienen sede o servidores en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE–EE. UU. o en las cláusulas contractuales tipo aprobadas por la Comisión Europea.",
      ],
    },
    {
      title: "6. Cuánto tiempo los guardamos",
      bullets: [
        "Mientras tengas la cuenta abierta.",
        "Si borras tu cuenta desde Ajustes, se eliminan tus datos y los de tus perros. Pueden conservarse bloqueados los datos estrictamente necesarios para obligaciones legales (por ejemplo, fiscales) durante los plazos que marque la ley.",
        "Los registros técnicos y de uso de la IA se conservan como máximo el tiempo necesario para la seguridad y el control de costes.",
      ],
    },
    {
      title: "7. Tus derechos",
      paragraphs: [
        `Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación del tratamiento y la portabilidad de tus datos escribiendo a ${LEGAL_OWNER.email}. También puedes borrar tu cuenta en cualquier momento desde Ajustes.`,
        "Si consideras que no hemos atendido bien tu petición, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
      ],
    },
    {
      title: "8. Menores de edad",
      paragraphs: [
        "PAWS está dirigido a mayores de 14 años. Si tienes menos de 14 años, necesitas el consentimiento de tus padres o tutores para usarlo.",
      ],
    },
    {
      title: "9. Cookies y almacenamiento en tu navegador",
      paragraphs: [
        "PAWS solo usa cookies y almacenamiento local técnicos, imprescindibles para funcionar: mantener tu sesión iniciada, recordar tu idioma y recordar qué tutoriales has visto. No usamos cookies de publicidad ni de analítica de terceros, por lo que no es necesario pedir tu consentimiento para ellas.",
      ],
    },
    {
      title: "10. Seguridad",
      paragraphs: [
        "Aplicamos medidas técnicas y organizativas para proteger tus datos: conexiones cifradas, contraseñas cifradas y reglas de acceso en la base de datos para que cada usuario solo vea sus datos y los que otros han decidido compartir con él.",
      ],
    },
    {
      title: "11. Cambios en esta política",
      paragraphs: [
        "Si cambiamos esta política de forma importante, te avisaremos dentro de la aplicación o por correo electrónico.",
      ],
    },
  ],
};

export default function PrivacidadPage() {
  return <LegalDocumentView document={DOCUMENT} currentHref="/legal/privacidad" />;
}
