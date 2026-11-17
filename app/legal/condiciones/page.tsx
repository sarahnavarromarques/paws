import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import LegalDocumentView from "@/components/LegalDocumentView";
import { LEGAL_OWNER, type LegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: locale === "es" ? "Condiciones de uso · PAWS" : "Terms of use · PAWS",
  };
}

// ---------------------------------------------------------------------------
// ESPAÑOL
// ---------------------------------------------------------------------------
const DOCUMENT_ES: LegalDocument = {
  title: "Condiciones de uso",
  intro: `Estas condiciones regulan el uso de PAWS, ofrecido por ${LEGAL_OWNER.name}. Al crear una cuenta aceptas estas condiciones y la Política de privacidad.`,
  sections: [
    {
      title: "1. Qué es PAWS",
      paragraphs: [
        "PAWS es una aplicación web y para móvil para organizar el adiestramiento canino. Los propietarios pueden registrar a sus perros, entrenamientos y progreso. Los adiestradores pueden invitar a sus clientes, mandarles deberes y ver cómo practican en casa. PAWS incluye herramientas de inteligencia artificial que funcionan con huesitos.",
      ],
    },
    {
      title: "2. Tu cuenta",
      bullets: [
        "Debes dar datos verdaderos y mantener tu contraseña en secreto. Eres responsable de lo que se haga desde tu cuenta.",
        "Debes tener al menos 18 años para crear una cuenta y usar PAWS.",
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
        "PAWS PRO es una suscripción mensual con un precio de 29 € al mes, impuestos incluidos, salvo que se indique otro precio en la página de pago o en la App Store (por ejemplo, el precio de fundador).",
        "Incluye las herramientas de adiestrador sin límite de clientes y 300 huesitos al mes.",
        "La suscripción se renueva automáticamente cada mes hasta que la canceles.",
        "Contratada en la web: los pagos se procesan mediante Stripe. En las compras, Link (Stripe) actúa como vendedor y emite los recibos y facturas. Puedes cancelarla en cualquier momento desde «Gestionar suscripción».",
        "Contratada desde la aplicación para iPhone: el pago lo gestiona Apple con tu cuenta de Apple, al precio indicado en la App Store. Puedes cancelarla en cualquier momento desde los ajustes de suscripciones de tu cuenta de Apple, al menos 24 horas antes de la renovación.",
        "Al cancelar, seguirás siendo PRO hasta el final del periodo ya pagado y no se te volverá a cobrar.",
      ],
    },
    {
      title: "5. Precio de fundador",
      paragraphs: [
        "Los adiestradores que reciban un enlace personal de fundador pueden activar un 50 % de descuento sobre PAWS PRO contratado en la web, mientras mantengan la suscripción activa. Cada enlace es personal, intransferible y de un solo uso. Si la suscripción se cancela y se vuelve a contratar más adelante en la web, el descuento se mantiene para la misma cuenta.",
      ],
    },
    {
      title: "6. Huesitos",
      bullets: [
        "Los huesitos son unidades de uso de las herramientas de inteligencia artificial de PAWS. No son dinero, no se pueden canjear por dinero ni transferir a otra cuenta.",
        "Cada cuenta recibe 20 huesitos de bienvenida.",
        "Los 300 huesitos mensuales de PAWS PRO caducan al final de cada mes de suscripción y no se acumulan.",
        "Los huesitos comprados en packs (compra única), en la web o en la App Store, no caducan mientras la cuenta exista. Se pierden si se borra la cuenta.",
        "Los huesitos se pueden usar desde el momento de la compra. Los huesitos ya usados no son reembolsables.",
      ],
    },
    {
      title: "7. Derecho de desistimiento y reembolsos",
      paragraphs: [
        "Si contratas como consumidor, dispones de 14 días naturales para desistir de la contratación. Sin embargo, al tratarse de un servicio digital que empieza a prestarse inmediatamente, al confirmar el pago solicitas expresamente que el servicio comience en ese momento y reconoces que, una vez consumido el contenido digital (por ejemplo, los huesitos utilizados), pierdes el derecho de desistimiento respecto a esa parte, conforme al artículo 103 del Real Decreto Legislativo 1/2007. El derecho de desistimiento no se aplica a quienes contratan como profesionales.",
        "Las compras realizadas desde la aplicación para iPhone las gestiona Apple. Los reembolsos de esas compras se solicitan directamente a Apple, según sus condiciones.",
      ],
    },
    {
      title: "8. Inteligencia artificial",
      paragraphs: [
        "Las respuestas de las herramientas de IA son orientativas y pueden contener errores. No sustituyen el criterio de un adiestrador profesional ni el consejo de un veterinario. PAWS no presta servicios veterinarios. Ante cualquier problema de salud o de comportamiento grave de tu perro, consulta a un profesional.",
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
      title: "11. Aplicación para iPhone",
      paragraphs: [
        "Si descargas PAWS desde la App Store, además de estas condiciones se aplica el Contrato de licencia de usuario final estándar de Apple. Apple no es responsable del servicio de PAWS ni de su contenido; cualquier consulta sobre la aplicación debe dirigirse a nosotros.",
      ],
    },
    {
      title: "12. Cambios en el servicio y en estas condiciones",
      paragraphs: [
        "Podemos mejorar o modificar PAWS y estas condiciones. Si el cambio afecta de forma importante a tus derechos o al precio de tu suscripción, te avisaremos con antelación y podrás cancelar antes de que se aplique.",
      ],
    },
    {
      title: "13. Contacto, ley aplicable y resolución de conflictos",
      paragraphs: [
        `Para cualquier consulta o reclamación puedes escribir a ${LEGAL_OWNER.email}.`,
        "Estas condiciones se rigen por la ley española. Si eres consumidor, serán competentes los juzgados de tu domicilio.",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// ENGLISH
// ---------------------------------------------------------------------------
const DOCUMENT_EN: LegalDocument = {
  title: "Terms of use",
  intro: `These terms govern the use of PAWS, provided by ${LEGAL_OWNER.name}. By creating an account you accept these terms and the Privacy policy. If there is any discrepancy, the Spanish version prevails.`,
  sections: [
    {
      title: "1. What PAWS is",
      paragraphs: [
        "PAWS is a web and mobile app for organising dog training. Owners can record their dogs, trainings and progress. Trainers can invite their clients, set them homework and see how they practise at home. PAWS includes artificial intelligence tools that run on huesitos.",
      ],
    },
    {
      title: "2. Your account",
      bullets: [
        "You must provide accurate information and keep your password secret. You are responsible for anything done from your account.",
        "You must be at least 18 years old to create an account and use PAWS.",
        "You can delete your account at any time from Settings.",
      ],
    },
    {
      title: "3. Free use and trial for trainers",
      bullets: [
        "Dog owners can use PAWS for free, including the homework set by their trainer.",
        "Trainer accounts get a 30-day free trial from account creation to invite clients and set homework. After the trial they can still see their clients and their progress, but they need PAWS PRO to invite new clients or set homework.",
      ],
    },
    {
      title: "4. PAWS PRO",
      bullets: [
        "PAWS PRO is a monthly subscription priced at €29 per month, taxes included, unless a different price is shown on the checkout page or in the App Store (for example, the founder price).",
        "It includes the trainer tools with unlimited clients and 300 huesitos per month.",
        "The subscription renews automatically every month until you cancel it.",
        "Subscribed on the web: payments are processed by Stripe. For purchases, Link (Stripe) acts as the seller and issues receipts and invoices. You can cancel at any time from “Manage subscription”.",
        "Subscribed from the iPhone app: payment is handled by Apple through your Apple account, at the price shown in the App Store. You can cancel at any time from the subscription settings of your Apple account, at least 24 hours before renewal.",
        "When you cancel, you remain PRO until the end of the period already paid and you will not be charged again.",
      ],
    },
    {
      title: "5. Founder price",
      paragraphs: [
        "Trainers who receive a personal founder link can activate a 50% discount on PAWS PRO subscribed on the web, for as long as they keep the subscription active. Each link is personal, non-transferable and single-use. If the subscription is cancelled and taken out again later on the web, the discount is kept for the same account.",
      ],
    },
    {
      title: "6. Huesitos",
      bullets: [
        "Huesitos are units for using the PAWS artificial intelligence tools. They are not money, cannot be exchanged for money and cannot be transferred to another account.",
        "Each account receives 20 welcome huesitos.",
        "The 300 monthly huesitos included in PAWS PRO expire at the end of each subscription month and do not roll over.",
        "Huesitos bought in packs (one-off purchase), on the web or in the App Store, do not expire while the account exists. They are lost if the account is deleted.",
        "Huesitos can be used as soon as they are purchased. Huesitos already used are non-refundable.",
      ],
    },
    {
      title: "7. Right of withdrawal and refunds",
      paragraphs: [
        "If you purchase as a consumer, you have 14 calendar days to withdraw. However, as this is a digital service that starts immediately, by confirming payment you expressly request that the service begins at that moment and acknowledge that, once the digital content has been used (for example, huesitos spent), you lose the right of withdrawal for that part, in accordance with Article 103 of Spanish Royal Legislative Decree 1/2007. The right of withdrawal does not apply to those purchasing as professionals.",
        "Purchases made from the iPhone app are handled by Apple. Refunds for those purchases must be requested directly from Apple, under its terms.",
      ],
    },
    {
      title: "8. Artificial intelligence",
      paragraphs: [
        "Answers from the AI tools are for guidance only and may contain mistakes. They do not replace the judgement of a professional trainer or the advice of a veterinarian. PAWS does not provide veterinary services. For any health problem or serious behaviour issue with your dog, consult a professional.",
      ],
    },
    {
      title: "9. Acceptable use",
      bullets: [
        "Do not use PAWS for illegal purposes, to harass other people or to upload content that does not belong to you or that infringes the rights of others.",
        "Do not try to access other users' data, bypass the app's limits or overload the service.",
        "If a trainer shares information with their clients (or vice versa), each is responsible for what they publish.",
        "We may suspend or close accounts that breach these terms.",
      ],
    },
    {
      title: "10. Liability",
      paragraphs: [
        "We work to keep PAWS available and working well, but there may be interruptions for maintenance or reasons beyond our control. To the extent permitted by law, we are not liable for indirect damages arising from the use of the app. Nothing in these terms limits the rights that the law grants to consumers.",
      ],
    },
    {
      title: "11. iPhone app",
      paragraphs: [
        "If you download PAWS from the App Store, Apple's standard End User License Agreement also applies in addition to these terms. Apple is not responsible for the PAWS service or its content; any questions about the app must be addressed to us.",
      ],
    },
    {
      title: "12. Changes to the service and to these terms",
      paragraphs: [
        "We may improve or modify PAWS and these terms. If a change significantly affects your rights or the price of your subscription, we will notify you in advance and you will be able to cancel before it applies.",
      ],
    },
    {
      title: "13. Contact, governing law and disputes",
      paragraphs: [
        `For any question or complaint you can write to ${LEGAL_OWNER.email}.`,
        "These terms are governed by Spanish law. If you are a consumer, the courts of your place of residence will have jurisdiction.",
      ],
    },
  ],
};

export default function CondicionesPage() {
  return (
    <LegalDocumentView
      document={DOCUMENT_ES}
      documentEn={DOCUMENT_EN}
      currentHref="/legal/condiciones"
    />
  );
}