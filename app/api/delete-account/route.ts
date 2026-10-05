import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// Palabras de confirmación aceptadas (español / inglés)
const CONFIRM_WORDS = ["BORRAR", "DELETE"];

type StorageRef = { bucket: string; path: string };

// Convierte una URL pública de Supabase Storage en { bucket, path }
function parseStorageUrl(url: string | null | undefined): StorageRef | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function readStringField(raw: unknown, field: string): string {
  if (typeof raw !== "object" || raw === null) return "";
  const value: unknown = (raw as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("delete-account: faltan variables de entorno");
    return jsonError("server_config", 500);
  }

  // 1) Identificar al usuario a partir de su sesión
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonError("unauthorized", 401);

  const raw: unknown = await request.json().catch(() => null);
  const password = readStringField(raw, "password");
  const confirmation = readStringField(raw, "confirmation").trim().toUpperCase();

  if (!password) return jsonError("missing_password", 400);
  if (!CONFIRM_WORDS.includes(confirmation)) {
    return jsonError("invalid_confirmation", 400);
  }

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;

  if (userError || !user || !user.email) {
    return jsonError("unauthorized", 401);
  }

  // 2) Comprobar la contraseña
  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: passwordError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (passwordError) {
    if (passwordError.code === "over_request_rate_limit") {
      return jsonError("rate_limited", 429);
    }
    return jsonError("wrong_password", 403);
  }

  const userId = user.id;

  // 3) Reunir los archivos a borrar (se borran al final)
  const filesByBucket = new Map<string, Set<string>>();

  function addFile(ref: StorageRef | null) {
    if (!ref) return;
    const set = filesByBucket.get(ref.bucket) ?? new Set<string>();
    set.add(ref.path);
    filesByBucket.set(ref.bucket, set);
  }

  const { data: pets, error: petsError } = await admin
    .from("pets")
    .select("id, photo")
    .eq("user_id", userId);

  if (petsError) {
    console.error("delete-account: error leyendo mascotas", petsError);
    return jsonError("delete_failed", 500);
  }

  (pets ?? []).forEach((pet) => addFile(parseStorageUrl(pet.photo)));

  const { data: mySkills, error: skillsError } = await admin
    .from("skills")
    .select("id, steps_image, mistakes_image, steps_image_en, mistakes_image_en")
    .eq("user_id", userId);

  if (skillsError) {
    console.error("delete-account: error leyendo habilidades", skillsError);
    return jsonError("delete_failed", 500);
  }

  for (const skill of mySkills ?? []) {
    addFile(parseStorageUrl(skill.steps_image));
    addFile(parseStorageUrl(skill.mistakes_image));
    addFile(parseStorageUrl(skill.steps_image_en));
    addFile(parseStorageUrl(skill.mistakes_image_en));

    const folder = `skill-${skill.id}`;
    const { data: skillFiles } = await admin.storage
      .from("skill-images")
      .list(folder);
    (skillFiles ?? []).forEach((file) =>
      addFile({ bucket: "skill-images", path: `${folder}/${file.name}` })
    );
  }

  const { data: avatarFiles } = await admin.storage
    .from("avatars")
    .list(userId);
  (avatarFiles ?? []).forEach((file) =>
    addFile({ bucket: "avatars", path: `${userId}/${file.name}` })
  );

  // 4) Borrar datos (al borrar mascotas, Supabase borra en cadena
  //    sus sesiones, habilidades asignadas y grupos)
  const { error: trainingsDeleteError } = await admin
    .from("trainings")
    .delete()
    .eq("user_id", userId);

  if (trainingsDeleteError) {
    console.error("delete-account: error borrando entrenamientos", trainingsDeleteError);
    return jsonError("delete_failed", 500);
  }

  const { error: petsDeleteError } = await admin
    .from("pets")
    .delete()
    .eq("user_id", userId);

  if (petsDeleteError) {
    console.error("delete-account: error borrando mascotas", petsDeleteError);
    return jsonError("delete_failed", 500);
  }

  const { error: skillsDeleteError } = await admin
    .from("skills")
    .delete()
    .eq("user_id", userId);

  if (skillsDeleteError) {
    console.error("delete-account: error borrando habilidades", skillsDeleteError);
    return jsonError("delete_failed", 500);
  }

  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileDeleteError) {
    console.error("delete-account: error borrando perfil", profileDeleteError);
    return jsonError("delete_failed", 500);
  }

  // 5) Borrar archivos (si alguno falla, no bloquea el borrado de la cuenta)
  for (const [bucket, paths] of Array.from(filesByBucket.entries())) {
    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(Array.from(paths));
    if (removeError) {
      console.error(`delete-account: error borrando archivos de ${bucket}`, removeError);
    }
  }

  // 6) Borrar el usuario de acceso
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error("delete-account: error borrando usuario", deleteUserError);
    return jsonError("delete_failed", 500);
  }

  return NextResponse.json({ ok: true });
}