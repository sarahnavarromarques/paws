import Link from "next/link";

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">

        {/* CABECERA */}
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Volver al dashboard
          </Link>

          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            📚 Créditos y fuentes
          </h1>

          <p className="mt-2 text-slate-600">
            Reconocimiento a las fuentes que han servido de referencia para
            construir PAWS.
          </p>
        </header>

        {/* TARJETA: FCI */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-xl font-bold">
            🏅 Reglamento de Obediencia (FCI)
          </h2>

          <p className="mt-4 leading-relaxed text-slate-700">
            Parte de las habilidades y ejercicios de obediencia incluidos en
            PAWS se han elaborado tomando como referencia el{" "}
            <span className="font-semibold">
              «Reglamento General para la Participación en Pruebas y
              Competiciones de Obediencia Clase Internacional con C.A.C.I.O.B.»
            </span>{" "}
            de la{" "}
            <span className="font-semibold italic">
              Fédération Cynologique Internationale
            </span>{" "}
            (FCI).
          </p>

          <p className="mt-4 leading-relaxed text-slate-700">
            Dicho reglamento fue aprobado por el Comité General de la FCI en
            Bruselas (noviembre de 1999) y entró en vigor el 1 de enero de 2001.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-5">
            <p className="text-sm leading-relaxed text-slate-500">
              PAWS no está afiliada ni respaldada por la FCI. Las referencias a
              dicho reglamento se realizan con fines informativos y educativos,
              como reconocimiento a la fuente original.
            </p>
          </div>
        </section>

        {/* PIE */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Gracias a todas las fuentes y profesionales que hacen posible un
          entrenamiento canino basado en el conocimiento.
        </p>

      </div>
    </main>
  );
}