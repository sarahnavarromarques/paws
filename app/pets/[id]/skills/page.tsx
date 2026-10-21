import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function OldPetSkillsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const url = new URL("/skills", "http://localhost");
  url.searchParams.set("pet", id);

  if (sp.tab) url.searchParams.set("tab", sp.tab);
  if (sp.skill) url.searchParams.set("skill", sp.skill);

  redirect(`${url.pathname}${url.search}`);
}