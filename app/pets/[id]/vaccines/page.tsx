import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import PetVaccinations from "@/components/PetVaccinations";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const PHOTO_BUCKET = "vaccination-photos";
const SIGNED_URL_SECONDS = 60 * 60;

// Calendario de vacunación de un perro.
// Se cargan las vacunas y las fotos de la cartilla; el resto (plan sugerido,
// añadir, editar, marcar como puesta) lo hace PetVaccinations en el navegador.
export default async function PetVaccinesPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("Vaccines");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, name, birth_date")
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .single();

  if (petError || !pet) {
    notFound();
  }

  const { data: vaccinationsData } = await supabase
    .from("pet_vaccinations")
    .select("*")
    .eq("pet_id", pet.id)
    .eq("user_id", user.id);

  const vaccinations = vaccinationsData ?? [];

  // Enlaces temporales para ver las fotos (el almacén es privado)
  const photoPaths = vaccinations
    .map((vaccination) => vaccination.photo_path)
    .filter((path): path is string => typeof path === "string" && path !== "");

  const photoUrls: Record<string, string> = {};

  if (photoPaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(photoPaths, SIGNED_URL_SECONDS);

    for (const item of signedData ?? []) {
      if (item.path && item.signedUrl) {
        photoUrls[item.path] = item.signedUrl;
      }
    }
  }

  return (
    <main
      data-tour-section="vaccines"
      className="min-h-screen bg-slate-100 p-6 md:p-10"
    >
      <div className="mx-auto max-w-4xl">

        {/* CABECERA */}

        <div className="mb-8">
          <Link
            href={`/pets/${pet.id}`}
            className="inline-block rounded-xl bg-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            {t("backToPet")}
          </Link>

          <h1 className="mt-6 text-4xl font-extrabold text-blue-700 md:text-5xl">
            {t("title", { name: pet.name })}
          </h1>

          <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>

          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠️ {t("disclaimer")}
          </p>
        </div>

        {/* LISTA, PLAN SUGERIDO Y FORMULARIO */}

        <PetVaccinations
          petId={pet.id}
          petName={pet.name}
          userId={user.id}
          birthDate={pet.birth_date ?? null}
          initialVaccinations={vaccinations}
          initialPhotoUrls={photoUrls}
        />

      </div>
    </main>
  );
}