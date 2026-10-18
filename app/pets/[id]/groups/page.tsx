import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

// Los grupos ahora están en la página de habilidades (pestaña "Grupos").
// Esta dirección se mantiene para que los enlaces antiguos sigan funcionando.
export default async function PetGroupsRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/pets/${id}/skills?tab=groups`);
}