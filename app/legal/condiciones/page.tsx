import type { Metadata } from "next";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export const metadata: Metadata = { title: "Condiciones de uso · PAWS" };

const DOCUMENT: LegalDocument = {
  title: "Condiciones de uso",
  intro: `Estas condiciones regulan el uso de PAWS, ofrecido por ${LEGAL_OWNER.name}. Al crear una cuenta aceptas estas condiciones y la Política de privacidad.`,
  sections: [
    {
      title: "1. Qué es PAWS",
      paragraphs: [
        "PAWS es una aplicación web para organizar el adiestramiento canino. Los propietarios pueden registrar a sus perros, entrenamientos y progreso. Los adiestradores pueden invitar a sus clientes, mandarles deberes y ver cómo practican en casa. PAWS incluye herramientas de inteligencia artificial que funcionan con huesitos.",
      ],
    },
    {
      title: "2. Tu cuenta",
      bullets: [
        "Debes dar datos verdaderos y mantener tu contraseña en secreto. Eres responsable de lo que se haga desde tu cuenta.",
        "Debes tener al menos 14 años, o contar con el consentimiento de tus padres o tutores.",
        "Puedes borrar tu cuenta en cualquier momento desde Ajustes.",
      ],
    },
    {
      title: "3. Uso gratuito y prueba para adiestradores",
      bullets: [
        "Los propietarios de perros pueden usar PAWS gratis, incluidos los deberes que les mande su adiestrador.",
        "Las cuentas de adiestrador disponen de 30 días de prueba gratuita desde que se crea la cuenta para invitar a clientes y mandar deberes. Al terminar la prueba, siguen viendo a sus clientes y su progreso, pero para invitar a clientes nuevos o mandar deberes necesitan PAWS PRO.",
      ],
    },
    {
      title: "4. PAWS PRO",
      bullets: [
        "PAWS PRO es una suscripción mensual con un precio de 29 € al mes, impuestos incluidos, salvo que se indique otro precio en la página de pago (por ejemplo, el precio de fundador).",
        "Incluye las herramientas de adiestrador sin límite de clientes y 300 huesitos al mes.",
        "La suscripción se renueva automáticamente cada mes hasta que la canceles.",
        "Puedes cancelarla en cualquier momento desde «Gestionar suscripción». Seguirás siendo PRO hasta el final del periodo ya pagado y no se te volverá a cobrar.",
        "Los pagos se procesan mediante Stripe. En las compras, Link (Stripe) actúa como vendedor y emite los recibos y facturas.",
      ],
    },
    {
      title: "5. Precio de fundador",
      paragraphs: [
        "Los adiestradores que reciban un enlace personal de fundador pueden activar un 50 % de descuento sobre PAWS PRO mientras mantengan la suscripción activa. Cada enlace es personal, intransferible y de un solo uso. Si la suscripción se cancela y se vuelve a contratar más adelante, el descuento se mantiene para la misma cuenta.",
      ],
    },
    {
      title: "6. Huesitos",
      bullets: [
        "Los huesitos son unidades de uso de las herramientas de inteligencia artificial de PAWS. No son dinero, no se pueden canjear por dinero ni transferir a otra cuenta.",
        "Cada cuenta recibe 20 huesitos de bienvenida.",
        "Los 300 huesitos mensuales de PAWS PRO caducan al final de cada mes de suscripción y no se acumulan.",
        "Los huesitos comprados en packs (compra única) no caducan mientras la cuenta exista. Se pierden si se borra la cuenta.",
        "Los huesitos se pueden usar desde el momento de la compra. Los huesitos ya usados no son reembolsables.",
      ],
    },
    {
      title: "7. Derecho de desistimiento",
      paragraphs: [
        "Si contratas como consumidor, dispones de 14 días naturales para desistir de la contratación. Sin embargo, al tratarse de un servicio digital que empieza a prestarse inmediatamente, al confirmar el pago solicitas expresamente que el servicio comience en ese momento y reconoces que, una vez consumido el contenido digital (por ejemplo, los huesitos utilizados), pierdes el derecho de desistimiento respecto a esa parte, conforme al artículo 103 del Real Decreto Legislativo 1/2007. El derecho de desistimiento no se aplica a quienes contratan como profesionales.",
      ],
    },
    {
      title: "8. Inteligencia artificial",
      paragraphs: [
        "Las respuestas de las herramientas de IA son orientativas y pueden contener errores. No sustituyen el criterio de un adiestrador profesional ni el consejo de un veterinario. Ante cualquier problema de salud o de comportamiento grave de tu perro, consulta a un profesional.",
      ],
    },
    {
      title: "9. Uso correcto",
      bullets: [
        "No uses PAWS para fines ilegales, para molestar a otras personas ni para subir contenido que no te pertenezca o que vulnere derechos de terceros.",
        "No intentes acceder a datos de otros usuarios, saltarte los límites de la aplicación ni sobrecargar el servicio.",
        "Si un adiestrador comparte información con sus clientes (o al revés), cada uno es responsable de lo que publica.",
        "Podemos suspender o cerrar las cuentas que incumplan estas condiciones.",
      ],
    },
    {
      title: "10. Responsabilidad",
      paragraphs: [
        "Trabajamos para que PAWS esté disponible y funcione bien, pero puede haber interrupciones por mantenimiento o causas ajenas. En la medida en que lo permita la ley, no respondemos de daños indirectos derivados del uso de la aplicación. Nada de lo indicado limita los derechos que la ley reconoce a los consumidores.",
      ],
    },
    {
      title: "11. Cambios en el servicio y en estas condiciones",
      paragraphs: [
        "Podemos mejorar o modificar PAWS y estas condiciones. Si el cambio afecta de forma importante a tus derechos o al precio de tu suscripción, te avisaremos con antelación y podrás cancelar antes de que se aplique.",
      ],
    },
    {
      title: "12. Contacto, ley aplicable y resolución de conflictos",
      paragraphs: [
        `Para cualquier consulta o reclamación puedes escribir a ${LEGAL_OWNER.email}.`,
        "Estas condiciones se rigen por la ley española. Si eres consumidor, serán competentes los juzgados de tu domicilio.",
      ],
    },
  ],
};

export default function CondicionesPage() {
  return <LegalDocumentView document={DOCUMENT} currentHref="/legal/condiciones" />;
}
